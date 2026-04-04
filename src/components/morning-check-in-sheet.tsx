"use client";

import { useEffect, useState } from "react";
import { Coffee, MoonStar, SmilePlus, X } from "lucide-react";

import { estimateManualPhysicalReadiness } from "@shared/domain/readiness";
import type { DailyCheckIn } from "@shared/domain/types";
import { localDateKey } from "@shared/domain/utils";

import { Card } from "@/components/ui";
import { cn } from "@/lib/utils";

const scaleLabels = {
  sleepQuality: ["Rough", "Light", "Okay", "Good", "Great"],
  energy: ["Flat", "Low", "Okay", "Good", "Sharp"],
  soreness: ["Fresh", "Loose", "Normal", "Heavy", "Beat up"],
  stress: ["Calm", "Light", "Normal", "Busy", "Maxed"],
  mentalSharpness: ["Foggy", "Slow", "Normal", "Locked in", "Elite"]
} as const;

const painOptions = ["Shoulder", "Elbow", "Back", "Knee", "Hip", "Foot"];

const scaleRow = (
  label: string,
  value: number,
  labels: readonly string[],
  onChange: (nextValue: number) => void
) => (
  <div className="space-y-3">
    <div className="flex items-center justify-between">
      <p className="text-sm font-semibold text-ink">{label}</p>
      <p className="text-sm text-muted">{labels[value - 1]}</p>
    </div>
    <div className="grid grid-cols-5 gap-2">
      {labels.map((_, index) => {
        const optionValue = index + 1;
        const active = optionValue === value;

        return (
          <button
            key={`${label}-${optionValue}`}
            className={cn(
              "rounded-2xl px-0 py-3 text-sm font-semibold transition",
              active ? "bg-cta text-white shadow-glow" : "border border-blue-100 bg-blue-50/50 text-ink"
            )}
            onClick={() => onChange(optionValue)}
            type="button"
          >
            {optionValue}
          </button>
        );
      })}
    </div>
  </div>
);

export const MorningCheckInSheet = ({
  open,
  initialCheckIn,
  onClose,
  onSave
}: {
  open: boolean;
  initialCheckIn: DailyCheckIn | null;
  onClose: () => void;
  onSave: (checkIn: DailyCheckIn) => Promise<boolean | void> | boolean | void;
}) => {
  const [sleepHours, setSleepHours] = useState("7.5");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sleepQuality, setSleepQuality] = useState(3);
  const [energy, setEnergy] = useState(3);
  const [soreness, setSoreness] = useState(3);
  const [stress, setStress] = useState(3);
  const [mentalSharpness, setMentalSharpness] = useState(3);
  const [illness, setIllness] = useState(false);
  const [alcohol, setAlcohol] = useState(false);
  const [travel, setTravel] = useState(false);
  const [painAreas, setPainAreas] = useState<string[]>([]);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    setSleepHours(initialCheckIn?.sleepHours.toString() ?? "7.5");
    setSleepQuality(initialCheckIn?.sleepQuality ?? 3);
    setEnergy(initialCheckIn?.energy ?? 3);
    setSoreness(initialCheckIn?.soreness ?? 3);
    setStress(initialCheckIn?.stress ?? 3);
    setMentalSharpness(initialCheckIn?.mentalSharpness ?? 3);
    setIllness(initialCheckIn?.illness ?? false);
    setAlcohol(initialCheckIn?.alcohol ?? false);
    setTravel(initialCheckIn?.travel ?? false);
    setPainAreas(initialCheckIn?.painAreas ?? []);
    setNote(initialCheckIn?.note ?? "");
    setFormError(null);
    setSaving(false);
  }, [initialCheckIn, open]);

  if (!open) {
    return null;
  }

  const todayKey = localDateKey();
  const preview = estimateManualPhysicalReadiness({
    dateString: todayKey,
    submittedAt: new Date().toISOString(),
    source: "manual",
    sleepHours: Number(sleepHours) || 0,
    sleepQuality,
    energy,
    soreness,
    stress,
    mentalSharpness,
    illness,
    alcohol,
    travel,
    painAreas,
    note,
    physicalEstimate: 65,
    confidence: "medium"
  });
  const handleSave = async () => {
    const parsedSleepHours = Number(sleepHours);

    if (!Number.isFinite(parsedSleepHours) || parsedSleepHours <= 0 || parsedSleepHours > 16) {
      setFormError("Enter a realistic sleep total between 0.5 and 16 hours.");
      return;
    }

    setFormError(null);
    setSaving(true);
    const saved = await onSave({
      dateString: todayKey,
      submittedAt: new Date().toISOString(),
      source: "manual",
      sleepHours: parsedSleepHours,
      sleepQuality,
      energy,
      soreness,
      stress,
      mentalSharpness,
      illness,
      alcohol,
      travel,
      painAreas,
      note: note.trim(),
      physicalEstimate: preview,
      confidence: "medium"
    });

    setSaving(false);

    if (saved !== false) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/40 p-3 backdrop-blur-sm">
      <Card className="flex max-h-[94vh] w-full max-w-[390px] flex-col overflow-hidden rounded-[32px]">
        <div className="flex shrink-0 items-center justify-between border-b border-blue-50 px-5 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-500">Morning Check-In</p>
            <h3 className="text-lg font-semibold text-ink">Manual readiness for device-free players</h3>
          </div>
          <button className="rounded-full bg-blue-50 p-2 text-blue-700" onClick={onClose} type="button">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 space-y-5 overflow-y-auto px-5 pb-6 pt-5">
          <div className="rounded-[24px] bg-gradient-to-r from-cyan-50 via-blue-50 to-violet-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-500">Preview</p>
                <p className="mt-2 text-4xl font-bold tracking-[-0.05em] text-ink">{preview}</p>
              </div>
              <div className="rounded-[20px] bg-white/80 px-3 py-2 text-right">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Confidence</p>
                <p className="mt-1 text-sm font-semibold text-blue-700">Medium</p>
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted">This won’t replace wearable data perfectly, but it gives the app a real fatigue signal instead of a flat fallback score.</p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <MoonStar className="h-4 w-4 text-blue-600" />
              Sleep hours
            </div>
            <input
              className="w-full rounded-2xl border border-blue-100 bg-blue-50/40 px-4 py-3 text-sm text-ink outline-none ring-blue-300 transition focus:ring-2"
              inputMode="decimal"
              onChange={(event) => setSleepHours(event.target.value)}
              placeholder="7.5"
              value={sleepHours}
            />
          </div>

          {scaleRow("Sleep quality", sleepQuality, scaleLabels.sleepQuality, setSleepQuality)}
          {scaleRow("Energy", energy, scaleLabels.energy, setEnergy)}
          {scaleRow("Soreness", soreness, scaleLabels.soreness, setSoreness)}
          {scaleRow("Stress", stress, scaleLabels.stress, setStress)}
          {scaleRow("Mental sharpness", mentalSharpness, scaleLabels.mentalSharpness, setMentalSharpness)}

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <SmilePlus className="h-4 w-4 text-blue-600" />
              Flags
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Illness", value: illness, setter: setIllness },
                { label: "Alcohol", value: alcohol, setter: setAlcohol },
                { label: "Travel", value: travel, setter: setTravel }
              ].map((flag) => (
                <button
                  key={flag.label}
                  className={cn(
                    "rounded-2xl px-3 py-3 text-sm font-semibold transition",
                    flag.value ? "bg-rose-500 text-white" : "border border-blue-100 bg-blue-50/50 text-ink"
                  )}
                  onClick={() => flag.setter(!flag.value)}
                  type="button"
                >
                  {flag.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Coffee className="h-4 w-4 text-blue-600" />
              Pain or injury area
            </div>
            <div className="flex flex-wrap gap-2">
              {painOptions.map((option) => {
                const active = painAreas.includes(option);

                return (
                  <button
                    key={option}
                    className={cn(
                      "rounded-full px-3 py-2 text-sm font-semibold transition",
                      active ? "bg-amber-500 text-white" : "border border-blue-100 bg-blue-50/50 text-ink"
                    )}
                    onClick={() =>
                      setPainAreas((current) =>
                        current.includes(option) ? current.filter((item) => item !== option) : [...current, option]
                      )
                    }
                    type="button"
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-semibold text-ink">Optional note</label>
            <textarea
              className="min-h-24 w-full rounded-2xl border border-blue-100 bg-blue-50/40 px-4 py-3 text-sm text-ink outline-none ring-blue-300 transition focus:ring-2"
              onChange={(event) => setNote(event.target.value)}
              placeholder="Anything unusual this morning? Tight hamstring, slept hot, mentally sharp, etc."
              value={note}
            />
          </div>

          <button
            className={cn(
              "w-full rounded-[22px] bg-cta px-4 py-4 text-sm font-semibold text-white shadow-glow",
              saving && "opacity-70"
            )}
            disabled={saving}
            onClick={() => void handleSave()}
            type="button"
          >
            {saving ? "Saving..." : "Save Morning Check-In"}
          </button>
          {formError ? <p className="text-sm leading-6 text-rose-600">{formError}</p> : null}
        </div>
      </Card>
    </div>
  );
};
