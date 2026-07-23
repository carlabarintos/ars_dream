# Firebase Cost Forecast — Proof of Payment & App Usage

Assumptions: under 100 new registrations/month across all marathon packages, each including one proof-of-payment upload (photo or PDF).

## Plan requirement

The app cannot run on the Spark (free) plan. `functions/src/` deploys 2nd-gen Cloud Functions (`acceptRegistration`, `confirmPayment`, the `onRegistrationStatusChange` trigger), which are built on Cloud Run — Firebase requires a linked billing account (Blaze) to deploy these at all, independent of how much they're actually invoked. Budgeting should assume Blaze from day one.

## Estimated monthly cost at current volume

Blaze still includes the same free quota as Spark before anything is billed. At under 100 registrations/month, usage stays inside that free tier almost entirely:

| Service | Estimated monthly usage | Free tier | Cost |
|---|---|---|---|
| Firestore writes | ~100 regs × ~4 status writes ≈ 400 | 20K/day (~600K/mo) | $0 |
| Firestore reads | Listeners for ~100 users + admin views, low thousands | 50K/day (~1.5M/mo) | $0 |
| Storage (uploads) | ~100 files × ~2MB (phone photo) ≈ 200MB added/mo | 5GB stored total | $0 |
| Storage (egress) | Admins reviewing images, ~200MB/mo reads | 1GB/day (~30GB/mo) | $0 |
| Functions invocations | ~200–300 calls/mo (accept + confirm per registration) | 2M/mo free | $0 |
| Functions compute | Negligible at this call volume | 400K GB-s / 200K CPU-s free | $0 |
| Hosting | Static PWA assets, low traffic | 10GB storage / 360MB/day free | $0 |

**Net estimate: $0–$1/month.** The only real charges seen on a bill at this scale are small, non-recurring Cloud Build/Artifact Registry costs (cents) each time `functions` are redeployed — not a function of usage.

## What would move the estimate

- **Registration volume**: moving from "under 100" into the hundreds or thousands per month would start consuming meaningful chunks of the Firestore read/write and Functions invocation quotas — worth re-forecasting if growth is expected.
- **Upload size**: the estimate assumes ~2MB per proof-of-payment file. A raw phone-camera photo can run 5–10MB uncompressed; no client-side compression currently happens before upload (`submitProofOfPayment` in `src/features/registrations/api.ts`), so real files may be larger than assumed.
- **Storage retention**: there is no lifecycle/cleanup policy on `proof-of-payment/{registrationId}/{fileName}` — files accumulate indefinitely. At ~200MB/month even with zero cleanup it would take roughly 2 years to approach the 5GB free Storage cap, so not an immediate concern, but worth revisiting if volume grows.

*Estimated 2026-07-23. Firebase pricing and free-tier thresholds are subject to change — treat these as directional, not contractual.*
