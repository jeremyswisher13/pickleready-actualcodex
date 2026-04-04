import { describe, expect, it } from "vitest";

import { generatePostMatchInsight } from "@shared/domain/insight";
import type { MatchRecord, ReadinessScore } from "@shared/domain/types";

const readiness = (overall: number): ReadinessScore => ({
  dateString: "2026-04-03",
  overall,
  physical: overall,
  performance: overall,
  activity: overall,
  whoopData: {},
  checkInData: undefined,
  duprData: {},
  matchData: {
    recentMatchCount: 0,
    recentWinRate: 0,
    daysSinceLastMatch: null,
    avgMargin: 0
  },
  changeExplanations: [],
  calculatedAt: "2026-04-03T06:00:00.000Z",
  label: overall >= 80 ? "Go compete" : overall >= 60 ? "Good for rec" : overall >= 40 ? "Light session" : "Rest day",
  confidence: "medium",
  physicalSource: "checkin"
});

const baseMatch: MatchRecord = {
  id: "match-1",
  date: "2026-04-03T18:00:00.000Z",
  createdAt: "2026-04-03T19:00:00.000Z",
  matchType: "singles",
  category: "rec",
  format: "standard",
  environment: "outdoor",
  genderFormat: "open",
  opponents: [{ name: "Sarah Kim", rating: 4.52 }],
  games: [
    { myScore: 9, opponentScore: 11 },
    { myScore: 11, opponentScore: 7 },
    { myScore: 8, opponentScore: 11 }
  ],
  result: "loss",
  notes: "",
  verified: false,
  verifiedBy: [],
  readinessAtTime: 48,
  postMatchInsight: ""
};

describe("post-match insight generator", () => {
  it("protects low-readiness losses with context and rec movement", () => {
    const insight = generatePostMatchInsight({
      match: baseMatch,
      readiness: readiness(48),
      previousRecScore: 4.42,
      newRecScore: 4.4,
      opponentRating: 4.52,
      h2hMatchesBefore: 1,
      h2hWinsBefore: 0,
      h2hLossesBefore: 1
    });

    expect(insight).toContain("Tough loss to Sarah Kim (4.52)");
    expect(insight).toContain("48 readiness");
    expect(insight).toContain("Rec score down 0.02 to 4.40.");
  });

  it("calls out upset wins over higher-rated opponents", () => {
    const insight = generatePostMatchInsight({
      match: {
        ...baseMatch,
        result: "win",
        opponents: [{ name: "Avery Patel", rating: 4.65 }],
        games: [
          { myScore: 11, opponentScore: 9 },
          { myScore: 9, opponentScore: 11 },
          { myScore: 11, opponentScore: 8 }
        ]
      },
      readiness: readiness(72),
      previousRecScore: 4.3,
      newRecScore: 4.38,
      opponentRating: 4.65,
      h2hMatchesBefore: 2,
      h2hWinsBefore: 1,
      h2hLossesBefore: 1
    });

    expect(insight).toContain("Upset win over Avery Patel (4.65)");
    expect(insight).toContain("Head-to-head is now 2-1");
    expect(insight).toContain("Rec score up 0.08 to 4.38.");
  });
});
