"use client";

import { scoreToGradient } from "@/lib/utils";

export const ScoreRing = ({
  score,
  label
}: {
  score: number;
  label: string;
}) => {
  const progress = Math.max(8, Math.min(score, 100));
  const gradient = scoreToGradient(score);

  return (
    <div className="relative mx-auto flex aspect-square w-full max-w-[248px] items-center justify-center">
      <div className={`absolute inset-0 rounded-full bg-gradient-to-br ${gradient} opacity-20 blur-2xl`} />
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(from 180deg, rgba(34,211,238,0.98) 0deg, rgba(37,99,235,0.98) ${progress * 2.2}deg, rgba(124,58,237,0.98) ${progress * 3.6}deg, rgba(255,255,255,0.28) ${progress * 3.6}deg 360deg)`
        }}
      />
      <div className="absolute inset-[12px] rounded-full bg-white/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]" />
      <div className="relative z-10 flex flex-col items-center text-center">
        <span className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-500">Today</span>
        <span className="mt-2 text-6xl font-bold tracking-[-0.06em] text-ink">{score}</span>
        <span className="mt-2 rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">{label}</span>
      </div>
    </div>
  );
};
