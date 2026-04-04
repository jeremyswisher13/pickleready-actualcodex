import type { ChangeExplanation, MatchRecord, ReadinessInput, ReadinessScore, ScoreLabel } from "./types";
import { average, clamp, daysBetween, interpolateClamped, isoDateKey, round } from "./utils";
import { averageMatchMargin } from "./rec-score";

const DEFAULT_PHYSICAL = 65;
const DEFAULT_PERFORMANCE = 50;
const DEFAULT_OVERALL = 65;

const getScoreLabel = (score: number): ScoreLabel => {
  if (score >= 80) {
    return "Go compete";
  }

  if (score >= 60) {
    return "Good for rec";
  }

  if (score >= 40) {
    return "Light session";
  }

  return "Rest day";
};

const normalizeSleepDuration = (sleepDurationMs: number) => {
  const hours = sleepDurationMs / 3_600_000;

  if (hours <= 4) {
    return 20;
  }

  if (hours <= 5.5) {
    return interpolateClamped(hours, 4, 5.5, 20, 55);
  }

  if (hours <= 7.5) {
    return interpolateClamped(hours, 5.5, 7.5, 55, 100);
  }

  if (hours <= 9) {
    return interpolateClamped(hours, 7.5, 9, 100, 90);
  }

  return interpolateClamped(hours, 9, 10.5, 90, 70);
};

const normalizeHrvTrend = (todayHrv: number, averageHrv: number) => {
  const ratio = todayHrv / averageHrv;

  if (ratio <= 0.8) {
    return 40;
  }

  if (ratio <= 1) {
    return interpolateClamped(ratio, 0.8, 1, 40, 75);
  }

  if (ratio <= 1.2) {
    return interpolateClamped(ratio, 1, 1.2, 75, 100);
  }

  return 100;
};

const normalizeRestingHeartRate = (todayRhr: number, averageRhr: number) => {
  const delta = todayRhr - averageRhr;

  if (delta <= -4) {
    return 100;
  }

  if (delta <= 0) {
    return interpolateClamped(delta, -4, 0, 100, 80);
  }

  if (delta <= 4) {
    return interpolateClamped(delta, 0, 4, 80, 40);
  }

  return interpolateClamped(delta, 4, 8, 40, 20);
};

const normalizeStrainBalance = (strain: number, recoveryScore: number) => {
  const capacity = Math.max(8, (recoveryScore / 100) * 18);
  const ratio = strain / capacity;

  if (ratio < 0.5) {
    return 60;
  }

  if (ratio <= 0.8) {
    return interpolateClamped(ratio, 0.5, 0.8, 60, 100);
  }

  if (ratio <= 1.2) {
    return 100;
  }

  if (ratio <= 1.5) {
    return interpolateClamped(ratio, 1.2, 1.5, 100, 70);
  }

  return interpolateClamped(ratio, 1.5, 2, 70, 50);
};

const normalizeMatchVolume = (count: number) => {
  if (count === 0) {
    return 20;
  }

  if (count === 1) {
    return 40;
  }

  if (count === 2) {
    return 60;
  }

  if (count <= 4) {
    return interpolateClamped(count, 2, 4, 60, 100);
  }

  if (count <= 8) {
    return 100;
  }

  if (count <= 15) {
    return interpolateClamped(count, 8, 15, 100, 70);
  }

  return 70;
};

const normalizeWinRate = (rate: number) => {
  if (rate <= 0.3) {
    return 30;
  }

  if (rate <= 0.5) {
    return interpolateClamped(rate, 0.3, 0.5, 30, 60);
  }

  if (rate <= 0.8) {
    return interpolateClamped(rate, 0.5, 0.8, 60, 100);
  }

  return 100;
};

const normalizeScoreMargin = (margin: number) => {
  if (margin <= -4) {
    return 30;
  }

  if (margin <= 0) {
    return interpolateClamped(margin, -4, 0, 30, 60);
  }

  if (margin <= 4) {
    return interpolateClamped(margin, 0, 4, 60, 100);
  }

  return 100;
};

const normalizeRatingTrajectory = (trend: number) => {
  if (trend <= -0.2) {
    return 30;
  }

  if (trend <= 0) {
    return interpolateClamped(trend, -0.2, 0, 30, 60);
  }

  if (trend <= 0.2) {
    return interpolateClamped(trend, 0, 0.2, 60, 100);
  }

  return 100;
};

const normalizeDaysSinceMatch = (daysSinceMatch: number | null) => {
  if (daysSinceMatch == null) {
    return 50;
  }

  if (daysSinceMatch === 0) {
    return 70;
  }

  if (daysSinceMatch <= 2) {
    return 100;
  }

  if (daysSinceMatch <= 4) {
    return 80;
  }

  if (daysSinceMatch <= 7) {
    return 50;
  }

  return 30;
};

const normalizeStrainRecoveryRatio = (strain: number, recoveryScore: number) => {
  const ratio = strain / Math.max(1, recoveryScore / 8);

  if (ratio < 0.5) {
    return 60;
  }

  if (ratio <= 0.8) {
    return interpolateClamped(ratio, 0.5, 0.8, 60, 100);
  }

  if (ratio <= 1.2) {
    return 100;
  }

  if (ratio <= 1.5) {
    return interpolateClamped(ratio, 1.2, 1.5, 100, 50);
  }

  return 50;
};

const normalizeWeeklyActivity = (weeklyActivityScore: number) => clamp(weeklyActivityScore, 40, 100);
const normalizeFivePointScale = (value: number) => interpolateClamped(value, 1, 5, 20, 100);
const normalizeInverseFivePointScale = (value: number) => interpolateClamped(value, 1, 5, 100, 20);

const buildImpact = (factor: string, score: number, neutral: number, weight: number, description: string): ChangeExplanation => ({
  factor,
  impact: round((score - neutral) * weight),
  description
});

const getRecentMatches = (matches: MatchRecord[], dateString: string, windowDays: number) =>
  matches.filter((match) => daysBetween(dateString, match.date) <= windowDays && daysBetween(dateString, match.date) >= 0);

const hasEnoughWhoopHistory = (observedDays: number | undefined) => (observedDays ?? 0) >= 3;

export const estimateManualPhysicalReadiness = (input: NonNullable<ReadinessInput["checkIn"]>) => {
  const sleepDurationScore = normalizeSleepDuration(input.sleepHours * 3_600_000);
  const sleepQualityScore = normalizeFivePointScale(input.sleepQuality);
  const energyScore = normalizeFivePointScale(input.energy);
  const sorenessScore = normalizeInverseFivePointScale(input.soreness);
  const stressScore = normalizeInverseFivePointScale(input.stress);
  const mentalSharpnessScore = normalizeFivePointScale(input.mentalSharpness);
  const penalty =
    (input.illness ? 18 : 0) +
    (input.alcohol ? 8 : 0) +
    (input.travel ? 6 : 0) +
    (input.painAreas.length > 0 ? 10 : 0);

  return clamp(
    round(
      sleepQualityScore * 0.22 +
        sleepDurationScore * 0.16 +
        energyScore * 0.2 +
        sorenessScore * 0.22 +
        stressScore * 0.1 +
        mentalSharpnessScore * 0.1 -
        penalty
    ),
    0,
    100
  );
};

export const calculateReadinessScore = (input: ReadinessInput): ReadinessScore => {
  const cutoffTime = new Date(input.calculatedAt ?? input.dateString).getTime();
  const calculatedAt = input.calculatedAt ?? (input.dateString.includes("T") ? input.dateString : `${isoDateKey(input.dateString)}T12:00:00.000Z`);
  const matches = [...(input.matches ?? [])].sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime());
  const matchesUpToCalculation = matches.filter((match) => new Date(match.date).getTime() <= cutoffTime);
  const last14Matches = getRecentMatches(matchesUpToCalculation, input.dateString, 14);
  const recentMatches = matchesUpToCalculation.slice(-10);
  const matchMargins = recentMatches.map((match) => averageMatchMargin(match.games));
  const winRate = recentMatches.length === 0 ? 0 : recentMatches.filter((match) => match.result === "win").length / recentMatches.length;
  const daysSinceLastMatch =
    matchesUpToCalculation.length > 0
      ? daysBetween(input.dateString, matchesUpToCalculation[matchesUpToCalculation.length - 1].date)
      : null;
  const avgMargin = round(average(matchMargins), 2);
  const matchAggregate = {
    recentMatchCount: last14Matches.length,
    recentWinRate: round(winRate, 2),
    daysSinceLastMatch,
    avgMargin
  };

  const whoop = input.whoop ?? null;
  const baseline = input.baseline ?? null;
  const checkIn = input.checkIn ?? null;
  const dupr = input.dupr ?? null;
  const hasUsableWhoop = Boolean(whoop && baseline && hasEnoughWhoopHistory(baseline.observedDays));
  const physicalSource = hasUsableWhoop ? "whoop" : checkIn ? "checkin" : "fallback";
  const confidence = physicalSource === "whoop" ? "high" : physicalSource === "checkin" ? "medium" : "low";
  const isNewAccount = input.userCreatedAt ? daysBetween(input.dateString, input.userCreatedAt) <= 14 : false;
  const hasEnoughMatchHistory = matches.length >= 3;
  const hasEnoughPhysicalHistory = hasUsableWhoop || Boolean(checkIn);

  const newUserFallback = isNewAccount && (!hasEnoughPhysicalHistory || !hasEnoughMatchHistory);

  const physical =
    hasUsableWhoop && whoop && baseline
      ? round(
          whoop.recoveryScore * 0.35 +
            average([whoop.sleepPerformance, normalizeSleepDuration(whoop.sleepDurationMs)]) * 0.25 +
            normalizeHrvTrend(whoop.hrvRmssd, baseline.avgHrvRmssd7d) * 0.2 +
            normalizeStrainBalance(whoop.strain, whoop.recoveryScore) * 0.12 +
            normalizeRestingHeartRate(whoop.restingHeartRate, baseline.avgRestingHeartRate7d) * 0.08
        )
      : checkIn
        ? estimateManualPhysicalReadiness(checkIn)
        : DEFAULT_PHYSICAL;

  const performance =
    recentMatches.length > 0
      ? round(
          normalizeRatingTrajectory(dupr?.ratingTrend14d ?? 0) * 0.3 +
            normalizeMatchVolume(last14Matches.length) * 0.25 +
            normalizeWinRate(winRate) * 0.25 +
            normalizeScoreMargin(avgMargin) * 0.2
        )
      : DEFAULT_PERFORMANCE;

  const activity = whoop
    ? round(
        normalizeDaysSinceMatch(daysSinceLastMatch) * 0.4 +
          normalizeWeeklyActivity(baseline?.weeklyActivityScore ?? 72) * 0.35 +
          normalizeStrainRecoveryRatio(whoop.strain, whoop.recoveryScore) * 0.25
      )
    : checkIn
      ? round(
          normalizeDaysSinceMatch(daysSinceLastMatch) * 0.55 +
            normalizeFivePointScale(checkIn.energy) * 0.25 +
            normalizeInverseFivePointScale(checkIn.soreness) * 0.2
        )
      : 65;

  const weightedOverall = round(physical * 0.45 + performance * 0.35 + activity * 0.2);
  const overall = newUserFallback ? DEFAULT_OVERALL : weightedOverall;

  const explanations: ChangeExplanation[] = [];

  if (hasUsableWhoop && whoop && baseline) {
    explanations.push(
      buildImpact(
        "recovery",
        whoop.recoveryScore,
        65,
        0.45 * 0.35,
        `${whoop.recoveryScore >= 65 ? "Recovery held up" : "Whoop recovery dropped"} to ${whoop.recoveryScore}% after ${(whoop.sleepDurationMs / 3_600_000).toFixed(1)} hours of sleep.`
      ),
      buildImpact(
        "sleep",
        average([whoop.sleepPerformance, normalizeSleepDuration(whoop.sleepDurationMs)]),
        65,
        0.45 * 0.25,
        `Sleep performance landed at ${whoop.sleepPerformance}% with ${round(whoop.sleepDurationMs / 3_600_000, 1)} hours logged.`
      )
    );
  } else if (checkIn) {
    explanations.push(
      buildImpact(
        "morning check-in",
        physical,
        65,
        0.45,
        `${checkIn.sleepHours.toFixed(1)} hours of sleep, energy ${checkIn.energy}/5, and soreness ${checkIn.soreness}/5 shaped today’s manual physical estimate.`
      )
    );

    if (checkIn.illness || checkIn.alcohol || checkIn.travel || checkIn.painAreas.length > 0) {
      explanations.push({
        factor: "manual penalties",
        impact: -round((checkIn.illness ? 18 : 0) + (checkIn.alcohol ? 8 : 0) + (checkIn.travel ? 6 : 0) + (checkIn.painAreas.length > 0 ? 10 : 0)),
        description: `Extra readiness drag came from ${[
          checkIn.illness ? "illness" : null,
          checkIn.alcohol ? "alcohol" : null,
          checkIn.travel ? "travel" : null,
          checkIn.painAreas.length > 0 ? "pain/injury" : null
        ]
          .filter(Boolean)
          .join(", ")}.`
      });
    }
  } else {
    explanations.push({
      factor: "physical fallback",
      impact: 0,
      description:
        whoop && baseline && !hasUsableWhoop
          ? "Whoop is still calibrating, so physical readiness is holding at the fallback until enough recovery history is available."
          : "Physical readiness is defaulting to 65 until Whoop or a Morning Check-In is available."
    });
  }

  if (recentMatches.length === 0) {
    explanations.push({
      factor: "match history",
      impact: 0,
      description: "Performance readiness is sitting at the default until a few matches are logged."
    });
  } else {
    explanations.push(
      buildImpact(
        "results",
        normalizeWinRate(winRate),
        60,
        0.35 * 0.25,
        `${recentMatches.filter((match) => match.result === "win").length}-${recentMatches.length - recentMatches.filter((match) => match.result === "win").length} over your last ${recentMatches.length} matches is shaping the performance sub-score.`
      ),
      buildImpact(
        "match volume",
        normalizeMatchVolume(last14Matches.length),
        65,
        0.35 * 0.25,
        `${last14Matches.length} matches in the last 14 days has your rhythm ${last14Matches.length >= 4 ? "dialed in" : "still building"}.`
      )
    );
  }

  explanations.push(
    buildImpact(
      "cadence",
      normalizeDaysSinceMatch(daysSinceLastMatch),
      65,
      0.2 * 0.4,
      daysSinceLastMatch == null
        ? "Once you log some matches, rhythm timing will start to move the score."
        : `${daysSinceLastMatch} day${daysSinceLastMatch === 1 ? "" : "s"} since your last match is affecting your rhythm score.`
    )
  );

  if (newUserFallback) {
    explanations.unshift({
      factor: "new user calibration",
      impact: 0,
      description: "We are holding your overall score near 65 until your baseline has enough physical input and at least 3 logged matches."
    });
  }

  const sortedExplanations = explanations
    .sort((left, right) => Math.abs(right.impact) - Math.abs(left.impact))
    .slice(0, 4);

  return {
    dateString: isoDateKey(input.dateString),
    overall,
    physical,
    performance,
    activity,
    whoopData: whoop ?? {},
    checkInData: checkIn ?? undefined,
    duprData: {
      singlesRating: dupr?.singlesRating,
      doublesRating: dupr?.doublesRating,
      ratingTrend: dupr?.ratingTrend14d
    },
    matchData: matchAggregate,
    changeExplanations: sortedExplanations,
    calculatedAt,
    label: getScoreLabel(overall),
    confidence,
    physicalSource
  };
};
