# Grasrotandelen Auto-oppdatering

## Oversikt

Denne mappen inneholder scripts for automatisk oppdatering av Grasrotandelen-data på fagerborgbk.no.

Siden Norsk Tipping sin statistikk-side er en React SPA som krever JavaScript-rendering, kan ikke dataene hentes direkte fra en Supabase Edge Function. I stedet bruker vi GitHub Actions med Playwright for å scrape dataene ukentlig.

## Arkitektur

```
┌─────────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│  GitHub Actions     │────▶│  Playwright Script   │────▶│  Edge Function      │
│  (Cron: Ukentlig)   │     │  (Node.js)           │     │  /grasrot-upsert    │
└─────────────────────┘     └──────────────────────┘     └─────────────────────┘
                                     │                            │
                                     ▼                            ▼
                            ┌──────────────────────┐     ┌─────────────────────┐
                            │  Norsk Tipping       │     │  Supabase Database  │
                            │  (React SPA)         │     │  grasrot_yearly     │
                            └──────────────────────┘     └─────────────────────┘
```

## Oppsett

### 1. GitHub Secrets

Legg til følgende secrets i ditt GitHub repository:

- `SUPABASE_PROJECT_URL`: Din Supabase prosjekt-URL (f.eks. `https://elvltuhjskdgboshavdx.supabase.co`)
- `GRASROT_UPSERT_SECRET`: Samme secret som er konfigurert i Supabase Edge Function

### 2. Kopier workflow-filen

Kopier `.github/workflows/grasrot-scraper.yml` til ditt repository.

### 3. Installer avhengigheter

Scripts-mappen inneholder et Node.js script som krever:

```bash
cd scripts/grasrot-scraper
npm install
```

## Filer

- `scraper.mjs` - Playwright script som scraper Norsk Tipping
- `package.json` - Avhengigheter for scriptet

## Manuell kjøring

Du kan kjøre scriptet manuelt for testing:

```bash
cd scripts/grasrot-scraper
npm install
SUPABASE_URL="https://elvltuhjskdgboshavdx.supabase.co" \
GRASROT_UPSERT_SECRET="din-secret-her" \
node scraper.mjs
```

## Feilsøking

### Vanlige problemer

1. **401 Unauthorized**: Sjekk at `GRASROT_UPSERT_SECRET` er riktig konfigurert både i GitHub Secrets og Supabase.

2. **Ingen data funnet**: Norsk Tipping kan ha endret HTML-strukturen. Sjekk `scraper.mjs` og oppdater CSS-selectors.

3. **Timeout**: Øk timeout i Playwright-konfigurasjonen om siden er treg.

### Logginspeksjon

- GitHub Actions logger: Se under "Actions" fanen i GitHub
- Edge Function logger: Tilgjengelig i Supabase Dashboard → Edge Functions → Logs

## Vedlikehold

Scriptet er avhengig av HTML-strukturen på Norsk Tipping sin side. Om dataene slutter å oppdateres:

1. Besøk https://www.norsk-tipping.no/grasrotandelen/statistikk/iframe/996145530
2. Inspiser elementene for beløp og år
3. Oppdater CSS-selectors i `scraper.mjs`
