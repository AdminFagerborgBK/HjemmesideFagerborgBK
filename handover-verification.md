# Handover verification — 22 October 2026

## Confirmed

- Vitest: 21 passed. Node sports/invoice/newsletter/matches tests: 36 passed. Python fingerprint: 9 passed. Deno sports/goal-club/Instagram tests: 37 passed.
- Full application-schema replay: all 89 Supabase migrations, all 20 Drizzle migrations through `0019`, then sports seed succeeded in disposable PGlite. Run `node scripts/setup/replay-schema.mjs`. Managed auth/storage, scheduling, network and crypto APIs are explicitly inert stubs: this is schema verification, not proof of actual platform extensions or cryptography.
- Live database: 40 public tables; all have RLS enabled. Standings A 12 / B 10 for 2026. Division 205403 has 132 rows; 205410 has 90 rows. All four sports/Grasrot sync-status errors are clear. `cron.job=0`; stored plaintext invitation tokens=0; real goal-club invoices=0 and closures=0.
- `reschedule_scheduled_publish()` and `claim_goal_club_invoice(uuid)` deny authenticated execution; invoice claim permits service_role only. Instagram cache/OAuth states and player invitations remain non-public.
- Safe actual GitHub runs on commit `08d0bfc8e3a4b0bef96430e6f640e8f9bf111f47`: Sports [39789734697](https://github.com/AdminFagerborgBK/HjemmesideFagerborgBK/actions/runs/39789734697), Matches [39789791288](https://github.com/AdminFagerborgBK/HjemmesideFagerborgBK/actions/runs/39789791288), Grasrot [39802529109](https://github.com/AdminFagerborgBK/HjemmesideFagerborgBK/actions/runs/39802529109), all `success`. Sports and Matches accept `force=true`; Grasrot does not declare a force input.
- That commit's 445 source blobs matched the local export exactly; actual GitHub fresh checkout installed 555 packages with frozen Bun lock and built successfully. Final follow-up source sync/build evidence must be checked separately below.
- Final local browser check: homepage rendered; full standings had no horizontal overflow at 320, 390 and 1280 px. Auth/private routes noindex. Admin invoice dialog rendered and correctly said the season is provisional. Facebook health and newsletter count-only returned 200, with no token/prefix in health response. Invalid newsletter token returned 403; page showed expiry/help text and removed URL fragment. No page errors.
- Player invitation/private-PDF/rotated-link checks previously passed; no raw token persisted. Published player login at `spiller.fagerborgbk.no/auth` renders.
- Google Search Console: `https://fagerborgbk.no/` verified and added as siteOwner using the already-published META tag. Sitemap submitted and fetched 22 October 15:25 UTC: 17 URLs, 0 errors, 0 warnings. This does not prove all pages are indexed. No additional publish was needed.

## Latest deployed function source hashes

| Function | Submitted source SHA-256 |
|---|---|
| goal-club-season-close | cb346695b4dfafc3b935ede332ef7d12a2db05f182a237e91d3c1ad00dcfd194 |
| send-newsletter | ad62fb217c780630b63d6a1177f7da73b7ebe6bab40d795a059a5e69bbcd0d62 |
| facebook-token-health | 83ba5e0af0ab52161b2f2798da96d6f9a6d455bece9dbdafbc8389a9da89af0f |
| newsletter-preferences | bd46054d0d8d5e7953962c1b99726e98e95029197f9a012ccb2a0faec180117e |
| newsletter-unsubscribe | ba50c52ba8046e4c0d9e5f3493c239cc7b643b9500e00d3df4b0c7d7cdfdedca |

Live preview/count-only/invalid-token checks confirm relevant behavior; deploy hashes are submitted source fingerprints, not independently downloaded live bundles.

## Deliberate source export exclusions

`.env` and secrets, Git metadata, workspace/private project memory, dependencies, generated builds, Python caches, temporary files and downloaded archives. `bun.lock` is authoritative; stale `package-lock.json` and Deno's auto-generated workspace lock are excluded. Public assets, functions, both migration histories and journals/snapshots, tests, workflows and source configuration are included. Existing sports schedules/workflows were not changed by the security follow-up.

## Still not a completed handover

- Separate player portal requires its `my-agreement` server caller to support verified-email lookup with the club's server-only shared key. The inspected portal still requires a personal token and sends no shared key. Its authenticated automatic flow is not verified; implement/test in that project.
- 2027 player agreement remains a draft until board-confirmed fees/dates and legal approval. Spond/DNB/KID automation needs supported access and a bank agreement. Current invoice reference is a message reference, not a validated bank KID.
- Captcha blocks the localhost test origin; public application submission/approval has not been fully exercised on the published host. No security bypass was added.
- No real newsletter or goal-club invoices were sent. Newsletter test delivery currently checks an admin-only recipient but uses non-personal test footer links; a real signed-link preference update must be tested with a controlled subscribed record before declaring the complete newsletter flow verified.
- Newsletter cron currently reuses the configured sports secret. Dedicated credential separation needs coordinated setup in Cloud and GitHub; existing schedules are preserved.
- Large initial chunk warning (~813.58 kB before final follow-up) remains; route lazy loading is present, but homepage/shared code remains substantial. Dynamic article sitemap entries are not automatically maintained.
- An actual managed Cloud fresh reset/preview branch was not performed; PGlite schema replay does not validate real managed auth/storage/cron/net behavior. Frontend changes are not published by this task.
- Unknown provider outcomes remain intentionally blocked for manual reconciliation rather than silently retried; see README recovery rules.