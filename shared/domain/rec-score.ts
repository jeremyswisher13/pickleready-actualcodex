import type { ChangeExplanation, MatchGame, MatchRecord, RecScoreInput, RecScoreResult, RatingEntry } from "./types";
import { average, clamp, dateKeyInTimeZone, isoDateKey, round } from "./utils";

export const MIN_RATING = 2;
export const MAX_RATING = 8;
const MIN_ELO = 800;
const MAX_ELO = 2000;
const ELO_PER_RATING_POINT = (MAX_ELO - MIN_ELO) / (MAX_RATING - MIN_RATING);

export const duprToElo = (rating: number) =>
  round(MIN_ELO + (clamp(rating, MIN_RATING, MAX_RATING) - MIN_RATING) * ELO_PER_RATING_POINT, 2);

export const eloToDupr = (elo: number) =>
  round(clamp(MIN_RATING + (elo - MIN_ELO) / ELO_PER_RATING_POINT, MIN_RATING, MAX_RATING), 2);

export const averageMatchMargin = (games: MatchGame[]) =>
  round(average(games.map((game) => game.myScore - game.opponentScore)), 2);

export const deriveMatchResult = (games: MatchGame[]) => {
  const wins = games.filter((game) => game.myScore > game.opponentScore).length;
  return wins >= Math.ceil(games.length / 2) ? "win" : "loss";
};

export const resolveBaseKFactor = (matchCount: number) => {
  if (matchCount < 20) {
    return 32;
  }

  if (matchCount < 50) {
    return 24;
  }

  return 16;
};

export const calculateExpectedOutcome = (myRating: number, opponentRating: number) => {
  const myElo = duprToElo(myRating);
  const opponentElo = duprToElo(opponentRating);
  return round(1 / (1 + 10 ** ((opponentElo - myElo) / 400)), 4);
};

export const resolveMarginAwareOutcome = (result: "win" | "loss", averageMarginValue: number) => {
  const margin = Math.abs(averageMarginValue);

  if (result === "win") {
    if (margin >= 5) {
      return 1;
    }

    if (margin >= 3) {
      return 0.85;
    }

    return 0.7;
  }

  if (margin >= 5) {
    return 0;
  }

  if (margin >= 3) {
    return 0.15;
  }

  return 0.35;
};

const buildPrimaryExplanation = (
  input: RecScoreInput,
  effectiveOpponentRating: number,
  delta: number
): ChangeExplanation => {
  const margin = Math.abs(input.averageMargin);
  const matchupText =
    input.opponentRating == null
      ? `Played an unrated opponent, so the system treated ${input.opponentName} as level with you`
      : `${input.result === "win" ? "Beat" : "Lost to"} a ${effectiveOpponentRating.toFixed(2)}-rated player`;

  const marginText =
    margin >= 5 ? "in a dominant result" : margin >= 3 ? "in a solid match" : "in a close battle";

  return {
    factor: "match result",
    impact: delta,
    description: `${matchupText} ${marginText}${input.gameCount >= 3 ? " across three games" : ""}.`
  };
};

const buildWeightExplanation = (
  input: RecScoreInput,
  boostedDelta: number
): ChangeExplanation | null => {
  const descriptors: string[] = [];

  if (input.verified) {
    descriptors.push("verification");
  }

  if (input.category !== "rec") {
    descriptors.push(input.category);
  }

  if (descriptors.length === 0 || Math.abs(boostedDelta) < 0.01) {
    return null;
  }

  return {
    factor: "match weight",
    impact: boostedDelta,
    description: `Extra weight came from ${descriptors.join(" + ")}, which amplified the rating movement.`
  };
};

export const calculateRecScoreUpdate = (input: RecScoreInput): RecScoreResult => {
  const opponentRating = input.opponentRating ?? input.currentRating;
  const unratedMultiplier = input.opponentRating == null ? 0.5 : 1;
  const categoryMultiplier = input.category === "rec" ? 1 : 1.3;
  const verifiedMultiplier = input.verified ? 1.5 : 1;
  const baseK = resolveBaseKFactor(input.matchCount);
  const effectiveK = round(baseK * categoryMultiplier * verifiedMultiplier * unratedMultiplier, 2);
  const expectedOutcome = calculateExpectedOutcome(input.currentRating, opponentRating);
  const actualOutcome = resolveMarginAwareOutcome(input.result, input.averageMargin);

  const previousElo = duprToElo(input.currentRating);
  const baseShift = (baseK * unratedMultiplier) * (actualOutcome - expectedOutcome);
  const weightedShift = effectiveK * (actualOutcome - expectedOutcome);
  const newRating = eloToDupr(previousElo + weightedShift);
  const delta = round(newRating - input.currentRating, 2);
  const baseDelta = round(eloToDupr(previousElo + baseShift) - input.currentRating, 2);

  const explanations: ChangeExplanation[] = [
    buildPrimaryExplanation(input, opponentRating, delta)
  ];

  const weightExplanation = buildWeightExplanation(input, round(delta - baseDelta, 2));

  if (weightExplanation) {
    explanations.push(weightExplanation);
  }

  return {
    previousRating: round(input.currentRating, 2),
    newRating,
    delta,
    expectedOutcome,
    actualOutcome,
    kFactor: baseK,
    effectiveK,
    explanations
  };
};

const getOpponentAverageRating = (match: MatchRecord) => {
  if (typeof match.opponentAverageRating === "number") {
    return match.opponentAverageRating;
  }

  const knownRatings = match.opponents
    .map((opponent) => opponent.rating)
    .filter((rating): rating is number => typeof rating === "number");

  return knownRatings.length > 0 ? round(average(knownRatings), 2) : undefined;
};

export const replayRecRatings = (
  matches: MatchRecord[],
  startingRating: number,
  duprRatings?: { singles?: number; doubles?: number },
  userTimeZone?: string
) => {
  const sortedMatches = [...matches].sort((left, right) => {
    const leftTime = new Date(left.date).getTime();
    const rightTime = new Date(right.date).getTime();

    if (leftTime !== rightTime) {
      return leftTime - rightTime;
    }

    return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
  });

  let currentRating = round(startingRating, 2);
  const entries: RatingEntry[] = [];
  const updates = new Map<string, RecScoreResult>();

  sortedMatches.forEach((match, index) => {
    const result = calculateRecScoreUpdate({
      currentRating,
      opponentRating: getOpponentAverageRating(match),
      matchCount: index,
      verified: match.verified,
      category: match.category,
      result: match.result,
      averageMargin: averageMatchMargin(match.games),
      opponentName: match.opponents.map((opponent) => opponent.name).join(" / "),
      gameCount: match.games.length
    });

    currentRating = result.newRating;
    updates.set(match.id, result);

    entries.push({
      dateString: userTimeZone ? dateKeyInTimeZone(match.date, userTimeZone) : isoDateKey(match.date),
      duprSingles: duprRatings?.singles,
      duprDoubles: duprRatings?.doubles,
      recScore: currentRating,
      recScoreChangeExplanations: result.explanations,
      updatedAt: match.createdAt
    });
  });

  return {
    currentRating,
    entries,
    updates
  };
};
