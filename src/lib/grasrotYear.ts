/** Current calendar year in Europe/Oslo, independent of the browser timezone. */
export function osloYear(now: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat("en", { timeZone: "Europe/Oslo", year: "numeric" }).format(now));
}

/** Default year: current Oslo year if a row exists, otherwise the latest available year. */
export function defaultGrasrotYear(years: number[], currentYear: number): number | null {
  if (years.includes(currentYear)) return currentYear;
  const past = years.filter(y => y <= currentYear);
  const pool = past.length ? past : years;
  return pool.length ? Math.max(...pool) : null;
}

/** Last N completed years (strictly before current Oslo year), ascending. */
export function completedYears<T extends { year: number }>(rows: T[], currentYear: number, n = 5): T[] {
  return rows.filter(r => r.year < currentYear).sort((a, b) => a.year - b.year).slice(-n);
}
