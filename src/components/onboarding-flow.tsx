"use client";

import { useEffect, useState } from "react";
import { ArrowRight, ShieldCheck, Watch, Zap } from "lucide-react";

import { Card, SegmentedControl } from "@/components/ui";

const tutorialCards = [
  {
    icon: Watch,
    title: "Readiness is the whole story",
    body: "PickleReady blends Whoop recovery, rhythm, and recent results into one daily answer before you step on court."
  },
  {
    icon: Zap,
    title: "Rec score moves like a ladder",
    body: "Every logged match runs through the Elo-style engine, with matchup strength, margins, and verification all changing the size of the move."
  },
  {
    icon: ShieldCheck,
    title: "Bad days get context",
    body: "The app compares readiness, opponent level, and head-to-head history so you can tell fatigue apart from a difficult matchup."
  }
];

export const OnboardingFlow = ({
  open,
  initialName,
  initialEmail,
  initialDuprId,
  initialDuprRating,
  initialWhoopConnected,
  whoopConnectionAvailable,
  onClose,
  onComplete
}: {
  open: boolean;
  initialName: string;
  initialEmail: string;
  initialDuprId: string;
  initialDuprRating?: number;
  initialWhoopConnected: boolean;
  whoopConnectionAvailable: boolean;
  onClose: () => void;
  onComplete: (payload: {
    displayName: string;
    email: string;
    duprId: string;
    whoopConnected: boolean;
    manualDuprRating?: number | null;
  }) => Promise<boolean | void> | boolean | void;
}) => {
  const [step, setStep] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [duprId, setDuprId] = useState(initialDuprId);
  const [manualDuprRating, setManualDuprRating] = useState(initialDuprRating?.toString() ?? "");
  const [whoopConnected, setWhoopConnected] = useState(initialWhoopConnected);

  useEffect(() => {
    if (!open) {
      return;
    }

    setStep(0);
    setDisplayName(initialName);
    setEmail(initialEmail);
    setDuprId(initialDuprId);
    setManualDuprRating(initialDuprRating?.toString() ?? "");
    setWhoopConnected(initialWhoopConnected);
    setFormError(null);
    setSaving(false);
  }, [initialDuprId, initialDuprRating, initialEmail, initialName, initialWhoopConnected, open]);

  if (!open) {
    return null;
  }

  const isLastStep = step === 3;
  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const goNext = async () => {
    if (step === 0) {
      if (displayName.trim().length < 2) {
        setFormError("Add the name you want to use in the app.");
        return;
      }

      if (!emailLooksValid) {
        setFormError("Enter a valid email address for your account.");
        return;
      }
    }

    if (step === 1 && manualDuprRating.trim().length > 0) {
      const parsedRating = Number(manualDuprRating);

      if (!Number.isFinite(parsedRating) || parsedRating < 2 || parsedRating > 8) {
        setFormError("Use a DUPR-style rating between 2.00 and 8.00, or leave it blank.");
        return;
      }
    }

    if (isLastStep) {
      setSaving(true);
      const completed = await onComplete({
        displayName: displayName.trim(),
        email: email.trim(),
        duprId: duprId.trim(),
        whoopConnected,
        manualDuprRating: manualDuprRating.trim() ? Number(manualDuprRating) : null
      });
      setSaving(false);

      if (completed !== false) {
        onClose();
      }
      return;
    }

    setFormError(null);
    setStep((current) => current + 1);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <Card className="flex max-h-[92vh] w-full max-w-[390px] flex-col overflow-hidden rounded-[32px]">
        <div className="bg-gradient-to-br from-cyan-400 via-blue-500 to-violet-500 px-5 py-5 text-white">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/80">Welcome to PickleReady</p>
          <h3 className="mt-2 text-2xl font-bold tracking-tight">Build your baseline before the first tap.</h3>
          <p className="mt-2 text-sm text-white/80">Four quick steps and you will land on the dashboard with a real baseline, matchup context, and a clean daily routine.</p>
        </div>

        <div className="min-h-0 space-y-5 overflow-y-auto px-5 py-5">
          <div className="flex gap-2">
            {[0, 1, 2, 3].map((index) => (
              <div
                key={index}
                className={`h-1.5 flex-1 rounded-full ${index <= step ? "bg-blue-600" : "bg-blue-100"}`}
              />
            ))}
          </div>

          {step === 0 ? (
            <div className="space-y-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-500">Step 1</p>
                <h4 className="mt-1 text-xl font-semibold text-ink">Create account</h4>
                <p className="mt-2 text-sm leading-6 text-muted">
                  Start with the profile details you want on your dashboard and we will use them as your baseline identity in the app.
                </p>
              </div>
              <input
                className="w-full rounded-2xl border border-blue-100 bg-blue-50/40 px-4 py-3 text-sm text-ink outline-none ring-blue-300 transition focus:ring-2"
                onChange={(event) => {
                  setDisplayName(event.target.value);
                  setFormError(null);
                }}
                placeholder="Display name"
                value={displayName}
              />
              <input
                className="w-full rounded-2xl border border-blue-100 bg-blue-50/40 px-4 py-3 text-sm text-ink outline-none ring-blue-300 transition focus:ring-2"
                onChange={(event) => {
                  setEmail(event.target.value);
                  setFormError(null);
                }}
                placeholder="Email"
                type="email"
                value={email}
              />
              <div className="rounded-[24px] bg-blue-50/70 p-4 text-sm leading-6 text-muted">
                This is the name and email the app will use across your dashboard, match history, and shared profile surfaces.
              </div>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-500">Step 2</p>
                <h4 className="mt-1 text-xl font-semibold text-ink">Connect DUPR</h4>
                <p className="mt-2 text-sm leading-6 text-muted">
                  Add your DUPR ID now so PickleReady has a strong skill baseline, even if you refine the connection later.
                </p>
              </div>
              <input
                className="w-full rounded-2xl border border-blue-100 bg-blue-50/40 px-4 py-3 text-sm text-ink outline-none ring-blue-300 transition focus:ring-2"
                onChange={(event) => {
                  setDuprId(event.target.value);
                  setFormError(null);
                }}
                placeholder="DUPR ID"
                value={duprId}
              />
              <input
                className="w-full rounded-2xl border border-blue-100 bg-blue-50/40 px-4 py-3 text-sm text-ink outline-none ring-blue-300 transition focus:ring-2"
                inputMode="decimal"
                onChange={(event) => {
                  setManualDuprRating(event.target.value);
                  setFormError(null);
                }}
                placeholder="Optional current DUPR rating"
                value={manualDuprRating}
              />
              <div className="rounded-[24px] bg-blue-50/70 p-4 text-sm leading-6 text-muted">
                If you do not know your live DUPR pull yet, use an approximate current rating so your rec score starts from something realistic.
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-500">Step 3</p>
                <h4 className="mt-1 text-xl font-semibold text-ink">
                  {whoopConnectionAvailable ? "Connect Whoop" : "Choose your readiness mode"}
                </h4>
                <p className="mt-2 text-sm leading-6 text-muted">
                  {whoopConnectionAvailable
                    ? "Wearable recovery is powerful, but you can still get a meaningful daily fatigue signal from the Morning Check-In if you skip it. You can also connect Whoop later from Settings."
                    : "Morning Check-In works today as the recommended no-device path. You can still build a strong readiness habit without a wearable."}
                </p>
              </div>
              {whoopConnectionAvailable ? (
                <SegmentedControl
                  options={[
                    { label: "Connect Whoop", value: "yes" },
                    { label: "Skip for now", value: "no" }
                  ]}
                  value={whoopConnected ? "yes" : "no"}
                  onChange={(value) => setWhoopConnected(value === "yes")}
                />
              ) : null}
              <div className="rounded-[24px] bg-gradient-to-r from-cyan-50 via-blue-50 to-violet-50 p-4 text-sm leading-6 text-ink">
                No Whoop still works: Morning Check-In gives PickleReady a real daily body signal, and the app still leans on matchup context plus rec-score movement to explain your day.
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-500">Step 4</p>
                <h4 className="mt-1 text-xl font-semibold text-ink">Know what each score means</h4>
              </div>
              {tutorialCards.map((card) => {
                const Icon = card.icon;

                return (
                  <div key={card.title} className="rounded-[24px] border border-blue-100 bg-blue-50/40 p-4">
                    <div className="flex items-center gap-3">
                      <div className="rounded-2xl bg-white p-2 text-blue-700">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h5 className="text-sm font-semibold text-ink">{card.title}</h5>
                        <p className="mt-1 text-sm leading-6 text-muted">{card.body}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          {formError ? <p className="text-sm leading-6 text-rose-600">{formError}</p> : null}

          <div className="grid grid-cols-2 gap-3">
            <button
              className="rounded-[20px] border border-blue-100 bg-white px-4 py-3 text-sm font-semibold text-ink"
              disabled={saving}
              onClick={
                step === 0
                  ? onClose
                  : () => {
                      setFormError(null);
                      setStep((current) => Math.max(0, current - 1));
                    }
              }
              type="button"
            >
              {step === 0 ? "Close" : "Back"}
            </button>
            <button
              className={`inline-flex items-center justify-center gap-2 rounded-[20px] bg-cta px-4 py-3 text-sm font-semibold text-white shadow-glow ${saving ? "opacity-70" : ""}`}
              disabled={saving}
              onClick={() => void goNext()}
              type="button"
            >
              {saving ? "Saving..." : isLastStep ? "Enter dashboard" : "Next"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
};
