import { describe, expect, it } from "vitest";

import { calculateRecScoreUpdate, calculateExpectedOutcome, replayRecRatings, resolveBaseKFactor } from "@shared/domain/rec-score";

describe("rec score engine", () => {
  it("applies stacked multipliers for verified tournament wins", () => {
    const result = calculateRecScoreUpdate({
      currentRating: 4.3,
      opponentRating: 4.52,
      matchCount: 12,
      verified: true,
      category: "tournament",
      result: "win",
      averageMargin: 2,
      opponentName: "Sarah Kim",
      gameCount: 3
    });

    expect(resolveBaseKFactor(12)).toBe(32);
    expect(result.effectiveK).toBe(62.4);
    expect(result.delta).toBeGreaterThan(0.05);
    expect(result.explanations[0]?.description).toContain("4.52-rated player");
    expect(result.explanations[1]?.description).toContain("verification + tournament");
  });

  it("cuts K in half for unrated opponents", () => {
    const result = calculateRecScoreUpdate({
      currentRating: 4.1,
      opponentRating: undefined,
      matchCount: 4,
      verified: false,
      category: "rec",
      result: "win",
      averageMargin: 1,
      opponentName: "Open Play Guest",
      gameCount: 2
    });

    expect(result.effectiveK).toBe(16);
    expect(result.delta).toBeGreaterThan(0);
    expect(result.explanations[0]?.description).toContain("unrated opponent");
  });

  it("produces the expected win probability in Elo space", () => {
    expect(calculateExpectedOutcome(4.4, 4.4)).toBe(0.5);
    expect(calculateExpectedOutcome(4.2, 4.6)).toBeLessThan(0.5);
    expect(calculateExpectedOutcome(4.7, 4.3)).toBeGreaterThan(0.5);
  });

  it("stores replayed rating entries on the player's local match day", () => {
    const replay = replayRecRatings(
      [
        {
          id: "night-match",
          date: "2026-04-05T00:43:00.000Z",
          createdAt: "2026-04-05T00:43:00.000Z",
          matchType: "singles",
          category: "rec",
          format: "standard",
          environment: "outdoor",
          genderFormat: "open",
          opponents: [{ name: "Late Match", rating: 4 }],
          games: [
            { myScore: 11, opponentScore: 8 },
            { myScore: 11, opponentScore: 9 }
          ],
          result: "win",
          notes: "",
          verified: false,
          verifiedBy: [],
          readinessAtTime: 70,
          postMatchInsight: "",
          opponentAverageRating: 4
        }
      ],
      3.5,
      undefined,
      "America/Los_Angeles"
    );

    expect(replay.entries[0]?.dateString).toBe("2026-04-04");
  });
});
