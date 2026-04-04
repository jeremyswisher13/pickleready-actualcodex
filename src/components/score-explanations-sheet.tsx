"use client";

import { ChevronRight, X } from "lucide-react";

import type { ChangeExplanation } from "@shared/domain/types";

import { Card } from "@/components/ui";
import { formatSignedNumber } from "@/lib/utils";

export const ScoreExplanationsSheet = ({
  open,
  title,
  score,
  subtitle,
  explanations,
  onClose
}: {
  open: boolean;
  title: string;
  score: string;
  subtitle: string;
  explanations: ChangeExplanation[];
  onClose: () => void;
}) => {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/40 p-3 backdrop-blur-sm">
      <Card className="w-full max-w-[390px] overflow-hidden rounded-[32px]">
        <div className="flex items-center justify-between border-b border-blue-50 px-5 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-500">Why it changed</p>
            <h3 className="text-lg font-semibold text-ink">{title}</h3>
          </div>
          <button className="rounded-full bg-blue-50 p-2 text-blue-700" onClick={onClose} type="button">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 pb-6 pt-5">
          <div className="rounded-[24px] bg-gradient-to-br from-cyan-50 via-blue-50 to-violet-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-500">Current score</p>
            <p className="mt-2 text-4xl font-bold tracking-[-0.05em] text-ink">{score}</p>
            <p className="mt-2 text-sm leading-6 text-muted">{subtitle}</p>
          </div>

          <div className="space-y-3">
            {explanations.length > 0 ? (
              explanations.map((explanation) => (
                <div key={`${explanation.factor}-${explanation.description}`} className="rounded-[24px] border border-blue-100 bg-white px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold capitalize text-ink">{explanation.factor}</p>
                      <p className="mt-2 text-sm leading-6 text-muted">{explanation.description}</p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${explanation.impact >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}
                    >
                      {formatSignedNumber(explanation.impact)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[24px] border border-blue-100 bg-white px-4 py-4">
                <p className="text-sm leading-6 text-muted">No major score drivers yet. As soon as more data comes in, this sheet will show the biggest movers.</p>
              </div>
            )}
          </div>

          <div className="rounded-[24px] bg-blue-50/70 p-4 text-sm leading-6 text-ink">
            <span className="inline-flex items-center gap-2 font-semibold text-blue-700">
              Deterministic logic
              <ChevronRight className="h-4 w-4" />
            </span>
            <p className="mt-2 text-muted">
              These explanations come from the same pure scoring functions used by the app, so they stay consistent across the dashboard, match log, and backend.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};
