import Header from '@/components/Header';
import Seo from '@/components/Seo';
import Footer from '@/components/Footer';

const Privacy = () => {
  return (
    <div className="min-h-screen bg-page-gradient">
      <Seo
        title="Personvernerklæring | Fagerborg BK"
        description="Slik behandler Fagerborg BK personopplysninger om medlemmer og besøkende, og hvilke rettigheter du har."
        path="/personvern"
      />
      <Header />
      <main className="container mx-auto max-w-3xl px-4 pt-28 pb-16">
        <h1 className="text-3xl font-bold mb-8">Personvernerklæring</h1>

        <div className="prose prose-sm max-w-none text-foreground space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. Behandlingsansvarlig</h2>
            <p className="text-muted-foreground">
              Fagerborg BK (org.nr. 996 145 530) er behandlingsansvarlig for personopplysninger
              som samles inn via denne nettsiden.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Hvilke opplysninger vi samler inn</h2>
            <p className="text-muted-foreground">Vi kan samle inn følgende opplysninger:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Navn, e-post, telefonnummer og adresse ved medlemsregistrering</li>
              <li>E-postadresse ved bruk av kontaktskjema</li>
              <li>Teknisk informasjon som IP-adresse og nettlesertype via informasjonskapsler</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Formål med behandlingen</h2>
            <p className="text-muted-foreground">Opplysningene brukes til å:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Administrere medlemskap i klubben</li>
              <li>Besvare henvendelser via kontaktskjema</li>
              <li>Informere om klubbens aktiviteter</li>
              <li>Forbedre nettsiden og brukeropplevelsen</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Deling av opplysninger</h2>
            <p className="text-muted-foreground">
              Vi deler ikke personopplysninger med tredjeparter, med mindre det er nødvendig
              for å oppfylle våre forpliktelser (f.eks. rapportering til Norges Fotballforbund).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Dine rettigheter</h2>
            <p className="text-muted-foreground">
              Du har rett til innsyn, retting og sletting av dine personopplysninger.
              Kontakt oss på <a href="mailto:post@fagerborgbk.no" className="text-primary hover:underline">post@fagerborgbk.no</a> for
              å utøve dine rettigheter.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Informasjonskapsler</h2>
            <p className="text-muted-foreground">
              Nettsiden bruker nødvendige informasjonskapsler for å sikre grunnleggende funksjonalitet.
              Vi bruker ikke sporingskapsler eller annonsekapsler.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Kontakt</h2>
            <p className="text-muted-foreground">
              Spørsmål om personvern kan rettes til{' '}
              <a href="mailto:post@fagerborgbk.no" className="text-primary hover:underline">post@fagerborgbk.no</a>.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Privacy;
