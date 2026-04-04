import { describe, expect, it } from "vitest";

import { calculateReadinessScore } from "@shared/domain/readiness";

describe("manual readiness mode", () => {
  it("uses a Morning Check-In when Whoop is unavailable", () => {
    const readiness = calculateReadinessScore({
      dateString: "2026-04-03T07:00:00.000Z",
      userTimeZone: "America/Los_Angeles",
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

  it("treats a late-night match as yesterday in the player's timezone", () => {
    const readiness = calculateReadinessScore({
      dateString: "2026-04-03",
      calculatedAt: "2026-04-03T13:00:00.000Z",
      userTimeZone: "America/Los_Angeles",
      matches: [
        {
          id: "match-1",
          date: "2026-04-03T03:00:00.000Z",
          createdAt: "2026-04-03T03:15:00.000Z",
          matchType: "singles",
          category: "rec",
          format: "standard",
          environment: "outdoor",
          genderFormat: "open",
          opponents: [{ name: "Chris Park", rating: 4.1 }],
          games: [{ myScore: 11, opponentScore: 8 }, { myScore: 11, opponentScore: 9 }],
          result: "win",
          notes: "",
          verified: false,
          verifiedBy: [],
          readinessAtTime: 70,
          postMatchInsight: ""
        }
      ],
      userCreatedAt: "2026-03-20T07:00:00.000Z"
    });

    expect(readiness.matchData.daysSinceLastMatch).toBe(1);
  });
});
