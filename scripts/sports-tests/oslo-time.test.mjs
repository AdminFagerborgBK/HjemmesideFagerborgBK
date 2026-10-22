import { test } from 'node:test';
import assert from 'node:assert/strict';
import { osloWallTimeToIso, osloInputParts } from '../../supabase/functions/_shared/osloWallTime.mjs';

for (const [date, utc] of [
  ['2026-10-21', '18:15'],
  ['2026-10-24', '18:15'], ['2026-10-25', '19:15'], ['2026-11-01', '19:15'],
  ['2026-03-28', '19:15'], ['2026-03-29', '18:15'], ['2027-01-15', '19:15'],
]) {
  test(`Oslo ${date} 20:15 stores correct UTC`, () => {
    assert.equal(osloWallTimeToIso(date, '20:15'), `${date}T${utc}:00.000Z`);
  });
}
test('Oslo midnight keeps both the correct day and hour', () => {
  assert.equal(osloWallTimeToIso('2026-10-26', '00:00'), '2026-10-25T23:00:00.000Z');
  assert.deepEqual(osloInputParts('2026-10-25T23:00:00.000Z'), { date: '2026-10-26', time: '00:00' });
});
test('Spring nonexistent wall time is rejected, not silently shifted', () => {
  assert.throws(() => osloWallTimeToIso('2026-03-29', '02:30'), RangeError);
});
test('Repeated autumn wall time resolves to first occurrence consistently', () => {
  assert.equal(osloWallTimeToIso('2026-10-25', '02:30'), '2026-10-25T00:30:00.000Z');
});
test('Impossible calendar dates are rejected', () => {
  assert.throws(() => osloWallTimeToIso('2026-02-30', '20:15'), RangeError);
});