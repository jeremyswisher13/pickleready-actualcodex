import { describe, expect, it } from "vitest";

import { dateKeyInTimeZone, dayDifferenceInTimeZone, localDateKey } from "@shared/domain/utils";

describe("date helpers", () => {
  it("builds a calendar-day key from a local Date instance", () => {
    expect(localDateKey(new Date(2026, 3, 3, 8, 30, 0, 0))).toBe("2026-04-03");
  });

  it("derives the correct day for a specific timezone", () => {
    expect(dateKeyInTimeZone("2026-04-03T05:30:00.000Z", "America/Los_Angeles")).toBe("2026-04-02");
    expect(dateKeyInTimeZone("2026-04-03T05:30:00.000Z", "America/New_York")).toBe("2026-04-03");
  });

  it("computes calendar-day differences in a specific timezone", () => {
    expect(
      dayDifferenceInTimeZone("2026-04-03", "2026-04-03T03:00:00.000Z", "America/Los_Angeles")
    ).toBe(1);
    expect(
      dayDifferenceInTimeZone("2026-04-03", "2026-04-03T05:30:00.000Z", "America/New_York")
    ).toBe(0);
  });
});
