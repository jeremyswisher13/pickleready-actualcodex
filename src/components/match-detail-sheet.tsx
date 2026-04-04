"use client";

import { ArrowRight, Pencil, Trash2, X } from "lucide-react";

import type { MatchRecord } from "@shared/domain/types";
import { calculateExpectedOutcome } from "@shared/domain/rec-score";

import { Card, TrendBadge } from "@/components/ui";
import {
  formatLongDate,
  formatMatchScore,
  formatSignedNumber,
  getMatchOpponentLabel,
  getOpponentAverageRating
} from "@/lib/utils";

export const MatchDetailSheet = ({
  match,
  onClose,
  onEdit,
  onDelete
}: {
  match: MatchRecord | null;
  onClose: () => void;
  onEdit: (match: MatchRecord) => void;
  onDelete: (matchId: string) => void;
}) => {
  if (!match) {
    return null;
  }

  const opponentRating = getOpponentAverageRating(match);
  const preMatchRecScore =
    typeof match.recScoreAfter === "number"
      ? match.recScoreAfter - (typeof match.recScoreDelta === "number" ? match.recScoreDelta : 0)
      : 3.5;
  const expectedOutcome = opponentRating
    ? Math.round(calculateExpectedOutcome(preMatchRecScore, opponentRating) * 100)
    : null;
  const insightText =
    match.postMatchInsight.trim().length > 0
      ? match.postMatchInsight
      : "Insight will appear after the scoring pipeline finishes syncing this match.";

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center overflow-y-auto bg-slate-950/40 p-3 backdrop-blur-sm">
      <Card className="flex max-h-[92vh] w-full max-w-[390px] flex-col overflow-hidden rounded-[32px]">
        <div className="flex shrink-0 items-center justify-between border-b border-blue-50 px-5 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-500">Match Detail</p>
            <h3 className="text-lg font-semibold text-ink">{getMatchOpponentLabel(match)}</h3>
          </div>
          <button className="rounded-full bg-blue-50 p-2 text-blue-700" onClick={onClose} type="button">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 space-y-4 overflow-y-auto overscroll-y-contain px-5 pb-6 pt-5 touch-pan-y [-webkit-overflow-scrolling:touch]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink">{formatLongDate(match.date)}</p>
              <p className="mt-1 text-sm text-muted">
                {match.matchType} • {match.category} • {match.environment}
              </p>
            </div>
            <TrendBadge label={match.result === "win" ? "Win" : "Loss"} positive={match.result === "win"} />
          </div>

          <div className="rounded-[24px] bg-blue-50/70 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-500">Scoreline</span>
              {opponentRating ? <span className="text-sm font-semibold text-ink">{opponentRating.toFixed(2)} opponent avg</span> : null}
            </div>
            <p className="mt-3 text-xl font-semibold tracking-tight text-ink">{formatMatchScore(match)}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[24px] border border-blue-100 bg-white px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Readiness</p>
              <p className="mt-2 text-3xl font-bold tracking-[-0.05em] text-ink">{match.readinessAtTime}</p>
            </div>
            <div className="rounded-[24px] border border-blue-100 bg-white px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Rec Impact</p>
              <p className="mt-2 text-3xl font-bold tracking-[-0.05em] text-ink">
                {typeof match.recScoreDelta === "number" ? formatSignedNumber(match.recScoreDelta) : "--"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[24px] border border-blue-100 bg-white px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Expected outcome</p>
              <p className="mt-2 text-3xl font-bold tracking-[-0.05em] text-ink">{expectedOutcome ?? "--"}%</p>
            </div>
            <div className="rounded-[24px] border border-blue-100 bg-white px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Format</p>
              <p className="mt-2 text-3xl font-bold tracking-[-0.05em] capitalize text-ink">{match.format}</p>
            </div>
          </div>

          <div className="rounded-[24px] bg-gradient-to-br from-cyan-50 via-blue-50 to-violet-50 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-blue-500">
              Post-match insight <ArrowRight className="h-3.5 w-3.5" />
            </div>
            <p className="mt-3 text-sm leading-6 text-ink">{insightText}</p>
          </div>

          {match.notes ? (
            <div className="rounded-[24px] border border-blue-100 bg-white px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Notes</p>
              <p className="mt-2 text-sm leading-6 text-ink">{match.notes}</p>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <button
              className="inline-flex items-center justify-center gap-2 rounded-[20px] border border-blue-100 bg-white px-4 py-3 text-sm font-semibold text-ink"
              onClick={() => onEdit(match)}
              type="button"
            >
              <Pencil className="h-4 w-4" />
              Edit
            </button>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-[20px] bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600"
              onClick={() => {
                onDelete(match.id);
                onClose();
              }}
              type="button"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
};
