import { describe, expect, it } from "vitest";

import { diagnoseFatigueVsMatchup } from "@shared/domain/matchup-diagnosis";
import type { MatchRecord, ReadinessScore } from "@shared/domain/types";

const readiness: ReadinessScore = {
  dateString: "2026-04-04",
  overall: 74,
  physical: 72,
  performance: 76,
  activity: 75,
  whoopData: {},
  checkInData: undefined,
  duprData: {},
  matchData: {
    recentMatchCount: 4,
    recentWinRate: 0.5,
    daysSinceLastMatch: 1,
    avgMargin: 1.5
  },
  changeExplanations: [],
  calculatedAt: "2026-04-04T13:00:00.000Z",
  label: "Good for rec",
  confidence: "medium",
  physicalSource: "checkin"
};

const latestMatch: MatchRecord = {
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
    { myScore: 11, opponentScore: 8 },
    { myScore: 8, opponentScore: 11 },
    { myScore: 9, opponentScore: 11 }
  ],
  result: "loss",
  notes: "",
  verified: false,
  verifiedBy: [],
  readinessAtTime: 63,
  postMatchInsight: ""
};

describe("fatigue vs matchup diagnosis", () => {
  it("does not pretend to explain today's result when no same-day match exists", () => {
    const diagnosis = diagnoseFatigueVsMatchup(readiness, [latestMatch], 4.4, "America/Los_Angeles");

    expect(diagnosis.headline).toBe("Today is still pre-match");
    expect(diagnosis.summary).toContain("not logged a same-day match yet");
    expect(diagnosis.supportingPoints[1]).toContain("2026-04-03");
  });
});
