"use client";

import { useEffect, useMemo, useState } from "react";
import { Sparkles, X } from "lucide-react";

import type { OpponentProfile } from "@shared/domain/types";
import { average } from "@shared/domain/utils";
import { deriveMatchResult } from "@shared/domain/rec-score";
import type {
  GenderFormat,
  MatchCategory,
  MatchEnvironment,
  MatchFormat,
  MatchRecord,
  MatchType,
  ReadinessScore
} from "@shared/domain/types";

import { Card, SegmentedControl } from "@/components/ui";
import { cn } from "@/lib/utils";

interface MatchLogSheetProps {
  open: boolean;
  initialMatch?: MatchRecord | null;
  prefilledOpponentName?: string | null;
  opponents: OpponentProfile[];
  currentReadiness: ReadinessScore | null;
  onClose: () => void;
  onSave: (match: MatchRecord) => void;
}

interface OpponentDraft {
  name: string;
  rating: string;
}

interface MatchDraft {
  date: string;
  matchType: MatchType;
  category: MatchCategory;
  format: MatchFormat;
  environment: MatchEnvironment;
  genderFormat: GenderFormat;
  partnerName: string;
  partnerRating: string;
  opponents: OpponentDraft[];
  verified: boolean;
  notes: string;
  games: { myScore: string; opponentScore: string }[];
  gameCount: 2 | 3;
}

const toLocalDateTimeInput = (value?: string) => {
  const date = value ? new Date(value) : new Date();
  const localTime = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localTime.toISOString().slice(0, 16);
};

const createDraft = (match?: MatchRecord | null, prefilledOpponentName?: string | null): MatchDraft => ({
  date: toLocalDateTimeInput(match?.date),
  matchType: match?.matchType ?? "singles",
  category: match?.category ?? "rec",
  format: match?.format ?? "standard",
  environment: match?.environment ?? "outdoor",
  genderFormat: match?.genderFormat ?? "open",
  partnerName: match?.partner?.name ?? "",
  partnerRating: match?.partner?.rating?.toString() ?? "",
  opponents: Array.from({ length: 2 }, (_, index) => ({
    name: match?.opponents[index]?.name ?? (index === 0 ? prefilledOpponentName ?? "" : ""),
    rating: match?.opponents[index]?.rating?.toString() ?? ""
  })),
  verified: match?.verified ?? false,
  notes: match?.notes ?? "",
  games: Array.from({ length: 3 }, (_, index) => ({
    myScore: match?.games[index]?.myScore?.toString() ?? "",
    opponentScore: match?.games[index]?.opponentScore?.toString() ?? ""
  })),
  gameCount: match?.games.length === 3 ? 3 : 2
});

const choicePill =
  "rounded-full border border-blue-100 bg-blue-50/70 px-3 py-2 text-xs font-semibold text-ink transition data-[active=true]:border-transparent data-[active=true]:bg-gradient-to-r data-[active=true]:from-cyan-400 data-[active=true]:via-blue-500 data-[active=true]:to-violet-500 data-[active=true]:text-white";

export const MatchLogSheet = ({
  open,
  initialMatch,
  prefilledOpponentName,
  opponents,
  currentReadiness,
  onClose,
  onSave
}: MatchLogSheetProps) => {
  const [draft, setDraft] = useState<MatchDraft>(createDraft(initialMatch, prefilledOpponentName));
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(createDraft(initialMatch, prefilledOpponentName));
      setFormError(null);
    }
  }, [initialMatch, open, prefilledOpponentName]);

  const knownOpponentMap = useMemo(
    () =>
      new Map(opponents.map((opponent) => [opponent.name.toLowerCase(), opponent])),
    [opponents]
  );

  if (!open) {
    return null;
  }

  const opponentSlots = draft.matchType === "doubles" ? 2 : 1;

  const updateOpponent = (index: number, field: keyof OpponentDraft, value: string) => {
    setDraft((current) => ({
      ...current,
      opponents: current.opponents.map((opponent, opponentIndex) =>
        opponentIndex === index ? { ...opponent, [field]: value } : opponent
      )
    }));
  };

  const updateGame = (index: number, field: "myScore" | "opponentScore", value: string) => {
    setDraft((current) => ({
      ...current,
      games: current.games.map((game, gameIndex) => (gameIndex === index ? { ...game, [field]: value } : game))
    }));
  };

  const handleSubmit = () => {
    const parsedDate = new Date(draft.date);
    if (Number.isNaN(parsedDate.getTime())) {
      setFormError("Add a valid match date and time.");
      return;
    }

    if (draft.matchType === "doubles" && draft.partnerName.trim().length === 0) {
      setFormError("Add your partner before logging a doubles match.");
      return;
    }

    if (draft.partnerRating.trim().length > 0 && !Number.isFinite(Number(draft.partnerRating))) {
      setFormError("Use a valid numeric rating for your partner, or leave it blank.");
      return;
    }

    const preparedOpponents = draft.opponents
      .slice(0, opponentSlots)
      .filter((opponent) => opponent.name.trim().length > 0)
      .map((opponent) => {
        const known = knownOpponentMap.get(opponent.name.trim().toLowerCase());
        const parsedRating = opponent.rating.trim().length > 0 ? Number(opponent.rating) : known?.rating;

        if (opponent.rating.trim().length > 0 && !Number.isFinite(parsedRating)) {
          return null;
        }

        return {
          name: opponent.name.trim(),
          rating: parsedRating,
          duprId: known?.duprId,
          userId: known?.userId
        };
      });
    const visibleGames = draft.games.slice(0, draft.gameCount);

    if (preparedOpponents.some((opponent) => opponent == null)) {
      setFormError("Use a valid numeric rating for opponents, or leave the rating blank.");
      return;
    }

    const validOpponents = preparedOpponents.filter(
      (opponent): opponent is NonNullable<(typeof preparedOpponents)[number]> => Boolean(opponent)
    );

    if (validOpponents.length !== opponentSlots) {
      setFormError(`Add ${opponentSlots === 1 ? "your opponent" : "both opponents"} before logging the match.`);
      return;
    }

    if (
      visibleGames.some(
        (game) =>
          (game.myScore.trim().length > 0 && game.opponentScore.trim().length === 0) ||
          (game.myScore.trim().length === 0 && game.opponentScore.trim().length > 0)
      )
    ) {
      setFormError("Complete both sides of each score row, or clear the row entirely.");
      return;
    }

    const preparedGames = visibleGames
      .filter((game) => game.myScore.trim().length > 0 && game.opponentScore.trim().length > 0)
      .map((game) => ({
        myScore: Number(game.myScore),
        opponentScore: Number(game.opponentScore)
      }));

    if (
      preparedGames.some(
        (game) =>
          !Number.isFinite(game.myScore) ||
          !Number.isFinite(game.opponentScore) ||
          !Number.isInteger(game.myScore) ||
          !Number.isInteger(game.opponentScore) ||
          game.myScore < 0 ||
          game.opponentScore < 0
      )
    ) {
      setFormError("Enter whole, non-negative scores for each completed game.");
      return;
    }

    if (preparedGames.length < 2) {
      setFormError("Log at least two completed games before saving the match.");
      return;
    }

    const wins = preparedGames.filter((game) => game.myScore > game.opponentScore).length;
    const losses = preparedGames.filter((game) => game.myScore < game.opponentScore).length;

    if (wins === losses) {
      setFormError("This scoreline is still tied. Add the deciding game before saving the match.");
      return;
    }

    const opponentRatings = validOpponents
      .map((opponent) => opponent.rating)
      .filter((rating): rating is number => typeof rating === "number");

    const match: MatchRecord = {
      id: initialMatch?.id ?? `match-${crypto.randomUUID()}`,
      date: parsedDate.toISOString(),
      createdAt: initialMatch?.createdAt ?? new Date().toISOString(),
      matchType: draft.matchType,
      category: draft.category,
      format: draft.format,
      environment: draft.environment,
      genderFormat: draft.genderFormat,
      opponents: validOpponents,
      partner:
        draft.matchType === "doubles" && draft.partnerName.trim()
          ? {
              name: draft.partnerName.trim(),
              rating: draft.partnerRating ? Number(draft.partnerRating) : undefined
            }
          : undefined,
      games: preparedGames,
      result: deriveMatchResult(preparedGames),
      notes: draft.notes.trim(),
      verified: draft.verified,
      verifiedBy: initialMatch?.verifiedBy ?? [],
      readinessAtTime: initialMatch?.readinessAtTime ?? currentReadiness?.overall ?? 65,
      postMatchInsight: initialMatch?.postMatchInsight ?? "",
      opponentAverageRating: opponentRatings.length > 0 ? average(opponentRatings) : undefined
    };

    setFormError(null);
    onSave(match);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center overflow-y-auto bg-slate-950/40 p-3 backdrop-blur-sm">
      <Card className="flex max-h-[92vh] w-full max-w-[390px] flex-col overflow-hidden rounded-[32px]">
        <div className="flex shrink-0 items-center justify-between border-b border-blue-50 px-5 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-500">
              {initialMatch ? "Edit Match" : "Quick Log"}
            </p>
            <h3 className="text-lg font-semibold text-ink">Log the session details</h3>
          </div>
          <button className="rounded-full bg-blue-50 p-2 text-blue-700" onClick={onClose} type="button">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-y-contain px-5 pb-8 pt-5 touch-pan-y [-webkit-overflow-scrolling:touch]">
          <div className="rounded-[24px] bg-gradient-to-r from-cyan-50 via-blue-50 to-violet-50 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-blue-700">
              <Sparkles className="h-4 w-4" />
              Readiness at log time: {currentReadiness?.overall ?? 65}
            </div>
            <p className="mt-1 text-sm text-muted">
              We will use this moment-in-time score when we generate the post-match insight.
            </p>
          </div>

          <div className="space-y-3">
            <label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Match Type</label>
            <SegmentedControl
              options={[
                { label: "Singles", value: "singles" },
                { label: "Doubles", value: "doubles" }
              ]}
              value={draft.matchType}
              onChange={(value) => setDraft((current) => ({ ...current, matchType: value }))}
            />
          </div>

          <div className="space-y-3">
            <label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Date</label>
            <input
              className="w-full rounded-2xl border border-blue-100 bg-blue-50/40 px-4 py-3 text-sm text-ink outline-none ring-blue-300 transition focus:ring-2"
              onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))}
              type="datetime-local"
              value={draft.date}
            />
          </div>

          <div className="space-y-3">
            <label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Opponents</label>
            {Array.from({ length: opponentSlots }, (_, index) => (
              <div key={`opponent-${index}`} className="grid grid-cols-[1fr_88px] gap-3">
                <input
                  className="rounded-2xl border border-blue-100 bg-blue-50/40 px-4 py-3 text-sm text-ink outline-none ring-blue-300 transition focus:ring-2"
                  list="known-opponents"
                  onChange={(event) => updateOpponent(index, "name", event.target.value)}
                  placeholder={index === 0 ? "Opponent name" : "Second opponent"}
                  value={draft.opponents[index].name}
                />
                <input
                  className="rounded-2xl border border-blue-100 bg-blue-50/40 px-4 py-3 text-sm text-ink outline-none ring-blue-300 transition focus:ring-2"
                  inputMode="decimal"
                  onChange={(event) => updateOpponent(index, "rating", event.target.value)}
                  placeholder="4.35"
                  value={draft.opponents[index].rating}
                />
              </div>
            ))}
            <datalist id="known-opponents">
              {opponents.map((opponent) => (
                <option key={opponent.id} value={opponent.name} />
              ))}
            </datalist>
          </div>

          {draft.matchType === "doubles" ? (
            <div className="space-y-3">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Partner</label>
              <div className="grid grid-cols-[1fr_88px] gap-3">
                <input
                  className="rounded-2xl border border-blue-100 bg-blue-50/40 px-4 py-3 text-sm text-ink outline-none ring-blue-300 transition focus:ring-2"
                  onChange={(event) => setDraft((current) => ({ ...current, partnerName: event.target.value }))}
                  placeholder="Partner name"
                  value={draft.partnerName}
                />
                <input
                  className="rounded-2xl border border-blue-100 bg-blue-50/40 px-4 py-3 text-sm text-ink outline-none ring-blue-300 transition focus:ring-2"
                  inputMode="decimal"
                  onChange={(event) => setDraft((current) => ({ ...current, partnerRating: event.target.value }))}
                  placeholder="4.20"
                  value={draft.partnerRating}
                />
              </div>
            </div>
          ) : null}

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Games</label>
              <SegmentedControl
                options={[
                  { label: "2 games", value: 2 },
                  { label: "3 games", value: 3 }
                ]}
                value={draft.gameCount}
                onChange={(value) => setDraft((current) => ({ ...current, gameCount: value }))}
              />
            </div>

            {draft.games.slice(0, draft.gameCount).map((game, index) => (
              <div key={`game-${index}`} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <input
                  className="rounded-2xl border border-blue-100 bg-blue-50/40 px-4 py-3 text-center text-base font-semibold text-ink outline-none ring-blue-300 transition focus:ring-2"
                  inputMode="numeric"
                  onChange={(event) => updateGame(index, "myScore", event.target.value)}
                  placeholder="11"
                  value={game.myScore}
                />
                <span className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">to</span>
                <input
                  className="rounded-2xl border border-blue-100 bg-blue-50/40 px-4 py-3 text-center text-base font-semibold text-ink outline-none ring-blue-300 transition focus:ring-2"
                  inputMode="numeric"
                  onChange={(event) => updateGame(index, "opponentScore", event.target.value)}
                  placeholder="7"
                  value={game.opponentScore}
                />
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Context</label>
            <div className="grid gap-3">
              <div className="flex flex-wrap gap-2">
                {(["rec", "league", "tournament"] as MatchCategory[]).map((option) => (
                  <button
                    key={option}
                    className={choicePill}
                    data-active={draft.category === option}
                    onClick={() => setDraft((current) => ({ ...current, category: option }))}
                    type="button"
                  >
                    {option}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {(["standard", "rally", "mto"] as MatchFormat[]).map((option) => (
                  <button
                    key={option}
                    className={choicePill}
                    data-active={draft.format === option}
                    onClick={() => setDraft((current) => ({ ...current, format: option }))}
                    type="button"
                  >
                    {option}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {(["outdoor", "indoor"] as MatchEnvironment[]).map((option) => (
                  <button
                    key={option}
                    className={choicePill}
                    data-active={draft.environment === option}
                    onClick={() => setDraft((current) => ({ ...current, environment: option }))}
                    type="button"
                  >
                    {option}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {(["open", "mixed", "mens", "womens"] as GenderFormat[]).map((option) => (
                  <button
                    key={option}
                    className={choicePill}
                    data-active={draft.genderFormat === option}
                    onClick={() => setDraft((current) => ({ ...current, genderFormat: option }))}
                    type="button"
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <label className="flex items-center justify-between rounded-2xl border border-blue-100 bg-blue-50/40 px-4 py-3">
            <span>
              <span className="block text-sm font-semibold text-ink">Verified result</span>
              <span className="block text-xs text-muted">Applies the 1.5x confidence multiplier in the rec engine.</span>
            </span>
            <button
              aria-pressed={draft.verified}
              className={cn(
                "h-8 w-14 rounded-full p-1 transition",
                draft.verified ? "bg-blue-600" : "bg-blue-100"
              )}
              onClick={() => setDraft((current) => ({ ...current, verified: !current.verified }))}
              type="button"
            >
              <span
                className={cn(
                  "block h-6 w-6 rounded-full bg-white shadow transition",
                  draft.verified ? "translate-x-6" : "translate-x-0"
                )}
              />
            </button>
          </label>

          <div className="space-y-3">
            <label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Notes</label>
            <textarea
              className="min-h-24 w-full rounded-2xl border border-blue-100 bg-blue-50/40 px-4 py-3 text-sm text-ink outline-none ring-blue-300 transition focus:ring-2"
              onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
              placeholder="Anything you noticed about how you moved, competed, or matched up."
              value={draft.notes}
            />
          </div>

          <button
            className="w-full rounded-[22px] bg-cta px-4 py-4 text-sm font-semibold text-white shadow-glow"
            onClick={handleSubmit}
            type="button"
          >
            {initialMatch ? "Save match changes" : "Log match and update scores"}
          </button>
          {formError ? <p className="text-sm leading-6 text-rose-600">{formError}</p> : null}
        </div>
      </Card>
    </div>
  );
};
