import { format, isToday, parseISO } from "date-fns";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import type { MatchRecord } from "@shared/domain/types";
import { average } from "@shared/domain/utils";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const formatShortDate = (isoString: string) => {
  const date = parseISO(isoString);
  return isToday(date) ? "Today" : format(date, "MMM d");
};

export const formatLongDate = (isoString: string) => format(parseISO(isoString), "EEEE, MMM d");

export const formatMatchScore = (match: MatchRecord) =>
  match.games.map((game) => `${game.myScore}-${game.opponentScore}`).join(", ");

export const formatSignedNumber = (value: number, digits = 2) =>
  `${value >= 0 ? "+" : "-"}${Math.abs(value).toFixed(digits)}`;

export const getMatchOpponentLabel = (match: MatchRecord) => match.opponents.map((opponent) => opponent.name).join(" / ");

export const getOpponentAverageRating = (match: MatchRecord) => {
  if (typeof match.opponentAverageRating === "number") {
    return match.opponentAverageRating;
  }

  const ratings = match.opponents
    .map((opponent) => opponent.rating)
    .filter((rating): rating is number => typeof rating === "number");

  return ratings.length > 0 ? average(ratings) : undefined;
};

export const scoreToGradient = (score: number) => {
  if (score >= 80) {
    return "from-cyan-300 via-blue-500 to-violet-500";
  }

  if (score >= 60) {
    return "from-sky-300 via-blue-500 to-indigo-500";
  }

  if (score >= 40) {
    return "from-amber-200 via-orange-400 to-fuchsia-500";
  }

  return "from-rose-300 via-orange-400 to-red-500";
};
