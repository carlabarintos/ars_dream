# Deployment

ARS Dream deploys entirely to Firebase — Hosting for the built PWA, Cloud Functions for the
server-side registration/payment logic, Firestore + Storage for data. There is no separate
backend host; `firebase.json` at the repo root already defines all four targets.

Deploys are **manual CLI deploys** (no CI/CD) — run by hand from a dev machine once logged in
via `firebase login`. This doc also assumes the default `*.web.app` / `*.firebaseapp.com` URL;
a custom domain (e.g. `arsdreamsports.com`) can be attached later via Hosting → Add custom domain,
which is a DNS change and isn't covered here.

## One-time project setup

The repo currently only has a `demo-ars-dream` project alias in `.firebaserc`, which is an
emulator-only pseudo-project (the `demo-` prefix means the Firebase CLI never talks to real
GCP for it). Production needs a real project, created once:

1. **Log in**: `firebase login` (interactive/browser — must be run by a human, not scripted).
2. **Create the project**: `firebase projects:create <project-id> --display-name "ARS Dream"`
   (project ID must be globally unique across all of Firebase/GCP).
3. **Upgrade to the Blaze plan** (pay-as-you-go) in the console — required for Cloud Functions.
   This is a billing commitment, so do it via console (Project Settings → Usage and billing),
   not the CLI.
4. **Enable services**, all in the Firebase console for the new project:
   - **Authentication** → enable **Email/Password** and **Google** providers (both are used by
     `src/features/auth/auth-actions.ts`).
   - **Firestore** → create database in production mode, pick a region (e.g.
     `asia-southeast1` for Manila-local latency).
   - **Storage** → create the default bucket.
   - **Cloud Messaging** → generate a Web Push certificate (VAPID key) under Project Settings →
     Cloud Messaging → Web configuration. Push notifications are opt-in and silently no-op if
     this is left unset (`src/firebase/messaging.ts`), so it can be added later without a
     redeploy blocking on it.
   - **Web app registration** → Project Settings → add a Web App to get the
     `VITE_FIREBASE_*` config values used below.
   - **App Check** → App Check → register the web app with the **reCAPTCHA v3**
     provider, which gives you a site key for `VITE_FIREBASE_RECAPTCHA_SITE_KEY`
     below. This protects the `acceptRegistration`/`confirmPayment` callables
     from scripted abuse (`enforceAppCheck: true` in `functions/src/`). It's
     skipped automatically against the emulators and silently no-ops if the
     site key is left blank, so it can be added after the first deploy without
     blocking it — but should be filled in before real registrants start using
     the app, since both callables sit on the payment-confirmation path.
5. **Add a `production` alias** in `.firebaserc` alongside `default`, pointing at the new
   project ID, so `firebase use production` targets it without touching the emulator config
   used by `npm run emulators`.

## Environment config

Copy `.env.example` to `.env` (or a Vite-mode-specific `.env.production`) and fill in the real
values from the web app registration step above:

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_VAPID_KEY=
VITE_FIREBASE_RECAPTCHA_SITE_KEY=
VITE_USE_FIREBASE_EMULATORS=false
```

`VITE_USE_FIREBASE_EMULATORS` must be `false` (or unset) for a production build — otherwise
`src/firebase/config.ts` points the client at `127.0.0.1` emulator ports.

## Deploy order

Rules and indexes go out before functions, and functions before hosting, so the app is never
briefly pointed at endpoints/rules that don't exist yet:

```bash
firebase use production

# 1. Firestore + Storage security rules and indexes
firebase deploy --only firestore:rules,firestore:indexes,storage

# 2. Cloud Functions (acceptRegistration, confirmPayment, notification triggers)
firebase deploy --only functions

# 3. Hosting (the built PWA)
npm run build
firebase deploy --only hosting
```

For a first deploy, all three can also be combined into one `firebase deploy` once
`firebase use production` is set — the ordering above mainly matters for later updates where
rules or function signatures change alongside client code.

## Bootstrap the first admin

Firestore rules only let a user self-create their profile with `role: 'user'`; only an existing
admin can promote another user (see `firestore.rules` and `CLAUDE.md`). The first admin has to
be set directly with `firebase-admin`, bypassing rules:

1. Sign up normally in the deployed app with the account that should become admin.
2. Download a service account key for the production project (console → Project Settings →
   Service Accounts → Generate new private key).
3. Run:
   ```
   GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json node scripts/set-admin.mjs --email you@example.com --prod
   ```

## Post-deploy smoke test

Before any real registrant uses the deployed app, walk one registration through the full
pipeline against production:

1. Sign up as a normal user, sign in as the promoted admin in a second session/browser.
2. Create/publish a marathon as admin.
3. Register as the normal user → admin accepts → user accepts terms → (fills questionnaire, if
   the marathon has one) → submits payment → admin confirms.
4. Confirm `marathons.confirmedCount` incremented and the user received a status-change
   notification (if push was set up) or at least see the status change live via `onSnapshot`.

## Notes / things intentionally deferred

- **No CI/CD** — deploys are manual `firebase deploy` runs. Setting up GitHub Actions would
  first require putting this directory under git and pushing it to a remote, which hasn't
  happened yet.
- **No custom domain yet** — shipping on the default Firebase Hosting URL first; attaching
  `arsdreamsports.com` (or a subdomain) is a separate DNS-dependent step for later.
