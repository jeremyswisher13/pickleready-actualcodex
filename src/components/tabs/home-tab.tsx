"use client";

import { ArrowUpRight, HeartPulse, Info, Plus, Share2, Trophy, Waves } from "lucide-react";

import type { MatchupDiagnosis } from "@shared/domain/matchup-diagnosis";
import type { DailyCheckIn, DuprSnapshot, MatchRecord, RatingEntry, ReadinessScore } from "@shared/domain/types";
import { localDateKey } from "@shared/domain/utils";

import { ScoreRing } from "@/components/score-ring";
import { Card, SectionTitle, TrendBadge } from "@/components/ui";
import {
  formatShortDate,
  formatSignedNumber,
  getMatchOpponentLabel,
  getOpponentAverageRating
} from "@/lib/utils";

export const HomeTab = ({
  readiness,
  ratingHistory,
  dupr,
  recScore,
  recentMatches,
  diagnosis,
  syncing,
  currentCheckIn,
  onOpenReadinessDetails,
  onOpenRecDetails,
  onOpenCheckIn,
  onShare,
  onOpenMatch,
  onLogMatch
}: {
  readiness: ReadinessScore | null;
  ratingHistory: RatingEntry[];
  dupr: DuprSnapshot | undefined;
  recScore: number;
  recentMatches: MatchRecord[];
  diagnosis: MatchupDiagnosis;
  syncing: boolean;
  currentCheckIn: DailyCheckIn | null;
  onOpenReadinessDetails: () => void;
  onOpenRecDetails: () => void;
  onOpenCheckIn: () => void;
  onShare: () => void;
  onOpenMatch: (match: MatchRecord) => void;
  onLogMatch: () => void;
}) => {
  if (!readiness) {
    return null;
  }

  const previousRec = ratingHistory.at(-2)?.recScore ?? recScore;
  const recDelta = recScore - previousRec;
  const recExplanation = ratingHistory.at(-1)?.recScoreChangeExplanations ?? [];
  const isToday = readiness.dateString === localDateKey();
  const isStale = !isToday && Date.now() - new Date(readiness.calculatedAt).getTime() > 18 * 60 * 60 * 1000;
  const confidenceTone =
    readiness.confidence === "high"
      ? "bg-emerald-50 text-emerald-700"
      : readiness.confidence === "medium"
        ? "bg-amber-50 text-amber-700"
        : "bg-slate-100 text-slate-700";

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden rounded-[34px] bg-gradient-to-br from-white via-white to-blue-50 px-5 py-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-500">Daily readiness</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink">Was it fatigue or the matchup?</h1>
            <p className="mt-2 max-w-[18rem] text-sm leading-6 text-muted">
              Your readiness says today feels like a {readiness.label.toLowerCase()} kind of session.
            </p>
            <span className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${confidenceTone}`}>
              {readiness.confidence === "high" ? "High confidence" : readiness.confidence === "medium" ? "Medium confidence" : "Low confidence"} • {readiness.physicalSource === "whoop" ? "Whoop-driven" : readiness.physicalSource === "checkin" ? "Morning Check-In" : "Fallback"}
            </span>
          </div>
          <div className="rounded-[24px] bg-blue-50 px-3 py-2 text-right">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-500">Drivers</p>
            <p className="mt-1 text-sm font-semibold text-ink">{readiness.changeExplanations[0]?.description ?? "No major swings yet."}</p>
          </div>
        </div>

        <div className="mt-6">
          <ScoreRing label={readiness.label} score={readiness.overall} />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            className="inline-flex items-center justify-center gap-2 rounded-[22px] border border-blue-100 bg-white px-4 py-3 text-sm font-semibold text-ink"
            onClick={onOpenReadinessDetails}
            type="button"
          >
            <Info className="h-4 w-4" />
            Why it changed
          </button>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-[22px] border border-blue-100 bg-white px-4 py-3 text-sm font-semibold text-ink"
            onClick={onShare}
            type="button"
          >
            <Share2 className="h-4 w-4" />
            Share today
          </button>
        </div>

        {isStale || syncing ? (
          <div className="mt-4 rounded-[22px] bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {syncing ? "Syncing your latest scores and match context..." : "This score may be a little stale. Open the app again after your next session for a fresher read."}
          </div>
        ) : null}
      </Card>

      {readiness.physicalSource !== "whoop" ? (
        <Card className="px-5 py-5">
          <SectionTitle
            eyebrow="Device-free mode"
            title={currentCheckIn ? "Morning Check-In saved" : "Complete your Morning Check-In"}
            action={
              <button className="text-sm font-semibold text-blue-600" onClick={onOpenCheckIn} type="button">
                {currentCheckIn ? "Edit" : "Start"}
              </button>
            }
          />
          <div className="mt-4 rounded-[24px] bg-blue-50/50 p-4">
            {currentCheckIn ? (
              <>
                <p className="text-sm leading-6 text-ink">
                  Logged {currentCheckIn.sleepHours.toFixed(1)} hours of sleep, energy {currentCheckIn.energy}/5, soreness {currentCheckIn.soreness}/5, stress {currentCheckIn.stress}/5.
                </p>
                {currentCheckIn.note ? <p className="mt-3 text-sm leading-6 text-muted">{currentCheckIn.note}</p> : null}
              </>
            ) : (
              <p className="text-sm leading-6 text-muted">
                No Whoop? No problem. Use the structured Morning Check-In to give PickleReady a real fatigue signal instead of the default 65-point physical fallback.
              </p>
            )}
          </div>
        </Card>
      ) : null}

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Physical", value: readiness.physical, icon: HeartPulse, tint: "from-cyan-100 to-blue-100" },
          { label: "Skill", value: readiness.performance, icon: Trophy, tint: "from-blue-100 to-violet-100" },
          { label: "Activity", value: readiness.activity, icon: Waves, tint: "from-sky-100 to-cyan-100" }
        ].map((item) => {
          const Icon = item.icon;

          return (
            <Card key={item.label} className="px-3 py-4">
              <div className={`inline-flex rounded-2xl bg-gradient-to-br ${item.tint} p-2 text-blue-700`}>
                <Icon className="h-4 w-4" />
              </div>
              <p className="mt-4 text-2xl font-bold tracking-[-0.05em] text-ink">{item.value}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted">{item.label}</p>
              <div className="mt-3 h-2 rounded-full bg-blue-50">
                <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500" style={{ width: `${item.value}%` }} />
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="px-5 py-5">
        <SectionTitle eyebrow="Today's read" title={diagnosis.headline} />
        <div className="mt-4 rounded-[24px] bg-gradient-to-br from-cyan-50 via-blue-50 to-violet-50 p-4">
          <p className="text-sm leading-7 text-ink">{diagnosis.summary}</p>
          <div className="mt-4 space-y-2">
            {diagnosis.supportingPoints.map((point) => (
              <p key={point} className="text-sm leading-6 text-muted">
                {point}
              </p>
            ))}
          </div>
        </div>
      </Card>

      <Card className="px-5 py-5">
        <SectionTitle
          eyebrow="Ratings"
          title="DUPR vs Rec score"
          action={
            <button className="text-sm font-semibold text-blue-600" onClick={onOpenRecDetails} type="button">
              Explain
            </button>
          }
        />
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-[24px] bg-blue-50/70 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-500">DUPR</p>
            <p className="mt-2 text-3xl font-bold tracking-[-0.05em] text-ink">{(dupr?.doublesRating ?? dupr?.singlesRating ?? 3.5).toFixed(2)}</p>
            <p className="mt-2 text-sm text-muted">Linked from your profile baseline.</p>
          </div>
          <div className="rounded-[24px] bg-gradient-to-br from-cyan-50 via-blue-50 to-violet-50 px-4 py-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-500">Rec score</p>
              <TrendBadge label={formatSignedNumber(recDelta)} positive={recDelta >= 0} />
            </div>
            <p className="mt-2 text-3xl font-bold tracking-[-0.05em] text-ink">{recScore.toFixed(2)}</p>
            <p className="mt-2 text-sm text-muted">Internal ladder score shaped by matchup quality and margin.</p>
          </div>
        </div>
        {recExplanation[0] ? <p className="mt-4 text-sm leading-6 text-muted">{recExplanation[0].description}</p> : null}
      </Card>

      <Card className="px-5 py-5">
        <SectionTitle
          eyebrow="Recent form"
          title="Latest matches"
          action={
            <button className="text-sm font-semibold text-blue-600" onClick={onLogMatch} type="button">
              Log one
            </button>
          }
        />
        <div className="mt-4 space-y-3">
          {recentMatches.length > 0 ? (
            recentMatches.map((match) => (
              <button
                key={match.id}
                className="flex w-full items-center justify-between rounded-[24px] border border-blue-100 bg-blue-50/40 px-4 py-4 text-left"
                onClick={() => onOpenMatch(match)}
                type="button"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-ink">{getMatchOpponentLabel(match)}</p>
                    {getOpponentAverageRating(match) ? (
                      <span className="text-xs font-medium text-muted">{getOpponentAverageRating(match)?.toFixed(2)}</span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-muted">{match.games.map((game) => `${game.myScore}-${game.opponentScore}`).join(", ")}</p>
                </div>
                <div className="text-right">
                  <TrendBadge label={match.result.toUpperCase()} positive={match.result === "win"} />
                  <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                    {formatShortDate(match.date)}
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </p>
                </div>
              </button>
            ))
          ) : (
            <div className="rounded-[24px] border border-dashed border-blue-200 bg-blue-50/40 px-4 py-5">
              <p className="text-sm font-semibold text-ink">No matches logged yet</p>
              <p className="mt-2 text-sm leading-6 text-muted">Your matchup view gets sharper after the first few sessions. Start by logging your latest result.</p>
            </div>
          )}
        </div>
      </Card>

      <button
        className="inline-flex w-full items-center justify-center gap-2 rounded-[26px] bg-cta px-4 py-4 text-sm font-semibold text-white shadow-glow"
        onClick={onLogMatch}
        type="button"
      >
        <Plus className="h-4 w-4" />
        Log a match
      </button>
    </div>
  );
};
