const zone = 'Europe/Oslo';
const formatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

/** @param {Date} date */
function wallParts(date) {
  return Object.fromEntries(formatter.formatToParts(date).map(p => [p.type, p.value]));
}

/**
 * Resolve Oslo wall time, independently of the machine's timezone.
 * Reject spring-gap times; choose the first occurrence of a repeated autumn time.
 * @param {string} date YYYY-MM-DD
 * @param {string} time HH:mm or HH:mm:ss
 * @returns {string} ISO UTC
 */
export function osloWallTimeToIso(date, time) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(time)) {
    throw new RangeError('Invalid Oslo date/time');
  }
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute, second = 0] = time.split(':').map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute, second);
  if (new Date(wall).toISOString().slice(0, 10) !== date) throw new RangeError('Invalid calendar date');
  const expected = `${date}T${time.length === 5 ? time + ':00' : time}`;
  const offsets = new Set();
  for (const delta of [-36, 0, 36]) {
    const instant = new Date(wall + delta * 3_600_000);
    const p = wallParts(instant);
    offsets.add(Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - instant.getTime());
  }
  const candidates = [...offsets].map(offset => new Date(wall - offset)).filter(candidate => {
    const p = wallParts(candidate);
    return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}` === expected;
  }).sort((a, b) => a.getTime() - b.getTime());
  const first = candidates[0];
  if (!first) throw new RangeError('Nonexistent Oslo time during daylight-saving transition');
  return first.toISOString();
}

/** @param {string} iso @returns {{date: string, time: string}} */
export function osloInputParts(iso) {
  const p = wallParts(new Date(iso));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}