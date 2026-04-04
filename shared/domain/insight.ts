import type { InsightContext } from "./types";
import { averageMatchMargin } from "./rec-score";
import { round } from "./utils";

const formatRating = (rating?: number | null) => (typeof rating === "number" ? rating.toFixed(2) : null);

const describeRecDelta = (delta: number, newScore: number) => {
  const direction = delta >= 0 ? "up" : "down";
  return `Rec score ${direction} ${Math.abs(delta).toFixed(2)} to ${newScore.toFixed(2)}.`;
};

const buildPrimarySentence = (context: InsightContext) => {
  const opponentName = context.match.opponents.map((opponent) => opponent.name).join(" / ");
  const opponentRating = formatRating(context.opponentRating);
  const readiness = context.readiness.overall;
  const margin = Math.abs(averageMatchMargin(context.match.games));

  if (readiness < 60 && context.match.result === "win") {
    return `Gutsy win over ${opponentName}${opponentRating ? ` (${opponentRating})` : ""} while your readiness sat at ${readiness}.`;
  }

  if (readiness < 60 && context.match.result === "loss") {
    return `Tough loss to ${opponentName}${opponentRating ? ` (${opponentRating})` : ""} on a day your body was only giving you ${readiness} readiness.`;
  }

  if (readiness >= 80 && context.match.result === "loss") {
    return `Loss to ${opponentName}${opponentRating ? ` (${opponentRating})` : ""} despite an ${readiness} readiness score is one worth looking at more closely.`;
  }

  if (typeof context.opponentRating === "number" && context.match.result === "win" && context.opponentRating - context.previousRecScore >= 0.25) {
    return `Upset win over ${opponentName} (${context.opponentRating.toFixed(2)}) with you entering at ${context.previousRecScore.toFixed(2)}.`;
  }

  if (typeof context.opponentRating === "number" && context.match.result === "loss" && context.previousRecScore - context.opponentRating >= 0.25) {
    return `Upset loss to ${opponentName} (${context.opponentRating.toFixed(2)}) after coming in as the higher-rated side.`;
  }

  if (context.match.games.length >= 3) {
    return `${context.match.result === "win" ? "Won" : "Lost"} a three-game battle against ${opponentName}${opponentRating ? ` (${opponentRating})` : ""}.`;
  }

  if (context.match.result === "win" && margin >= 5) {
    return `Controlled win over ${opponentName}${opponentRating ? ` (${opponentRating})` : ""} with clear separation on the scoreboard.`;
  }

  if (context.match.result === "loss" && margin < 3) {
    return `Close loss to ${opponentName}${opponentRating ? ` (${opponentRating})` : ""} that stayed in the balance most of the way.`;
  }

  return `${context.match.result === "win" ? "Beat" : "Lost to"} ${opponentName}${opponentRating ? ` (${opponentRating})` : ""} with your readiness at ${readiness}.`;
};

const buildSeriesSentence = (context: InsightContext) => {
  const totalBefore = context.h2hMatchesBefore;

  if (totalBefore < 2) {
    return null;
  }

  if (context.match.result === "win" && context.h2hWinsBefore >= 2) {
    return `That makes it ${context.h2hWinsBefore + 1} straight wins in this matchup.`;
  }

  if (context.match.result === "loss" && context.h2hLossesBefore >= 2) {
    return `That is ${context.h2hLossesBefore + 1} straight losses in this matchup, so the rivalry trend is turning.`;
  }

  const wins = context.h2hWinsBefore + (context.match.result === "win" ? 1 : 0);
  const losses = context.h2hLossesBefore + (context.match.result === "loss" ? 1 : 0);

  return `Head-to-head is now ${wins}-${losses}, so this one is becoming a real reference point.`;
};

export const generatePostMatchInsight = (context: InsightContext) => {
  const delta = round(context.newRecScore - context.previousRecScore, 2);
  const scoreSentence = describeRecDelta(delta, context.newRecScore);
  const primarySentence = buildPrimarySentence(context);
  const seriesSentence = buildSeriesSentence(context);

  if (seriesSentence) {
    return `${primarySentence} ${seriesSentence} ${scoreSentence}`;
  }

  return `${primarySentence} ${scoreSentence}`;
};
