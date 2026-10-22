import { describe, it, expect } from "vitest";
import { osloYear, defaultGrasrotYear, completedYears } from "./grasrotYear";

describe("grasrot year rollover", () => {
  it("31.12 23:30 Oslo is still 2026 (22:30Z)", () => {
    expect(osloYear(new Date("2026-12-31T22:30:00Z"))).toBe(2026);
  });
  it("01.01 00:30 Oslo is 2027 even though UTC is still 2026", () => {
    expect(osloYear(new Date("2026-12-31T23:30:00Z"))).toBe(2027);
  });
  it("falls back to latest year when 2027 row is missing", () => {
    expect(defaultGrasrotYear([2024, 2025, 2026], 2027)).toBe(2026);
  });
  it("selects 2027 once the row appears", () => {
    expect(defaultGrasrotYear([2024, 2025, 2026, 2027], 2027)).toBe(2027);
  });
  it("chart includes 2026 as completed in 2027, excludes 2027", () => {
    const rows = [2021, 2022, 2023, 2024, 2025, 2026, 2027].map(year => ({ year }));
    expect(completedYears(rows, 2027).map(r => r.year)).toEqual([2022, 2023, 2024, 2025, 2026]);
  });
});
