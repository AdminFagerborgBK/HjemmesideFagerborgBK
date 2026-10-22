const yearFormat = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Oslo', year: 'numeric' });

/** Calendar year of a timestamp in Europe/Oslo, independent of the browser timezone. */
export function osloYear(date: string | Date): number {
  return Number(yearFormat.format(typeof date === 'string' ? new Date(date) : date));
}

/**
 * Years shown in public filters: configured seasons up to the active one, plus
 * years that actually contain matches. Inactive future drafts never appear.
 */
export function availableYears(seasons: { season: number }[], active: number | undefined, matchDates: string[] = []): number[] {
  const years = new Set<number>();
  for (const s of seasons) if (active === undefined || s.season <= active) years.add(s.season);
  for (const d of matchDates) years.add(osloYear(d));
  if (active !== undefined) years.add(active);
  return [...years].sort((a, b) => b - a);
}

export function inOsloYear<T extends { match_date: string }>(rows: T[], year: number): T[] {
  return rows.filter(r => osloYear(r.match_date) === year);
}
