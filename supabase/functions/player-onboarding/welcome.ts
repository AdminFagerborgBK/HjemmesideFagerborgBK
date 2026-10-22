import { htmlEscape as e } from '../_shared/adminAuth.ts';
export function welcomeHtml(name: string, link: string, snapshot: any, test = false) {
  const payment = snapshot.payment;
  const money = (n: number) => `${(n / 100).toFixed(2)} kr`;
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;background:#ffffff;color:#182d52">
  <img src="https://fagerborgbk.no/images/fagerborg-logo-email.png" width="90" alt="Fagerborg BK"/>
  <h1>${test ? 'TEST – uavklart avtaleutkast' : 'Velkommen til Fagerborg BK!'}</h1><p>Hei ${e(name)},</p>
  <p>${test ? 'Dette er en kontrollert test, ikke en gyldig spilleravtale eller et betalingskrav.' : 'Du er godkjent for '+e(snapshot.team)+'. Fullfør innmeldingen på din personlige side.'}</p>
  <p><a href="${e(link)}" style="display:inline-block;background:#182d52;color:#ffffff;padding:14px 24px;text-decoration:none;border-radius:6px">Din innmeldingsside</a></p>
  <h2>Neste steg</h2><ol><li>Les PDF-avtalen som er vedlagt, og bekreft avtalen uttrykkelig på siden. Dette er ikke BankID-signering eller registrering av NFF-kontrakt.</li>
  <li><a href="${e(snapshot.spond_url)}">Meld deg inn i Spond</a>.</li><li><a href="${e(snapshot.transfer_url)}">Fyll ut og signer overgangssamtykket</a>. Send signert dokument til ${e(snapshot.transfer_contact)} på <a href="mailto:${e(snapshot.transfer_email)}">${e(snapshot.transfer_email)}</a>. Klubben behandler overgangen i FIKS.</li>
  <li>Kontroller og bekreft betalingsordningen. Åpne lenker er ikke bevis på innmelding, overgang eller betaling.</li></ol>
  <h2>Betalingsordning</h2>${payment ? `<p>Årstotal: ${money(payment.total_ore)}. Medlemskontingent betales samlet; bare treningsavgiften fordeles.</p><ul>${payment.payments.map((p:any)=>`<li>${p.kind==='membership'?'Medlemskontingent':'Treningsavgift'}: ${money(p.amount_ore)} – ${e(p.due)}</li>`).join('')}</ul>` : '<p>2027-beløp og datoer er ikke vedtatt. Ingen betalingskrav er opprettet.</p>'}
  <p>Spilleklar status krever bekreftet spilletillatelse fra overgangsansvarlig.</p><p>Med vennlig hilsen<br/><strong>Fagerborg Ballklub</strong></p></div>`;
}