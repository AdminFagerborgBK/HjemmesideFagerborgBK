import Header from '@/components/Header';
import Seo from '@/components/Seo';
import Footer from '@/components/Footer';

const Terms = () => {
  return (
    <div className="min-h-screen bg-page-gradient">
      <Seo
        title="Vilkår for bruk | Fagerborg BK"
        description="Vilkårene for bruk av Fagerborg BK sine nettsider, medlemstjenester og direktesendinger."
        path="/vilkar"
      />
      <Header />
      <main className="container mx-auto max-w-3xl px-4 pt-28 pb-16">
        <h1 className="text-3xl font-bold mb-8">Vilkår for bruk</h1>

        <div className="prose prose-sm max-w-none text-foreground space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. Generelt</h2>
            <p className="text-muted-foreground">
              Disse vilkårene gjelder for bruk av nettsiden til Fagerborg BK (org.nr. 996 145 530).
              Ved å bruke nettsiden aksepterer du disse vilkårene.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Innhold</h2>
            <p className="text-muted-foreground">
              Alt innhold på nettsiden, inkludert tekst, bilder, logoer og videoer, er eid av
              Fagerborg BK eller brukt med tillatelse. Innholdet kan ikke kopieres eller
              distribueres uten skriftlig samtykke.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Medlemskap</h2>
            <p className="text-muted-foreground">
              Ved innmelding i klubben via nettsiden forplikter du deg til å gi korrekte
              opplysninger. Medlemskapet reguleres av klubbens vedtekter og Norges
              Fotballforbunds regelverk.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Ansvarsbegrensning</h2>
            <p className="text-muted-foreground">
              Fagerborg BK er ikke ansvarlig for eventuelle feil eller mangler i
              informasjonen på nettsiden. Vi forbeholder oss retten til å endre innholdet
              uten varsel.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Lenker til tredjeparter</h2>
            <p className="text-muted-foreground">
              Nettsiden kan inneholde lenker til eksterne nettsteder. Vi er ikke ansvarlige
              for innholdet på eller personvernpraksisen til disse nettstedene.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Endringer</h2>
            <p className="text-muted-foreground">
              Vi forbeholder oss retten til å oppdatere disse vilkårene. Endringer trer i
              kraft ved publisering på nettsiden.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Kontakt</h2>
            <p className="text-muted-foreground">
              Spørsmål om vilkårene kan rettes til{' '}
              <a href="mailto:post@fagerborgbk.no" className="text-primary hover:underline">post@fagerborgbk.no</a>.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Terms;
