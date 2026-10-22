# Roadmap
- [x] Sluttkontroll 22.10 første runde: 103 tester, 458 GitHub-blobs, fresh checkout/build og grønne Sports 39808649096 / Matches 39808709394 / Grasrot 39808773326 på 7f2e758 verifisert.
- [ ] Ny overleveringsrunde: nyhetsbrevvalg/provider-feil rettet og fire funksjoner deployet; lokal HTTP-nyhetsbrevtest og live admin/lesekontroller bestod. Ny GitHub-kopi/fresh checkout/workflows gjenstår.
- [x] Full overlevering: DST-korrekt lagring og dynamisk sesongkonfigurasjon for backend, frontend og change-gating; ny kontroll og DST/2027-tester bestod.
- [x] Full overlevering: sesongbundet Målklubb og hash-only invitasjoner med sikre eksisterende lenker/resend; DB viser null råtoken, sesongtests bestod.
- [ ] Full overlevering: lazy loading, SEO, mobil/tilgjengelighet, nyhetsbrev, sosiale medier og spillerportal-kontroller.
- [ ] Full overlevering: full GitHub-main-kopi og ren installasjon/build, live RLS/grants/cron, deploys og faktiske safe workflow-kjøringer.
- [ ] Automatisk artikkelsitemap: statisk sitemap dekker offentlige ruter, men ikke nye publiserte artikkelslugs; krever hendelsesdrevet generering uten ny polling.
- [ ] Separat spillerportal: innlogging finnes og bekreftet e-post kontrolleres; automatisk oppslag mangler i portalens my-agreement. Krever endring og innlogget kontroll i spillerprosjektet c03d7dcc-2465-440d-9038-10741bcf8fac; ikke flytt domenet.
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
- [x] Google Search Console: fagerborgbk.no verifisert som siteOwner 22.10; sitemap lest tilbake med 0 feil/varsler og 17 URL-er. Ingen ny publisering nødvendig.

- [x] Overleveringsherding: ny sikker goal-club-trigger, atomisk 12+10 standings-RPC, begge divisjoner, målrettede tester, live deploy og én force Sports-kjøring med GitHub-verifisering.
