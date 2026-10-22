export type PaymentChoice = 'annual' | 'quarterly' | 'monthly';
export function paymentPlan(membership: number, training: number, choice: PaymentChoice, membershipDue: string, firstDue: string) {
  if (![membership, training].every(n => Number.isSafeInteger(n) && n >= 0)) throw new Error('Ugyldige beløp');
  const count = choice === 'annual' ? 1 : choice === 'quarterly' ? 4 : 12;
  const start = new Date(`${firstDue}T12:00:00Z`);
  const year = start.getUTCFullYear();
  const membershipDate = new Date(`${membershipDue}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(firstDue) || !/^\d{4}-\d{2}-\d{2}$/.test(membershipDue) || Number.isNaN(start.getTime()) || Number.isNaN(membershipDate.getTime()) || start.toISOString().slice(0,10)!==firstDue || membershipDate.toISOString().slice(0,10)!==membershipDue || membershipDate.getUTCFullYear()!==year) throw new Error('Ugyldige forfallsdatoer');
  const payments = [{ kind: 'membership', amount_ore: membership, due: membershipDue }];
  for (let i = 0; i < count; i++) {
    const month = start.getUTCMonth() + i * (choice === 'quarterly' ? 3 : 1);
    const date = new Date(Date.UTC(start.getUTCFullYear(), month, 1, 12));
    const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    date.setUTCDate(Math.min(start.getUTCDate(), last));
    if (date.getUTCFullYear() !== year) throw new Error(`Alle avdrag må ha forfall i ${year}`);
    payments.push({ kind: 'training', amount_ore: Math.floor(training / count) + (i < training % count ? 1 : 0), due: date.toISOString().slice(0, 10) });
  }
  return { choice, total_ore: membership + training, payments };
}
export function canSendPackage(settings: { fees_confirmed: boolean; legal_reviewed: boolean }, agreement: { status: string; body: string } | null) {
  return settings.fees_confirmed && settings.legal_reviewed && agreement?.status === 'ready' && !/\[UAVKLART\]/.test(agreement.body);
}
export function assertPlayerAccess(status: string, validInvitation: boolean) {
  if (status !== 'approved' || !validInvitation) throw new Error('Invitasjonen er ugyldig eller utløpt');
}
export const attendanceRule = { minimumPercent: 70, period: 'calendar_month', adaptedTrainingCounts: true, injuryAutomaticExemption: false, automaticFine: false } as const;