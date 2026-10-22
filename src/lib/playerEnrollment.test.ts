import { describe, expect, it } from 'vitest';
import { paymentPlan, canSendPackage, assertPlayerAccess, attendanceRule } from '../../supabase/functions/player-onboarding/policy';
describe('Spillerinnmelding', () => {
  it('har fire avdrag hver tredje måned og korrekt avrunding', () => {
    const p = paymentPlan(50000, 100001, 'quarterly', '2027-02-01', '2027-01-31');
    expect(p.payments.filter(x => x.kind === 'training').map(x => x.due)).toEqual(['2027-01-31','2027-04-30','2027-07-31','2027-10-31']);
    expect(p.payments.reduce((s,x) => s+x.amount_ore,0)).toBe(150001);
  });
  it('deler ikke medlemskontingenten', () => { expect(paymentPlan(50000,120000,'monthly','2027-02-01','2027-01-01').payments.filter(x=>x.kind==='membership')).toEqual([{kind:'membership',amount_ore:50000,due:'2027-02-01'}]); });
  it('har tolv endelige månedsavdrag', () => { const p=paymentPlan(50000,120001,'monthly','2027-02-01','2027-01-01'); expect(p.payments.filter(x=>x.kind==='training')).toHaveLength(12); expect(p.payments.at(-1)?.due).toBe('2027-12-01'); expect(p.payments.reduce((s,x)=>s+x.amount_ore,0)).toBe(170001); });
  it('har én årsbetaling for treningsavgift', () => { expect(paymentPlan(50000,120000,'annual','2027-02-01','2027-01-01').payments).toHaveLength(2); });
  it('avviser ubegrenset plan over neste år', () => { expect(()=>paymentPlan(0,120000,'monthly','2027-02-01','2027-03-01')).toThrow('2027'); });
  it('bruker avtalens forfallsår også etter 2027', () => { expect(paymentPlan(50000,120000,'monthly','2028-02-01','2028-01-01').payments.at(-1)?.due).toBe('2028-12-01'); });
  it('avviser datoer som ikke finnes og medlemsforfall i feil år', () => { expect(()=>paymentPlan(50000,120000,'annual','2027-02-29','2027-01-01')).toThrow(); expect(()=>paymentPlan(50000,120000,'annual','2026-02-01','2027-01-01')).toThrow(); });
  it('sender ikke uavklart 2027-avtale', () => { expect(canSendPackage({fees_confirmed:false,legal_reviewed:true},{status:'ready',body:'Avtale'})).toBe(false); expect(canSendPackage({fees_confirmed:true,legal_reviewed:true},{status:'ready',body:'[UAVKLART]'})).toBe(false); });
  it('krever kontroll av NFF-bestemmelsene', () => { expect(canSendPackage({fees_confirmed:true,legal_reviewed:false},{status:'ready',body:'Avtale'})).toBe(false); });
  it('sender godkjent avtale før betaling er gjennomført', () => { const settings={fees_confirmed:true,legal_reviewed:true,payment_verified_at:null}; expect(canSendPackage(settings,{status:'ready',body:'Godkjent 2027-avtale'})).toBe(true); });
  it('pending søknad gir aldri tilgang', () => { expect(()=>assertPlayerAccess('pending',true)).toThrow(); expect(()=>assertPlayerAccess('approved',false)).toThrow(); expect(()=>assertPlayerAccess('approved',true)).not.toThrow(); });
  it('krever 70 prosent per kalendermåned', () => { expect(attendanceRule.minimumPercent).toBe(70); expect(attendanceRule.period).toBe('calendar_month'); });
  it('teller tilpasset trening, ikke automatisk skadefritak eller bøter', () => { expect(attendanceRule.adaptedTrainingCounts).toBe(true); expect(attendanceRule.injuryAutomaticExemption).toBe(false); expect(attendanceRule.automaticFine).toBe(false); });
});