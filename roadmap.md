# Roadmap
- [ ] Utvid eksisterende separat spillerportal på spiller.fagerborgbk.no med egen avtale, avklaringer, søknad og betalingsstatus uten ekstra profil. Blokkert: spillerprosjektet finnes ikke blant tilgjengelige prosjekter i dette arbeidsområdet; byggingen må fortsette i det eksisterende spillerprosjektets chat. Ikke flytt domenet til klubbnettstedet.
- [x] Avtalen sendes før betaling er gjennomført: ingen sperre på ubetalt status; testmail sendt med ubetalt status, gjentatt sending sendte ikke en ny mail.
- [x] Separat spillersøknad, adminbehandling/invitasjon og sikker personlig side med private PDF-er, eksplisitt avtale-/planbekreftelse, egenbekreftet vs manuelt verifisert status og historikk. Desktop/mobil, riktig RSPTA-lenke, private PDF-er, avvist ugyldig invitasjon og admin-tilgang verifisert.
- [x] Originalavtalen bevart privat; separat 2027-utkast med oppmøteregler og uavklart betalings-/NFF-avsnitt. PDF visuelt kontrollert begge sider: ingen overlapping eller klipping funnet.
- [x] Kontrollert velkomstmail med PDF til avtalt testmottaker, leverandør aksepterte utsending; én mail ved gjentatt test. Personlig testside og ny innlasting kontrollert. Ingen betalingskrav opprettet. Ikke publisert.
- [ ] Gyldig 2027-avtale og produksjonstest av avtalebekreftelse/betalingsplan: venter på klubbens vedtatte beløp/datoer og godkjenning av NFF-avtalestatus; utkast kan ikke bekreftes som gyldig avtale.
- [ ] Offentlig søknad gjennom captcha og full godkjenningsflyt: captcha avviser lokal forhåndsvisningsvert; faktisk søknadsinnsending er ikke ende-til-ende-verifisert og ingen usikker testtoken-bypass er lagt til.
- [ ] Spond-krav/DNB-avstemming: ingen aktiv dokumentert integrasjon i prosjektet. Venter på støttet Spond-tilgang og bank-/KID-avtale; manuell oppgave og kildebasert betalingskontroll er tilgjengelig.
- [x] Automatisk Instagram-feed: eksisterende Meta-tilgang verifisert, servercache med seks timers levetid/lås/feil-backoff, tilkoblingsstatus i admin; tre ekte innlegg, bilder, lenker og mobil-sveiping verifisert. Ingen nye cronjobber eller endret Facebook-publisering. Ikke publisert.
- [x] Videoene på forsiden: to og to oppå hverandre på store skjermer, tre i bredden under 1280 px (ikke fire), tre stablet på mobil.
- [x] Erstatt Instagram-profil-innbyggingen med «Rundt laget» (maks tre redaksjonelle kort) og admin-siden /admin/instagram med opplasting, utsnittsjustering, rekkefølge og publisering.
- [x] Skill midlertidige fotball.no-feil fra egne feil i Matches Scraper; verifiser exit-koder, backend-kall, fingerprint og tom cron.job.
- [x] Tilpass full tabell til mobil uten zoom; fjern vridningstips og venstrejuster fargeforklaring uten «Form»; verifiser begge lag.
- [x] scraper.mjs: domcontentloaded + eksplisitt tabell-venting + 2 retries + screenshot ved siste feil
- [x] maintenance.yml: fjernet daglig 06:30 health-check; kun ukentlig 10 5 * * 1 igjen
- [x] Push til GitHub, cron.job tom (0), schedule verifisert, manuell Matches Scraper-test grønn (run 37127853474)

- [x] Supabase Data API grants (30. okt): audit + eksplisitt grant-migrasjon for alle public-tabeller, regel i AGENTS.md, verifiser live DB/GitHub
- [ ] Google Search Console: verifiseringskode lagt inn, venter på publisering -> verify + sitemap

- [ ] Overleveringsherding: ny sikker goal-club-trigger, atomisk 12+10 standings-RPC, begge divisjoner, målrettede tester, live deploy og én force Sports-kjøring med GitHub-verifisering.
