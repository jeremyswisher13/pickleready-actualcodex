import type { DuprSnapshot, MatchRecord, ReadinessScore, UserProfile, WhoopBaseline, WhoopMetrics } from "../domain/types";
import { generatePostMatchInsight } from "../domain/insight";
import { calculateReadinessScore } from "../domain/readiness";
import { replayRecRatings } from "../domain/rec-score";
import { average, round } from "../domain/utils";

const isoDaysAgo = (daysAgo: number, hour = 18) => {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
};

export const seedProfile: UserProfile = {
  displayName: "Jamie Rivera",
  email: "jamie@pickleready.app",
  photoURL: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80",
  duprId: "DUPR-40782",
  duprPlayerId: "dupr-player-jamie-rivera",
  whoopConnected: true,
  whoopUserId: "whoop-jamie-rivera",
  timeZone: "America/Los_Angeles",
  createdAt: isoDaysAgo(18),
  updatedAt: isoDaysAgo(0)
};

export const seedDuprSnapshot: DuprSnapshot = {
  singlesRating: 4.31,
  doublesRating: 4.44,
  ratingTrend14d: 0.07
};

export const seedWhoopBaseline: WhoopBaseline = {
  avgHrvRmssd7d: 58,
  avgRestingHeartRate7d: 54,
  avgStrain7d: 11.2,
  avgSleepDurationMs7d: 27_000_000,
  avgRecovery7d: 69,
  weeklyActivityScore: 84,
  observedDays: 12
};

export const seedWhoopToday: WhoopMetrics = {
  recoveryScore: 74,
  hrvRmssd: 63,
  restingHeartRate: 52,
  sleepPerformance: 88,
  sleepDurationMs: 27_450_000,
  strain: 12.4,
  cycleId: "cycle-today",
  steps: 9120
};

export const buildSeedMatches = (): MatchRecord[] => [
  {
    id: "match-1",
    date: isoDaysAgo(27),
    createdAt: isoDaysAgo(27, 19),
    matchType: "singles",
    category: "rec",
    format: "standard",
    environment: "outdoor",
    genderFormat: "open",
    opponents: [{ name: "Chris Park", duprId: "DUPR-1902", rating: 4.05 }],
    games: [{ myScore: 11, opponentScore: 8 }, { myScore: 11, opponentScore: 9 }],
    result: "win",
    notes: "Settled in after the first few rallies and held serve cleanly.",
    verified: false,
    verifiedBy: [],
    readinessAtTime: 68,
    postMatchInsight: "",
    opponentAverageRating: 4.05
  },
  {
    id: "match-2",
    date: isoDaysAgo(24),
    createdAt: isoDaysAgo(24, 19),
    matchType: "singles",
    category: "tournament",
    format: "standard",
    environment: "indoor",
    genderFormat: "open",
    opponents: [{ name: "Sarah Kim", duprId: "DUPR-7221", rating: 4.52 }],
    games: [{ myScore: 9, opponentScore: 11 }, { myScore: 11, opponentScore: 9 }, { myScore: 8, opponentScore: 11 }],
    result: "loss",
    notes: "Really felt the pace in transition.",
    verified: true,
    verifiedBy: ["sarah-kim"],
    readinessAtTime: 57,
    postMatchInsight: "",
    opponentAverageRating: 4.52
  },
  {
    id: "match-3",
    date: isoDaysAgo(21),
    createdAt: isoDaysAgo(21, 19),
    matchType: "singles",
    category: "rec",
    format: "standard",
    environment: "outdoor",
    genderFormat: "open",
    opponents: [{ name: "Mike Chen", duprId: "DUPR-3058", rating: 4.35 }],
    games: [{ myScore: 11, opponentScore: 6 }, { myScore: 11, opponentScore: 7 }],
    result: "win",
    notes: "Good pace on the forehand return.",
    verified: false,
    verifiedBy: [],
    readinessAtTime: 72,
    postMatchInsight: "",
    opponentAverageRating: 4.35
  },
  {
    id: "match-4",
    date: isoDaysAgo(17),
    createdAt: isoDaysAgo(17, 19),
    matchType: "singles",
    category: "league",
    format: "standard",
    environment: "indoor",
    genderFormat: "mixed",
    opponents: [{ name: "Sarah Kim", duprId: "DUPR-7221", rating: 4.52 }],
    games: [{ myScore: 10, opponentScore: 12 }, { myScore: 11, opponentScore: 8 }, { myScore: 9, opponentScore: 11 }],
    result: "loss",
    notes: "Better tempo than last time, but got squeezed late.",
    verified: true,
    verifiedBy: ["sarah-kim"],
    readinessAtTime: 61,
    postMatchInsight: "",
    opponentAverageRating: 4.52
  },
  {
    id: "match-5",
    date: isoDaysAgo(13),
    createdAt: isoDaysAgo(13, 19),
    matchType: "singles",
    category: "rec",
    format: "standard",
    environment: "outdoor",
    genderFormat: "open",
    opponents: [{ name: "Jordan Lee", duprId: "DUPR-9920", rating: 4.18 }],
    games: [{ myScore: 11, opponentScore: 5 }, { myScore: 11, opponentScore: 4 }],
    result: "win",
    notes: "Everything felt on time.",
    verified: false,
    verifiedBy: [],
    readinessAtTime: 79,
    postMatchInsight: "",
    opponentAverageRating: 4.18
  },
  {
    id: "match-6",
    date: isoDaysAgo(9),
    createdAt: isoDaysAgo(9, 19),
    matchType: "singles",
    category: "rec",
    format: "standard",
    environment: "outdoor",
    genderFormat: "mens",
    opponents: [{ name: "Mike Chen", duprId: "DUPR-3058", rating: 4.35 }],
    games: [{ myScore: 11, opponentScore: 7 }, { myScore: 11, opponentScore: 9 }],
    result: "win",
    notes: "Handled the middle well and kept pressure on the return.",
    verified: false,
    verifiedBy: [],
    readinessAtTime: 73,
    postMatchInsight: "",
    opponentAverageRating: 4.35
  },
  {
    id: "match-7",
    date: isoDaysAgo(6),
    createdAt: isoDaysAgo(6, 20),
    matchType: "singles",
    category: "tournament",
    format: "standard",
    environment: "indoor",
    genderFormat: "open",
    opponents: [{ name: "Avery Patel", duprId: "DUPR-1663", rating: 4.61 }],
    games: [{ myScore: 6, opponentScore: 11 }, { myScore: 10, opponentScore: 12 }],
    result: "loss",
    notes: "Avery was the steadier side in transition.",
    verified: true,
    verifiedBy: ["avery-patel"],
    readinessAtTime: 66,
    postMatchInsight: "",
    opponentAverageRating: 4.61
  },
  {
    id: "match-8",
    date: isoDaysAgo(4),
    createdAt: isoDaysAgo(4, 20),
    matchType: "doubles",
    category: "league",
    format: "standard",
    environment: "indoor",
    genderFormat: "mixed",
    partner: { name: "Maya Thompson", duprId: "DUPR-0881", rating: 4.29 },
    opponents: [
      { name: "Chris Park", duprId: "DUPR-1902", rating: 4.05 },
      { name: "Nate Brooks", duprId: "DUPR-3191", rating: 4.26 }
    ],
    games: [{ myScore: 11, opponentScore: 9 }, { myScore: 8, opponentScore: 11 }, { myScore: 11, opponentScore: 7 }],
    result: "win",
    notes: "Third-game reset worked well.",
    verified: true,
    verifiedBy: ["chris-park"],
    readinessAtTime: 71,
    postMatchInsight: "",
    opponentAverageRating: 4.16
  },
  {
    id: "match-9",
    date: isoDaysAgo(2),
    createdAt: isoDaysAgo(2, 20),
    matchType: "singles",
    category: "rec",
    format: "standard",
    environment: "outdoor",
    genderFormat: "open",
    opponents: [{ name: "Sarah Kim", duprId: "DUPR-7221", rating: 4.52 }],
    games: [{ myScore: 11, opponentScore: 9 }, { myScore: 9, opponentScore: 11 }, { myScore: 11, opponentScore: 8 }],
    result: "win",
    notes: "Best backhand dink pattern against Sarah yet.",
    verified: false,
    verifiedBy: [],
    readinessAtTime: 69,
    postMatchInsight: "",
    opponentAverageRating: 4.52
  },
  {
    id: "match-10",
    date: isoDaysAgo(1),
    createdAt: isoDaysAgo(1, 20),
    matchType: "singles",
    category: "rec",
    format: "standard",
    environment: "outdoor",
    genderFormat: "open",
    opponents: [{ name: "Mike Chen", duprId: "DUPR-3058", rating: 4.35 }],
    games: [{ myScore: 9, opponentScore: 11 }, { myScore: 11, opponentScore: 8 }, { myScore: 7, opponentScore: 11 }],
    result: "loss",
    notes: "Felt a step slow late in the third.",
    verified: false,
    verifiedBy: [],
    readinessAtTime: 58,
    postMatchInsight: "",
    opponentAverageRating: 4.35
  }
];

export const buildSeedReadinessHistory = (
  matches: MatchRecord[],
  duprSnapshot: DuprSnapshot,
  whoopBaseline: WhoopBaseline
): ReadinessScore[] => {
  const history: ReadinessScore[] = [];

  for (let daysAgo = 29; daysAgo >= 0; daysAgo -= 1) {
    const date = isoDaysAgo(daysAgo, 6);
    const variation = Math.sin(daysAgo / 4) * 6;
    const whoopSnapshot: WhoopMetrics = {
      recoveryScore: round(69 + variation),
      hrvRmssd: round(whoopBaseline.avgHrvRmssd7d + Math.cos(daysAgo / 3) * 5),
      restingHeartRate: round(whoopBaseline.avgRestingHeartRate7d + Math.sin(daysAgo / 5) * 2),
      sleepPerformance: round(82 + Math.cos(daysAgo / 4) * 7),
      sleepDurationMs: round(whoopBaseline.avgSleepDurationMs7d + Math.sin(daysAgo / 2) * 2_100_000),
      strain: round(whoopBaseline.avgStrain7d + Math.cos(daysAgo / 2.5) * 2, 1),
      cycleId: `cycle-${daysAgo}`,
      steps: round(8100 + Math.sin(daysAgo / 2) * 1200)
    };

    history.push(
      calculateReadinessScore({
        dateString: date,
        userTimeZone: seedProfile.timeZone,
        whoop: whoopSnapshot,
        baseline: whoopBaseline,
        dupr: {
          ...duprSnapshot,
          ratingTrend14d: round((duprSnapshot.ratingTrend14d ?? 0) - daysAgo * 0.002, 2)
        },
        matches: matches.filter((match) => new Date(match.date).getTime() <= new Date(date).getTime()),
        userCreatedAt: seedProfile.createdAt
      })
    );
  }

  return history;
};

export const createSeedData = () => {
  const matches = buildSeedMatches();
  const replay = replayRecRatings(matches, seedDuprSnapshot.doublesRating ?? seedDuprSnapshot.singlesRating ?? 3.5, {
    singles: seedDuprSnapshot.singlesRating,
    doubles: seedDuprSnapshot.doublesRating
  });
  let previousRecScore = seedDuprSnapshot.doublesRating ?? seedDuprSnapshot.singlesRating ?? 3.5;

  const enrichedMatches = matches.map((match) => {
    const update = replay.updates.get(match.id);
    const previousMatches = matches.filter(
      (candidate) =>
        candidate.id !== match.id &&
        new Date(candidate.date).getTime() < new Date(match.date).getTime() &&
        candidate.opponents.some((opponent) => opponent.name === match.opponents[0]?.name)
    );

    const h2hWinsBefore = previousMatches.filter((candidate) => candidate.result === "win").length;
    const h2hLossesBefore = previousMatches.filter((candidate) => candidate.result === "loss").length;

    const currentReadiness = calculateReadinessScore({
      dateString: match.date,
      userTimeZone: seedProfile.timeZone,
      whoop: seedWhoopToday,
      baseline: seedWhoopBaseline,
      dupr: seedDuprSnapshot,
        matches: matches.filter((candidate) => new Date(candidate.date).getTime() <= new Date(match.date).getTime()),
        userCreatedAt: seedProfile.createdAt
      });

    const nextRecScore = update?.newRating ?? previousRecScore;

    const enrichedMatch = {
      ...match,
      recScoreDelta: update?.delta,
      recScoreAfter: update?.newRating,
      readinessAtTime: currentReadiness.overall,
      postMatchInsight: generatePostMatchInsight({
        match,
        readiness: currentReadiness,
        previousRecScore,
        newRecScore: nextRecScore,
        opponentRating: match.opponentAverageRating,
        h2hMatchesBefore: previousMatches.length,
        h2hWinsBefore,
        h2hLossesBefore
      })
    };

    previousRecScore = nextRecScore;

    return enrichedMatch;
  });

  const readinessHistory = buildSeedReadinessHistory(enrichedMatches, seedDuprSnapshot, seedWhoopBaseline);
  const todayReadiness = calculateReadinessScore({
    dateString: new Date().toISOString(),
    userTimeZone: seedProfile.timeZone,
    whoop: seedWhoopToday,
    baseline: seedWhoopBaseline,
    dupr: seedDuprSnapshot,
    matches: enrichedMatches,
    userCreatedAt: seedProfile.createdAt
  });

  return {
    profile: seedProfile,
    dupr: seedDuprSnapshot,
    whoopToday: seedWhoopToday,
    whoopBaseline: seedWhoopBaseline,
    matches: enrichedMatches.map((match) => ({
      ...match,
      opponentAverageRating:
        match.opponentAverageRating ??
        average(
          match.opponents
            .map((opponent) => opponent.rating)
            .filter((rating): rating is number => typeof rating === "number")
        )
    })),
    readinessHistory: [...readinessHistory.slice(0, -1), todayReadiness],
    ratingHistory: replay.entries
  };
};
