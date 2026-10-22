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
- No real newsletter or goal-club invoices were sent. The actual newsletter HTTP handlers now pass an isolated in-memory flow: signed own-member preference lookup/update, strict invalid-input rejection, opt-out filtering, admin-only test-send, disabled test-footer links, sanitized provider rejection and blocked replay. This does not replace a production signup/captcha and real signed-link browser update check.
- Newsletter cron currently reuses the configured sports secret. Dedicated credential separation needs coordinated setup in Cloud and GitHub; existing schedules are preserved.
- Large initial chunk warning (~813.58 kB before final follow-up) remains; route lazy loading is present, but homepage/shared code remains substantial. Dynamic article sitemap entries are not automatically maintained.
- An actual managed Cloud fresh reset/preview branch was not performed; PGlite schema replay does not validate real managed auth/storage/cron/net behavior. Frontend changes are not published by this task.
- Unknown provider outcomes remain intentionally blocked for manual reconciliation rather than silently retried; see README recovery rules.

## Security follow-up — 22 October, after 15:52 UTC

- `newsletter-preferences` requires an explicit boolean and known interests; malformed input cannot opt a member back in. Optional audit failure no longer reports failure after a completed preference update.
- Newsletter completion audit failure no longer reports failed delivery after persisted completion. Provider rejection text is not persisted or returned; interrupted/partial sends stay blocked.
- `facebook-post` and `facebook-token-health` no longer log raw provider errors/exceptions or return provider error bodies. Story failure remains non-blocking for the successful main post.
- Four affected functions deployed successfully. Submitted SHA-256: preferences `6f628a9626ee2211729de135f2d29a68256667715d03b00b5f258b99566b8190`, send `058dfa479e6971c0c3d08eaa775d243ac3d9635e695007a15da0eb2be39dc3b5`, Facebook post `43883c760ea0f71feb4ec5cf88a48d35bc12657c8459232ae8ff110255378d8c`, Facebook health `70e7b61bce140d6f752297d1748ea3a620c50b9e2fb03f2ee19c53f3c6488e63`.
- Tests this round: all 22 Vitest cases; 22 Node sports tests; 10 targeted Deno preference/goal-club cases; 3 actual-handler tests via `bun test scripts/sports-tests/newsletter-handler.test.ts`. All pass. Four changed Edge entrypoints pass Deno checks. Full disposable schema replay passes again.
- Browser: desktop homepage rendered, full standings at 320/390 had no horizontal overflow; requesting user's authenticated admin newsletter page rendered. Live Facebook health and newsletter count-only returned 200; invalid preference token returned 403; Instagram auth callback correctly rendered noindex/nofollow. No page errors.
- Fresh read-only DB audit: cron=0, invoices=0, closures=0, plaintext invitation tokens=0, tables without RLS=0; standings 12 A + 10 B; division calendars 132 + 90; all sync errors clear.
- SEO audit correction: `/auth/instagram-callback` was already covered by the private route regex; no route change was needed. `noindex, follow` on a 404 is intentional and not a security flaw. Page-level Twitter card added. Hero animation code deferred with a size-matched fallback; emitted-size comparison pending fresh GitHub checkout.
- Automatic player lookup is still missing in the read-only snapshot of the separate portal. The club cannot change that project from this chat; a matching server-side portal change remains required.