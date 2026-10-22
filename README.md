# Fagerborg BK

## Handover and season configuration

The app uses React/Vite and Lovable Cloud. `AGENTS.md` defines invariants; `roadmap.md` lists unverified or externally blocked handover tasks.

### Activate a season

1. Create the new `sports_seasons` row through the existing Cloud data editor, with `is_active=false`, the season year, `timezone=Europe/Oslo`, and exactly two teams. Each team requires `team`, `tournament_id`, `team_id`, `expected_teams`, `league`, and `club_name`. Obtain the actual IDs/counts from fotball.no; never copy them blindly from the previous season.
2. Set the old season inactive and the new one active. Only one active row is allowed. Retain old rows for historical invoice previews.
3. Replace `public/sports-season.json` with the matching configuration and synchronize it to GitHub. It is the public versioned mirror for change-gated source checks. Backend sync rejects mismatches as internal errors. No backend calls occur when the calendar and configuration fingerprints are unchanged.
4. Run Sports Data Sync with `force=true`, verify standings counts, both calendars and clean sync status. The first fingerprint includes the new configuration.
5. Goal-club entries do not renew: new entries use the active season; old entries and invoices remain attached to their original season. Player enrollment uses its separate agreement settings and remains blocked until fees/legal approval are recorded.

### Invitation delivery

Tokens are generated only in memory; the database retains SHA-256 hashes. Existing emailed links remain valid after removing plaintext. Resend explicitly revokes the previous invitation and generates a new token. If a worker stops before/after email delivery, do not silently retry from a stored token: inspect provider logs, then deliberately reissue. Provider idempotency protects one invitation's send attempt. Test-link issuance rotates a test invitation without emailing a production recipient.

### Rebuilding

Use `bun install --frozen-lockfile` and `bun run build`; `bun.lock` is authoritative. Never export `.env`, dependencies, build output, private metadata or Python caches. Existing Supabase migrations and later Drizzle migrations are both required, in their own chronological histories; then execute `scripts/setup/sports-season-seed.sql` once to bootstrap an empty configuration without changing existing settings. Git sync alone neither applies Cloud migrations nor deploys functions. A fresh rebuild and GitHub checkout are not verified until the roadmap records their evidence.

## Operations and safe recovery

Project: https://lovable.dev/projects/c8e1877c-4d90-4ea9-b9a9-92c784fb24b1
Published site: https://fagerborgbk.no
Repository: https://github.com/AdminFagerborgBK/HjemmesideFagerborgBK

GitHub Actions requires existing secrets named `SUPABASE_PROJECT_URL`, `MATCHES_SYNC_SECRET`, and `GRASROT_UPSERT_SECRET`; never commit their values. The monthly newsletter currently reuses `MATCHES_SYNC_SECRET`. Dedicated newsletter credentials require a coordinated server/workflow change, not removal from one side alone. Preserve Sports `0 */3 * * *`, Grasrot `7 12 * * *`, weekly maintenance and monthly newsletter. Database `cron.job` must remain empty in normal operation.

Never dispatch the monthly newsletter workflow to test it: it sends to the real list. Use the signed-in administrator's test recipient, count-only reads and injected tests. Signed preference links expire; legacy ID/email links no longer authorize changes and direct members to contact the club. If a campaign is `sending` or `partial`, inspect recipient intents and provider outcomes before deliberately recovering; do not blindly reset delivery state.

Goal-club invoices are atomically claimed before provider delivery. Interrupted or uncertain `sending` rows are blocked; reconcile provider outcomes before changing state. Definite rejection can be retried. A bank message reference is not a bank-approved KID; KID/DNB automation requires the club's bank agreement.

The separate player project is https://lovable.dev/projects/c03d7dcc-2465-440d-9038-10741bcf8fac at https://spiller.fagerborgbk.no. Its inspected `my-agreement` caller still requires a personal link and does not send the club's server-only shared key for automatic confirmed-email lookup. Implementation and authenticated verification must continue in that project; do not move its domain here.

Board decisions: 2027 fees/due dates, legal approval of the player agreement, and supported bank/Spond access. Self-confirmation never establishes verified payment or playing eligibility.

Apply ALL `supabase/migrations` before ANY `drizzle/migrations`, then the sports seed. A generic empty PostgreSQL database is not a managed Cloud baseline: auth/storage plus pg_cron/pg_net must exist. `scripts/setup/replay-schema.mjs` verifies application-schema construction using explicitly inert platform/crypto stubs; it does not verify managed extension behavior or cryptography. Frontend builds need deployment-specific public environment values, excluded from GitHub.

Publishing the frontend remains a separate explicit action. Backend migrations and function deployments already affect the published site. See `handover-verification.md` for dated evidence and remaining checks.
