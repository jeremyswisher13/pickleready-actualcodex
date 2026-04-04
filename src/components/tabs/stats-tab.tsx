"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import type { MatchRecord, RatingEntry, ReadinessScore } from "@shared/domain/types";
import { average } from "@shared/domain/utils";
import { averageMatchMargin } from "@shared/domain/rec-score";

import { Card, SectionTitle, SegmentedControl } from "@/components/ui";
import { formatShortDate } from "@/lib/utils";

type RangeFilter = "30" | "90" | "all";

const inRange = (isoString: string, range: RangeFilter) => {
  if (range === "all") {
    return true;
  }

  const windowDays = range === "30" ? 30 : 90;
  const diff = Date.now() - new Date(isoString).getTime();
  return diff / 86_400_000 <= windowDays;
};

export const StatsTab = ({
  readinessHistory,
  ratingHistory,
  matches
}: {
  readinessHistory: ReadinessScore[];
  ratingHistory: RatingEntry[];
  matches: MatchRecord[];
}) => {
  const [range, setRange] = useState<RangeFilter>("30");
  const readinessTitle = range === "30" ? "30-day readiness arc" : range === "90" ? "90-day readiness arc" : "All-time readiness arc";

  const filteredReadiness = useMemo(
    () => readinessHistory.filter((entry) => inRange(entry.calculatedAt, range)),
    [range, readinessHistory]
  );
  const filteredRatings = useMemo(
    () => ratingHistory.filter((entry) => inRange(entry.updatedAt, range)),
    [range, ratingHistory]
  );
  const filteredMatches = useMemo(
    () => matches.filter((match) => inRange(match.date, range)),
    [matches, range]
  );
  const hasWhoopTrend = filteredReadiness.some((entry) => typeof entry.whoopData.recoveryScore === "number");
  const ratingDomain = useMemo<[number, number]>(() => {
    const values = filteredRatings.flatMap((entry) =>
      [entry.duprDoubles ?? entry.duprSingles, entry.recScore].filter((value): value is number => typeof value === "number")
    );

    if (values.length === 0) {
      return [3.2, 5];
    }

    const min = Math.max(2, Math.floor((Math.min(...values) - 0.15) * 10) / 10);
    const max = Math.min(8, Math.ceil((Math.max(...values) + 0.15) * 10) / 10);
    return min === max ? [Math.max(2, min - 0.2), Math.min(8, max + 0.2)] : [min, max];
  }, [filteredRatings]);

  const winCount = filteredMatches.filter((match) => match.result === "win").length;
  const lossCount = filteredMatches.filter((match) => match.result === "loss").length;
  const avgMargin = average(filteredMatches.map((match) => averageMatchMargin(match.games)));

  const currentWinStreak = filteredMatches.reduce((count, match) => {
    if (count === -1) {
      return match.result === "win" ? 1 : -2;
    }

    if (count >= 0 && match.result === "win") {
      return count + 1;
    }

    return -2;
  }, -1);

  let longestStreak = 0;
  let runningStreak = 0;
  [...filteredMatches].reverse().forEach((match) => {
    if (match.result === "win") {
      runningStreak += 1;
      longestStreak = Math.max(longestStreak, runningStreak);
    } else {
      runningStreak = 0;
    }
  });

  if (filteredMatches.length === 0) {
    return (
      <div className="space-y-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-500">Trends</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink">Track how readiness and rating move together.</h2>
        </div>

        <Card className="px-5 py-6">
          <p className="text-lg font-semibold text-ink">No stats yet</p>
          <p className="mt-3 text-sm leading-7 text-muted">
            Log a few matches and let the readiness score run for a couple of days. Once there is enough signal, this tab becomes your trendline view.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-500">Trends</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink">Track how readiness and rating move together.</h2>
        </div>
        <SegmentedControl
          options={[
            { label: "30d", value: "30" },
            { label: "90d", value: "90" },
            { label: "All", value: "all" }
          ]}
          value={range}
          onChange={setRange}
        />
      </div>

      <Card className="px-4 py-5">
        <SectionTitle eyebrow="Readiness" title={readinessTitle} />
        <div className="mt-4 h-56">
          <ResponsiveContainer>
            <AreaChart data={filteredReadiness.map((entry) => ({ date: formatShortDate(entry.calculatedAt), score: entry.overall }))}>
              <defs>
                <linearGradient id="readinessFill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#2563EB" stopOpacity={0.38} />
                  <stop offset="100%" stopColor="#2563EB" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#E5EEFF" vertical={false} />
              <XAxis axisLine={false} dataKey="date" tickLine={false} tick={{ fill: "#7D8AA8", fontSize: 11 }} />
              <YAxis axisLine={false} domain={[35, 100]} tickLine={false} tick={{ fill: "#7D8AA8", fontSize: 11 }} />
              <Tooltip />
              <Area dataKey="score" fill="url(#readinessFill)" stroke="#2563EB" strokeWidth={3} type="monotone" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="px-4 py-5">
        <SectionTitle eyebrow="Ratings" title="DUPR vs Rec score" />
        <div className="mt-4 h-56">
          <ResponsiveContainer>
            <LineChart
              data={filteredRatings.map((entry) => ({
                date: formatShortDate(entry.updatedAt),
                dupr: entry.duprDoubles ?? entry.duprSingles,
                rec: entry.recScore
              }))}
            >
              <CartesianGrid stroke="#E5EEFF" vertical={false} />
              <XAxis axisLine={false} dataKey="date" tickLine={false} tick={{ fill: "#7D8AA8", fontSize: 11 }} />
              <YAxis axisLine={false} domain={ratingDomain} tickLine={false} tick={{ fill: "#7D8AA8", fontSize: 11 }} />
              <Tooltip />
              <Line dataKey="dupr" dot={false} stroke="#6D8FF8" strokeWidth={2.5} type="monotone" />
              <Line dataKey="rec" dot={false} stroke="#2563EB" strokeWidth={3} type="monotone" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="px-4 py-5">
        <SectionTitle eyebrow="Result mix" title="Wins and losses" />
        <div className="mt-4 h-48">
          <ResponsiveContainer>
            <BarChart data={[{ label: "Wins", value: winCount }, { label: "Losses", value: lossCount }]}>
              <CartesianGrid stroke="#E5EEFF" vertical={false} />
              <XAxis axisLine={false} dataKey="label" tickLine={false} tick={{ fill: "#7D8AA8", fontSize: 11 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: "#7D8AA8", fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#2563EB" radius={[12, 12, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="px-4 py-5">
        <SectionTitle eyebrow="Physical" title={hasWhoopTrend ? "Whoop recovery trend" : "Physical readiness trend"} />
        <div className="mt-4 h-48">
          <ResponsiveContainer>
            <LineChart
              data={filteredReadiness.map((entry) => ({
                date: formatShortDate(entry.calculatedAt),
                recovery: hasWhoopTrend ? (entry.whoopData.recoveryScore ?? null) : entry.physical
              }))}
            >
              <CartesianGrid stroke="#E5EEFF" vertical={false} />
              <XAxis axisLine={false} dataKey="date" tickLine={false} tick={{ fill: "#7D8AA8", fontSize: 11 }} />
              <YAxis axisLine={false} domain={[20, 100]} tickLine={false} tick={{ fill: "#7D8AA8", fontSize: 11 }} />
              <Tooltip />
              <Line dataKey="recovery" dot={false} stroke="#22D3EE" strokeWidth={3} type="monotone" />
            </LineChart>
          </ResponsiveContainer>
        </div>
        {!hasWhoopTrend ? (
          <p className="mt-3 text-sm leading-6 text-muted">
            Showing your physical sub-score from Morning Check-In or fallback mode until wearable recovery data is connected.
          </p>
        ) : null}
      </Card>

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Total matches", value: filteredMatches.length.toString() },
          { label: "Avg margin", value: avgMargin.toFixed(1) },
          { label: "Current streak", value: Math.max(currentWinStreak, 0).toString() },
          { label: "Longest streak", value: longestStreak.toString() }
        ].map((item) => (
          <Card key={item.label} className="px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">{item.label}</p>
            <p className="mt-2 text-3xl font-bold tracking-[-0.05em] text-ink">{item.value}</p>
          </Card>
        ))}
      </div>
    </div>
  );
};
