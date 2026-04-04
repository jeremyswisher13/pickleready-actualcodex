import type { MatchRecord, ReadinessScore } from "./types";
import { dateKeyInTimeZone } from "./utils";

export interface MatchupDiagnosis {
  verdict: "fatigue" | "matchup" | "mixed" | "steady";
  headline: string;
  summary: string;
  supportingPoints: string[];
}

const getOpponentAverageRating = (match: MatchRecord) => {
  if (typeof match.opponentAverageRating === "number") {
    return match.opponentAverageRating;
  }

  const ratings = match.opponents
    .map((opponent) => opponent.rating)
    .filter((rating): rating is number => typeof rating === "number");

  if (ratings.length === 0) {
    return null;
  }

  return ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
};

export const diagnoseFatigueVsMatchup = (
  readiness: ReadinessScore | null,
  matches: MatchRecord[],
  currentRecScore: number,
  userTimeZone = "UTC"
): MatchupDiagnosis => {
  if (!readiness || matches.length === 0) {
    return {
      verdict: "steady",
      headline: "Need a few more reps",
      summary: "Once you log matches, PickleReady can separate body readiness from opponent difficulty.",
      supportingPoints: [
        "Log at least 3 matches to establish matchup context.",
        "Whoop data sharpens the fatigue side of the diagnosis."
      ]
    };
  }

  const latestMatch = [...matches].sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())[0];
  const latestMatchDateKey = dateKeyInTimeZone(latestMatch.date, userTimeZone);

  if (latestMatchDateKey !== readiness.dateString) {
    return {
      verdict: "steady",
      headline: "Today is still pre-match",
      summary:
        "You have a readiness score for today, but you have not logged a same-day match yet, so the fatigue-versus-matchup call is waiting on a fresh result.",
      supportingPoints: [
        `Today's readiness is ${readiness.overall} and points to a ${readiness.label.toLowerCase()} type of day.`,
        `Your latest logged result was on ${latestMatchDateKey}, so today's diagnosis will sharpen after you log a match.`
      ]
    };
  }

  const opponentRating = getOpponentAverageRating(latestMatch);
  const readinessGap = readiness.overall - 65;
  const ratingGap = typeof opponentRating === "number" ? opponentRating - currentRecScore : 0;
  const isLoss = latestMatch.result === "loss";

  const supportingPoints = [
    `Latest readiness was ${readiness.overall}, which is ${readinessGap >= 0 ? "above" : "below"} your neutral zone.`,
    typeof opponentRating === "number"
      ? `Opponent level came in around ${opponentRating.toFixed(2)} against your ${currentRecScore.toFixed(2)} rec score.`
      : "No opponent rating was available, so the diagnosis leans more on readiness and head-to-head context."
  ];

  if (isLoss && readiness.overall < 60 && ratingGap <= 0.15) {
    return {
      verdict: "fatigue",
      headline: "Fatigue probably mattered more",
      summary: "You lost on a below-par readiness day without running into a clearly stronger opponent, so the body signal is louder than the matchup signal.",
      supportingPoints
    };
  }

  if (isLoss && readiness.overall >= 70 && ratingGap >= 0.2) {
    return {
      verdict: "matchup",
      headline: "This looks more like a matchup problem",
      summary: "Readiness was solid, but the opponent profile still sat above your current line, which points more toward matchup difficulty than fatigue.",
      supportingPoints
    };
  }

  if (isLoss && readiness.overall < 65 && ratingGap >= 0.2) {
    return {
      verdict: "mixed",
      headline: "It was probably both",
      summary: "You were not at your best and the opponent still presented a real rating gap, so fatigue and matchup pressure both showed up.",
      supportingPoints
    };
  }

  if (!isLoss && readiness.overall < 60) {
    return {
      verdict: "steady",
      headline: "You beat the fatigue signal",
      summary: "The body score was soft, but you still got through the matchup, which says the result was more about execution than readiness drag.",
      supportingPoints
    };
  }

  if (!isLoss && ratingGap >= 0.2) {
    return {
      verdict: "steady",
      headline: "You beat the matchup",
      summary: "You handled a stronger rating profile without needing a perfect readiness day, which is exactly the kind of result that should move trust upward.",
      supportingPoints
    };
  }

  return {
    verdict: "mixed",
    headline: "The signals are fairly balanced",
    summary: "Nothing in the latest result points overwhelmingly to fatigue or matchup alone, so this one reads more like a normal performance swing.",
    supportingPoints
  };
};
