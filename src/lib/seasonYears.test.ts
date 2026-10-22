import { describe, it, expect } from 'vitest';
import { osloYear, availableYears, inOsloYear } from './seasonYears';

describe('Public season year filters', () => {
  it('uses Europe/Oslo year boundaries, not UTC/browser', () => {
    expect(osloYear('2026-12-31T23:30:00Z')).toBe(2027); // 00:30 Oslo on 1 Jan
    expect(osloYear('2026-12-31T22:59:00Z')).toBe(2026);
  });
  it('NM match played in 2027 is listed under 2027 regardless of its name', () => {
    const rows = [
      { match_date: '2027-04-01T16:00:00Z', competition: 'NM Menn 2028 kvalifisering' },
      { match_date: '2026-10-21T18:15:00Z', competition: '5. div. menn avd. 01' },
    ];
    expect(inOsloYear(rows, 2027).map(r => r.competition)).toEqual(['NM Menn 2028 kvalifisering']);
    expect(inOsloYear(rows, 2026)).toHaveLength(1);
  });
  it('after 2027 activation both years are selectable, newest first', () => {
    expect(availableYears([{ season: 2026 }, { season: 2027 }], 2027)).toEqual([2027, 2026]);
  });
  it('inactive future draft is not shown before activation', () => {
    expect(availableYears([{ season: 2026 }, { season: 2027 }], 2026)).toEqual([2026]);
  });
});
