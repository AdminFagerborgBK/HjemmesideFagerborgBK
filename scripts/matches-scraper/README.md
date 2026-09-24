# Matches Scraper

Playwright-basert scraper som henter kampterminlisten fra fotball.no for A-laget og B-laget.

## Bruk

```bash
cd scripts/matches-scraper
npm install
npx playwright install chromium

# Sett miljøvariabler
export SUPABASE_URL=https://elvltuhjskdgboshavdx.supabase.co
export MATCHES_SYNC_SECRET=<din secret>

npm run scrape
```

## GitHub Actions

Scraperen kjøres automatisk via GitHub Actions:
- Hver dag kl. 06:00 UTC
- Kan trigges manuelt via workflow_dispatch

## Data

Scraperen henter:
- Dato og klokkeslett
- Hjemme/bortelag
- Kampnummer (fiks_id)
- Bane
- Divisjon
- Resultat (hvis kampen er spilt)

Kampene upserts til `matches`-tabellen i Supabase.
