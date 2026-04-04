"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { ArrowRight, Search } from "lucide-react";

import type { OpponentProfile } from "@shared/domain/types";
import { calculateExpectedOutcome } from "@shared/domain/rec-score";

import { Card, SectionTitle, TrendBadge } from "@/components/ui";
import { formatShortDate } from "@/lib/utils";

export const PlayersTab = ({
  opponents,
  currentRecScore,
  onQuickLog
}: {
  opponents: OpponentProfile[];
  currentRecScore: number;
  onQuickLog: (opponentName?: string) => void;
}) => {
  const [query, setQuery] = useState("");
  const [selectedOpponentId, setSelectedOpponentId] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query);

  const filteredOpponents = useMemo(() => {
    const normalized = deferredQuery.trim().toLowerCase();
    if (!normalized) {
      return opponents;
    }

    return opponents.filter(
      (opponent) =>
        opponent.name.toLowerCase().includes(normalized) ||
        opponent.duprId?.toLowerCase().includes(normalized)
    );
  }, [deferredQuery, opponents]);

  const selectedOpponent =
    filteredOpponents.find((opponent) => opponent.id === selectedOpponentId) ??
    filteredOpponents[0] ??
    null;

  const projectedWinRate = selectedOpponent?.rating
    ? calculateExpectedOutcome(currentRecScore, selectedOpponent.rating)
    : 0.5;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-500">Players</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink">Know the matchup before you step on court.</h2>
      </div>

      <Card className="px-4 py-4">
        <label className="flex items-center gap-3 rounded-[22px] border border-blue-100 bg-blue-50/40 px-4 py-3">
          <Search className="h-4 w-4 text-blue-600" />
          <input
            className="w-full bg-transparent text-sm text-ink outline-none"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by player name or DUPR ID"
            value={query}
          />
        </label>
      </Card>

      <div className="space-y-3">
        {filteredOpponents.length > 0 ? (
          filteredOpponents.map((opponent) => (
            <button
              key={opponent.id}
              className="w-full text-left"
              onClick={() => setSelectedOpponentId(opponent.id)}
              type="button"
            >
              <Card className={`px-4 py-4 ${selectedOpponent?.id === opponent.id ? "ring-2 ring-blue-300" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-ink">{opponent.name}</p>
                    <p className="mt-1 text-sm text-muted">
                      {opponent.matchesPlayed} matches • {opponent.wins}-{opponent.losses}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold tracking-[-0.05em] text-ink">
                      {opponent.rating ? opponent.rating.toFixed(2) : "--"}
                    </p>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-500">DUPR</p>
                  </div>
                </div>
              </Card>
            </button>
          ))
        ) : (
          <Card className="px-4 py-5">
            <p className="text-sm font-semibold text-ink">No opponent profiles yet</p>
            <p className="mt-2 text-sm leading-6 text-muted">
              As soon as you log a couple of matches, this tab turns into your scouting report and pre-match prep space.
            </p>
          </Card>
        )}
      </div>

      {selectedOpponent ? (
        <Card className="overflow-hidden px-5 py-5">
          <SectionTitle eyebrow="Pre-match view" title={`Play ${selectedOpponent.name}`} />
          <div className="mt-4 rounded-[24px] bg-gradient-to-br from-cyan-50 via-blue-50 to-violet-50 p-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[20px] bg-white/80 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Projected outcome</p>
                <p className="mt-2 text-3xl font-bold tracking-[-0.05em] text-ink">{Math.round(projectedWinRate * 100)}%</p>
              </div>
              <div className="rounded-[20px] bg-white/80 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Avg margin</p>
                <p className="mt-2 text-3xl font-bold tracking-[-0.05em] text-ink">{selectedOpponent.avgMargin.toFixed(1)}</p>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <TrendBadge
                label={`${selectedOpponent.wins}-${selectedOpponent.losses} H2H`}
                positive={selectedOpponent.wins >= selectedOpponent.losses}
              />
              <TrendBadge
                label={`Last played ${formatShortDate(selectedOpponent.lastPlayed)}`}
                positive={true}
              />
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {selectedOpponent.lastFiveMatches.map((match) => (
              <div key={match.id} className="rounded-[20px] border border-blue-100 bg-blue-50/40 px-4 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-ink">{match.games.map((game) => `${game.myScore}-${game.opponentScore}`).join(", ")}</p>
                  <TrendBadge label={match.result.toUpperCase()} positive={match.result === "win"} />
                </div>
                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                  {formatShortDate(match.date)}
                </p>
              </div>
            ))}
          </div>

          <button
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-[22px] bg-cta px-4 py-4 text-sm font-semibold text-white shadow-glow"
            onClick={() => onQuickLog(selectedOpponent.name)}
            type="button"
          >
            Play this person
            <ArrowRight className="h-4 w-4" />
          </button>
        </Card>
      ) : null}
    </div>
  );
};
