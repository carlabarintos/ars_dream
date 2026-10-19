# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

ARS Dream is a Firebase-backed React PWA for a real Manila-based marathon-tourism company (arsdreamsports.com) serving clients nationwide across the Philippines — it's the digital registration/queue system for their international marathon tour packages (New York, Berlin, London, Tokyo, Sydney), not a generic fun-run app. Copy and flows should reflect an actual travel-agency booking process: limited-capacity tour packages, a queue → acceptance → payment pipeline, not instant signup. Marketing copy should present the company's reach/audience as Philippines-wide (not Manila-only), while the company's HQ/registered address remains Manila.

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

- **Google sign-in is currently removed from the app** (as of 2026-07-24) — `signInWithGoogle`/`GoogleAuthProvider` (formerly in `src/features/auth/auth-actions.ts`) and the "Continue with Google" button (formerly in `SignInPage.tsx`) were pulled; email/password is the only sign-in method right now. Re-adding it later needs: Firebase Console → Authentication → Sign-in method → enable "Google" with a support email; Authentication → Settings → Authorized domains including `arsdreamsports.com`/`www.arsdreamsports.com`; the OAuth consent screen (Google Cloud Console) out of "Testing" mode; and the auto-created "Web client" OAuth credential listing `https://arsdreamsports.com` under Authorized JavaScript origins.
- **Password reset emails need a Console setting to land on our own page instead of Firebase's default one.** `requestPasswordReset` (`src/features/auth/auth-actions.ts`) sends the standard reset email, and `ResetPasswordPage.tsx` (route `/reset-password`) is a self-hosted handler that verifies the `oobCode` and completes the reset in-app. That handler only receives the click if Firebase Console → Authentication → Templates → Password reset → "customize action URL" is set to `https://arsdreamsports.com/reset-password`; until that's done, links open Firebase's generic hosted page instead (functionally fine, just off-brand). The local Auth emulator has no equivalent setting — reset links there always open the emulator's own built-in `/emulator/action` page (confirmed by inspecting emulator-generated oobLinks directly), so exercising `ResetPasswordPage.tsx` locally means copying the `oobCode` from the Emulator UI's Auth tab (or the emulator's oobCodes REST endpoint) into a manually-built `http://localhost:<port>/reset-password?oobCode=...` URL rather than clicking the emailed link.

#### Deploying via GitHub Actions

Real production project is `arsdream-1f00f` (not aliased in `.firebaserc`, which still only defines the local `demo-ars-dream` project — production deploys pass `--project arsdream-1f00f` directly). `.github/workflows/deploy.yml` runs automatically on every push to `main` (as well as manual `workflow_dispatch`), against the `prd` GitHub environment, with three jobs: `build` (lint + `tsc -b`/`vite build`, `VITE_FIREBASE_*` secrets incl. `VITE_FIREBASE_RECAPTCHA_SITE_KEY` injected as build-time env vars), `deploy_hosting`, and `deploy_backend` (`firebase deploy --only functions,firestore:rules,firestore:indexes,storage --force`). A `deploy-prd` concurrency group serializes runs so overlapping pushes can't race each other to production.

Two gotchas hit in production that are worth knowing before touching this area again:

- **Cloud Functions region must match on both ends.** `functions/src/index.ts` pins `setGlobalOptions({ region: 'asia-southeast1' })`, so the client must call `getFunctions(app, 'asia-southeast1')` (`src/firebase/config.ts`) — not the bare `getFunctions(app)`, which defaults to `us-central1`. A mismatch doesn't 404 cleanly; the browser reports it as a CORS failure ("no Access-Control-Allow-Origin header") because the request never reaches a function that can attach CORS headers, which is a very misleading symptom pointing away from the real cause.
- **App Check reCAPTCHA key must be a classic v3 key, not a reCAPTCHA Enterprise key.** `acceptRegistration`/`confirmPayment` set `enforceAppCheck: true` in every deployed environment, and the client uses `ReCaptchaV3Provider` (`src/firebase/config.ts`). A key created via Google Cloud Console's reCAPTCHA Enterprise page (`console.cloud.google.com/security/recaptcha`) — even one labeled "v3" / "score-based" — is a different product and won't validate; it also tends to sit in "Incomplete" status. The working key must come from the legacy console at `google.com/recaptcha/admin/create` (type "reCAPTCHA v3"), with its **site key** (never the secret key) set in both the `VITE_FIREBASE_RECAPTCHA_SITE_KEY` GitHub secret and Firebase Console → App Check → the web app's reCAPTCHA v3 provider — both must match exactly. A wrong/incomplete key surfaces client-side as a 400 `INVALID_ARGUMENT` ("Invalid reCAPTCHA configuration for app: ...") from the App Check token-exchange call, then as a 401 `UNAUTHENTICATED` on the callable itself — easy to mistake for the CORS/region issue above since both first appear as failed cross-origin requests in the console.

## Architecture

### Data model & status pipelines

Three Firestore collections, typed in `src/types/index.ts`, rules enforced in `firestore.rules`:

- **`users/{uid}`** — `role: 'user' | 'admin'`. Auto-created on first sign-in by `use-auth-listener.ts` with `role: 'user'`; only an admin (or the bootstrap script) can change `role`.
- **`marathons/{id}`** — a tour package. `status: 'draft' | 'published' | 'closed'`. Non-admins can read any non-`draft` marathon (so a registrant keeps seeing an event's banner/date/payment info on their My Registrations view after it closes); only `published` ones accept new registrations / appear on the timeline. `confirmedCount` is server-maintained via `FieldValue.increment` inside `confirmPayment` — never written by the client. `questions?: MarathonQuestion[]` optionally defines a per-event questionnaire (types: `text` / `textarea` / `select` / `checkbox`), authored via the question builder in `MarathonFormDialog.tsx` — question `id`s are preserved across edits (not regenerated) so existing registrants' answers stay matched to the right question.
- **`registrations/{id}`** — one user's application to one marathon. `status` moves through a fixed pipeline:
  `queued → accepted → terms_accepted → payment_submitted → confirmed` (or `rejected` / `payment_rejected` off the happy path).

  User-facing copy calls `accepted` **Offered** (admin sends an offer; offer email shows an accept-by time of `offeredAt + offerAcceptanceDays` (default 1 day, `getOfferAcceptanceDeadline`) and `depositDueDays`) and `terms_accepted` **Invoiced** (registrant accepted the offer; `onRegistrationStatusChange` sends the invoice email from `buildInvoiceEmail` with package `depositAmount`, a deposit due date of `termsAcceptedAt + depositDueDays` (default 1 day), and `balanceDeadline`). The stored status values were deliberately left unchanged.

  The Firestore rules split write authority by step: a user can move their own registration through `terms_accepted`/`payment_submitted` only (never set admin-controlled outcomes directly), while `queued→accepted/rejected` and `payment_submitted→confirmed/payment_rejected` are **only** done through Cloud Functions callables (`acceptRegistration`, `confirmPayment` in `functions/src/`), because those transitions need server-side capacity checks against `marathons.capacity` that can't be trusted from the client. `src/features/registrations/api.ts` calls these via `httpsCallable`; direct `updateDoc` is used only for the client-safe transitions.

  If the marathon defines `questions`, the registrant must also fill in `answers: QuestionAnswer[]` while still in `terms_accepted`, before payment. This is deliberately **not** a separate `status` value — it's gated purely by data (`getPendingActionStep()` / `isQuestionnaireComplete()` in `src/features/registrations/registration-flow.ts`), since writing `answers` while `status` stays `terms_accepted` is already covered by the existing self-update rule and needs no rules change.

- Registration status changes trigger `onRegistrationStatusChange` (Firestore `onUpdate` trigger), which pushes an FCM notification to the user's stored `fcmTokens` and prunes tokens that bounced.

### Frontend structure

Feature-folder layout under `src/features/{auth,marathons,registrations,admin}/`, each typically with an `api.ts` (Firestore/Functions calls) and `use-*.ts` hooks wrapping `onSnapshot` subscriptions. Global state is Zustand (`auth-store.ts`) for the current user/profile only; TanStack Query is used elsewhere for server-state caching. Routing/guards are in `App.tsx` + `features/auth/RequireAuth.tsx` (`RequireAuth` for signed-in, `RequireAdmin` for `profile.role === 'admin'`, gated on the live Firestore profile, not custom claims).

Primary navigation is a bottom tab bar (`src/components/BottomNav.tsx`) shown whenever signed in — Home / My Bookings / Admin (if admin) — the header (`Layout.tsx`) only carries branding plus the avatar/sign-out menu.

`/my-registrations` (`features/registrations/MyRegistrationsPage.tsx`) lists all of a user's registrations across every marathon regardless of status, including ones on now-closed events. It resolves each registration's marathon via `useMarathonsByIds` (`features/marathons/use-marathons.ts`), which subscribes to each marathon **individually** rather than running one broad collection query — Firestore rejects a query whose security rule depends on document data not present in the query's own filters (it can't prove every possible result is readable), but a direct single-doc read is evaluated per-document and works fine. `RegistrationWizard.tsx` (used both from the timeline's "Action needed" banner and from this page) walks through up to three steps driven by `getPendingActionStep()`: terms → questionnaire (if the marathon has one) → payment.

UI components in `src/components/ui/` are shadcn/ui (`components.json`: style `new-york`, Tailwind v4 with CSS variables, no `tailwind.config` — tokens live in `src/index.css`). Path alias `@/*` → `src/*` (`vite.config.ts`, `tsconfig.app.json`).

PWA: injected-manifest service worker (`src/sw.ts`, built via `vite-plugin-pwa`), theme color `#141a26`. Push notifications (`src/firebase/messaging.ts`) are opt-in and silently no-op if unsupported or no VAPID key is configured.
