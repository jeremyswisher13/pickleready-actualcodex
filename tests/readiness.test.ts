import { describe, expect, it } from "vitest";

import { calculateReadinessScore } from "@shared/domain/readiness";

describe("manual readiness mode", () => {
  it("uses a Morning Check-In when Whoop is unavailable", () => {
    const readiness = calculateReadinessScore({
      dateString: "2026-04-03T07:00:00.000Z",
      checkIn: {
        dateString: "2026-04-03",
        submittedAt: "2026-04-03T07:00:00.000Z",
        source: "manual",
        sleepHours: 7.5,
        sleepQuality: 4,
        energy: 4,
        soreness: 2,
        stress: 2,
        mentalSharpness: 4,
        illness: false,
        alcohol: false,
        travel: false,
        painAreas: [],
        note: "",
        physicalEstimate: 0,
        confidence: "medium"
      },
      matches: [],
      userCreatedAt: "2026-03-01T07:00:00.000Z"
    });

    expect(readiness.physicalSource).toBe("checkin");
    expect(readiness.confidence).toBe("medium");
    expect(readiness.physical).toBeGreaterThan(65);
    expect(readiness.changeExplanations[0]?.description).toContain("manual physical estimate");
  });
});
