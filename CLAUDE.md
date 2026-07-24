# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

ARS Dream is a Firebase-backed React PWA for a real Manila marathon-tourism company (arsdreamph.com) — it's the digital registration/queue system for their international marathon tour packages (New York, Berlin, London, Tokyo, Sydney), not a generic fun-run app. Copy and flows should reflect an actual travel-agency booking process: limited-capacity tour packages, a queue → acceptance → payment pipeline, not instant signup.

The frontend (`src/`) is the actual application. `AppHost/` is a .NET Aspire project used **only** for local dev orchestration — it has no runtime role; it just launches the Vite dev server and the Firebase emulator suite together under one dashboard (see `AppHost/AppHost.cs`). Do not treat this as a .NET app.

## Commands

Run from the repo root (`package.json` lives there, not in `AppHost/`):

- `npm run dev` — start the Vite dev server
- `npm run emulators` — start the Firebase emulator suite (Auth :9099, Firestore :8080, Storage :9199, Functions :5001, UI :4000), config in `firebase.json`. Runs with `--import=./.emulator-data --export-on-exit`, so accounts/Firestore docs/uploaded files persist across restarts: state loads from `.emulator-data/` (gitignored) on start and is written back there when the emulators are stopped normally (Ctrl+C / closing the window — a force-kill skips the export, losing anything since the last clean stop). Delete `.emulator-data/` to reset to a clean slate.
- `npm run build` — `tsc -b && vite build`
- `npm run lint` — oxlint (config in `.oxlintrc.json`)
- Or press F5 on the Aspire `AppHost` project to start both the frontend and emulators together with a unified logs/traces dashboard

Cloud Functions (`functions/`, separate `package.json`, Node 20, ESM):
- `npm --prefix functions run build` — compile TypeScript to `functions/lib`
- `npm --prefix functions run deploy` — `firebase deploy --only functions`
- `npm --prefix functions run logs` — `firebase functions:log`

No test runner is configured in either package.

### Bootstrapping an admin user

Firestore rules only let a user self-create their profile with `role: 'user'`, and only an existing admin can promote another user — so the first admin can't be created from the app itself. `scripts/set-admin.mjs` (root `npm run set-admin`) uses `firebase-admin` to set `role: 'admin'` directly, bypassing security rules:

```
node scripts/set-admin.mjs --email you@example.com            # against local emulators (default)
node scripts/set-admin.mjs --email you@example.com --prod     # against a real project; requires GOOGLE_APPLICATION_CREDENTIALS
```

The target account must already exist (sign up in the app first). Prefer calling `node scripts/set-admin.mjs` directly over `npm run set-admin -- --email ...` — PowerShell has been observed dropping the `--email` flag when passed through npm's `--` separator.

If it reports the account as not found even though you signed up before, the emulator's Auth/Firestore state was likely reset rather than the account never existing — e.g. `.emulator-data/` didn't exist yet on that run, or the emulators were force-killed before `--export-on-exit` could run. Sign up again, then re-run the script.

## Environment

Client Firebase config is read from `VITE_FIREBASE_*` env vars (`src/firebase/config.ts`), copy `.env.example` to `.env`. `VITE_USE_FIREBASE_EMULATORS=true` points the client at the local emulators instead of a real project. The default local project id is `demo-ars-dream` (`.firebaserc`) — the `demo-` prefix means it only ever talks to emulators, no real GCP project required for local dev.

Running the emulators requires a JDK on PATH (Firestore/Auth emulators are JVM-based) — this is a common missing-dependency issue on fresh machines.

### Production deployment

`.firebaserc` only defines the local `demo-ars-dream` project — there is no real production Firebase project wired into this repo yet. Standing one up requires, in addition to setting the real `VITE_FIREBASE_*` values (and leaving `VITE_USE_FIREBASE_EMULATORS` unset/`false`) wherever the frontend is deployed:

- **Enable the Google sign-in provider** — Firebase Console → (prod project) → Authentication → Sign-in method → enable "Google", set a support email (required). `signInWithGoogle` (`src/features/auth/auth-actions.ts`) and the "Continue with Google" button (`SignInPage.tsx`) always render/run client-side regardless of this — if Google sign-in silently fails or the popup errors in production, this console setting (or one of the ones below) is almost always the cause, not app code.
- **Add authorized domains** — Authentication → Settings → Authorized domains must include `arsdreamph.com` (and `www.arsdreamph.com` if used); only `localhost` and `*.firebaseapp.com`/`*.web.app` are there by default.
- **OAuth consent screen** — Google Cloud Console → APIs & Services → OAuth consent screen (auto-created when Google sign-in is enabled) needs to be out of "Testing" mode (or have real users added as test users) with app name/support email filled in.
- **OAuth client authorized origins** — Google Cloud Console → Credentials → the auto-created "Web client" should list `https://arsdreamph.com` under Authorized JavaScript origins.

#### Deploying via GitHub Actions

No `.github/workflows/` exist yet — deploys today are manual (`firebase deploy`). If/when that changes to CI-driven deploys, the path is:

1. Add a second alias to `.firebaserc` (e.g. `"production": "<real-project-id>"`), keeping `default: demo-ars-dream` for local emulator use.
2. Run `firebase init hosting:github` locally (needs `firebase login` + GitHub repo access). It provisions a GCP service account, adds it as a GitHub Actions secret automatically, and writes two workflows: deploy-on-merge-to-`main`, and a preview channel per PR. Build command to give it: `npm ci && npm run build` (hosting serves `dist`, per `firebase.json`).
3. The generator only wires up Hosting — it does **not** know about `VITE_FIREBASE_*` (Vite bakes these into the build at compile time, so they must be added as GitHub Actions repo secrets and exported as env vars in the workflow's build step) or about Cloud Functions/Firestore/Storage rules. Those need a separate job in the workflow using the same service account, e.g. `firebase deploy --only functions,firestore:rules,storage --project production`.
4. Since no test runner exists (see Commands above), the only sensible CI gate is `npm run lint` and `tsc -b` (part of `npm run build`) before deploy.

## Architecture

### Data model & status pipelines

Three Firestore collections, typed in `src/types/index.ts`, rules enforced in `firestore.rules`:

- **`users/{uid}`** — `role: 'user' | 'admin'`. Auto-created on first sign-in by `use-auth-listener.ts` with `role: 'user'`; only an admin (or the bootstrap script) can change `role`.
- **`marathons/{id}`** — a tour package. `status: 'draft' | 'published' | 'closed'`. Non-admins can read any non-`draft` marathon (so a registrant keeps seeing an event's banner/date/payment info on their My Registrations view after it closes); only `published` ones accept new registrations / appear on the timeline. `confirmedCount` is server-maintained via `FieldValue.increment` inside `confirmPayment` — never written by the client. `questions?: MarathonQuestion[]` optionally defines a per-event questionnaire (types: `text` / `textarea` / `select` / `checkbox`), authored via the question builder in `MarathonFormDialog.tsx` — question `id`s are preserved across edits (not regenerated) so existing registrants' answers stay matched to the right question.
- **`registrations/{id}`** — one user's application to one marathon. `status` moves through a fixed pipeline:
  `queued → accepted → terms_accepted → payment_submitted → confirmed` (or `rejected` / `payment_rejected` off the happy path).

  The Firestore rules split write authority by step: a user can move their own registration through `terms_accepted`/`payment_submitted` only (never set admin-controlled outcomes directly), while `queued→accepted/rejected` and `payment_submitted→confirmed/payment_rejected` are **only** done through Cloud Functions callables (`acceptRegistration`, `confirmPayment` in `functions/src/`), because those transitions need server-side capacity checks against `marathons.capacity` that can't be trusted from the client. `src/features/registrations/api.ts` calls these via `httpsCallable`; direct `updateDoc` is used only for the client-safe transitions.

  If the marathon defines `questions`, the registrant must also fill in `answers: QuestionAnswer[]` while still in `terms_accepted`, before payment. This is deliberately **not** a separate `status` value — it's gated purely by data (`getPendingActionStep()` / `isQuestionnaireComplete()` in `src/features/registrations/registration-flow.ts`), since writing `answers` while `status` stays `terms_accepted` is already covered by the existing self-update rule and needs no rules change.

- Registration status changes trigger `onRegistrationStatusChange` (Firestore `onUpdate` trigger), which pushes an FCM notification to the user's stored `fcmTokens` and prunes tokens that bounced.

### Frontend structure

Feature-folder layout under `src/features/{auth,marathons,registrations,admin}/`, each typically with an `api.ts` (Firestore/Functions calls) and `use-*.ts` hooks wrapping `onSnapshot` subscriptions. Global state is Zustand (`auth-store.ts`) for the current user/profile only; TanStack Query is used elsewhere for server-state caching. Routing/guards are in `App.tsx` + `features/auth/RequireAuth.tsx` (`RequireAuth` for signed-in, `RequireAdmin` for `profile.role === 'admin'`, gated on the live Firestore profile, not custom claims).

Primary navigation is a bottom tab bar (`src/components/BottomNav.tsx`) shown whenever signed in — Home / My Bookings / Admin (if admin) — the header (`Layout.tsx`) only carries branding plus the avatar/sign-out menu.

`/my-registrations` (`features/registrations/MyRegistrationsPage.tsx`) lists all of a user's registrations across every marathon regardless of status, including ones on now-closed events. It resolves each registration's marathon via `useMarathonsByIds` (`features/marathons/use-marathons.ts`), which subscribes to each marathon **individually** rather than running one broad collection query — Firestore rejects a query whose security rule depends on document data not present in the query's own filters (it can't prove every possible result is readable), but a direct single-doc read is evaluated per-document and works fine. `RegistrationWizard.tsx` (used both from the timeline's "Action needed" banner and from this page) walks through up to three steps driven by `getPendingActionStep()`: terms → questionnaire (if the marathon has one) → payment.

UI components in `src/components/ui/` are shadcn/ui (`components.json`: style `new-york`, Tailwind v4 with CSS variables, no `tailwind.config` — tokens live in `src/index.css`). Path alias `@/*` → `src/*` (`vite.config.ts`, `tsconfig.app.json`).

PWA: injected-manifest service worker (`src/sw.ts`, built via `vite-plugin-pwa`), theme color `#141a26`. Push notifications (`src/firebase/messaging.ts`) are opt-in and silently no-op if unsupported or no VAPID key is configured.
