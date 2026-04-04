"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import type { MatchCategory, MatchRecord } from "@shared/domain/types";

import { Card, SectionTitle, SegmentedControl, TrendBadge } from "@/components/ui";
import { formatMatchScore, formatShortDate, getMatchOpponentLabel } from "@/lib/utils";

type ResultFilter = "all" | "wins" | "losses";
type CategoryFilter = "all" | MatchCategory;

export const MatchesTab = ({
  matches,
  onOpenMatch,
  onLogMatch
}: {
  matches: MatchRecord[];
  onOpenMatch: (match: MatchRecord) => void;
  onLogMatch: () => void;
}) => {
  const [resultFilter, setResultFilter] = useState<ResultFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");

  const filteredMatches = matches.filter((match) => {
    if (resultFilter === "wins" && match.result !== "win") {
      return false;
    }

    if (resultFilter === "losses" && match.result !== "loss") {
      return false;
    }

    if (categoryFilter !== "all" && match.category !== categoryFilter) {
      return false;
    }

    return true;
  });

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-500">Match history</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink">Every result, with context attached.</h2>
      </div>

      <Card className="px-4 py-4">
        <SectionTitle eyebrow="Filters" title="Slice the history" />
        <div className="mt-4 flex flex-col gap-3">
          <SegmentedControl
            options={[
              { label: "All", value: "all" },
              { label: "Wins", value: "wins" },
              { label: "Losses", value: "losses" }
            ]}
            value={resultFilter}
            onChange={setResultFilter}
          />
          <SegmentedControl
            options={[
              { label: "All", value: "all" },
              { label: "Rec", value: "rec" },
              { label: "League", value: "league" },
              { label: "Tourney", value: "tournament" }
            ]}
            value={categoryFilter}
            onChange={setCategoryFilter}
          />
        </div>
      </Card>

      <div className="space-y-3">
        {filteredMatches.length > 0 ? (
          filteredMatches.map((match) => (
            <button
              key={match.id}
              className="w-full text-left"
              onClick={() => onOpenMatch(match)}
              type="button"
            >
              <Card className="px-4 py-4 transition hover:translate-y-[-1px]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-ink">{getMatchOpponentLabel(match)}</p>
                    <p className="mt-1 text-sm text-muted">{formatMatchScore(match)}</p>
                    <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                      {formatShortDate(match.date)} • {match.matchType}
                    </p>
                  </div>
                  <div className="text-right">
                    <TrendBadge label={match.result.toUpperCase()} positive={match.result === "win"} />
                    <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-blue-500">{match.category}</p>
                  </div>
                </div>
              </Card>
            </button>
          ))
        ) : (
          <Card className="px-4 py-5">
            <p className="text-sm font-semibold text-ink">No matches in this filter</p>
            <p className="mt-2 text-sm leading-6 text-muted">Try widening the filters or log a fresh result to start your match history.</p>
          </Card>
        )}
      </div>

      <button
        className="fixed bottom-28 right-[max(1rem,calc(50%-180px))] z-30 inline-flex h-14 w-14 items-center justify-center rounded-full bg-cta text-white shadow-glow"
        onClick={onLogMatch}
        type="button"
      >
        <Plus className="h-5 w-5" />
      </button>
    </div>
  );
};
