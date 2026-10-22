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

## Original project setup reference

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
