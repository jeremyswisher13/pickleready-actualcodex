"use client";

import { useState } from "react";
import { ArrowRight, BarChart3, Sparkles, Trophy, Watch } from "lucide-react";
import Link from "next/link";

import { Card, SegmentedControl } from "@/components/ui";
import { cn } from "@/lib/utils";

type AuthMode = "signin" | "signup";

export const LandingPage = ({
  firebaseAvailable,
  authBusy,
  authError,
  onUseDemo,
  onGoogle,
  onEmailAuth
}: {
  firebaseAvailable: boolean;
  authBusy: boolean;
  authError: string | null;
  onUseDemo: () => void;
  onGoogle: () => void;
  onEmailAuth: (payload: { mode: AuthMode; displayName: string; email: string; password: string }) => void;
}) => {
  const [authMode, setAuthMode] = useState<AuthMode>("signup");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="min-h-screen bg-hero px-4 py-5">
      <div className="relative mx-auto max-w-[430px] space-y-5">
        <div className="absolute left-[-4rem] top-0 h-40 w-40 rounded-full bg-cyan-200/50 blur-3xl" />
        <div className="absolute right-[-2rem] top-16 h-36 w-36 rounded-full bg-violet-200/40 blur-3xl" />

        <Card className="relative overflow-hidden rounded-[34px] bg-gradient-to-br from-white via-white to-blue-50 px-5 py-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-500">PickleReady</p>
          <h1 className="mt-3 text-[2.1rem] font-bold tracking-[-0.07em] text-ink">Know whether it was fatigue, or the matchup.</h1>
          <p className="mt-3 max-w-[20rem] text-sm leading-7 text-muted">
            The premium pickleball performance app that blends Whoop readiness, DUPR context, and match logging into one daily answer.
          </p>

          <div className="mt-6 grid grid-cols-3 gap-3">
            {[
              { icon: Watch, value: "Daily", label: "Readiness" },
              { icon: Trophy, value: "Elo", label: "Rec score" },
              { icon: BarChart3, value: "H2H", label: "Matchup reads" }
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="rounded-[24px] bg-white px-3 py-4 shadow-card">
                  <div className="inline-flex rounded-2xl bg-blue-50 p-2 text-blue-700">
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className="mt-4 text-2xl font-bold tracking-[-0.05em] text-ink">{item.value}</p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted">{item.label}</p>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="relative overflow-hidden rounded-[34px] px-5 py-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-500">Try it</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-ink">Create an account or jump into demo mode.</h2>
            </div>
            <Sparkles className="h-5 w-5 text-blue-600" />
          </div>

          <div className="mt-4 space-y-4">
            <SegmentedControl
              options={[
                { label: "Create", value: "signup" },
                { label: "Sign in", value: "signin" }
              ]}
              value={authMode}
              onChange={setAuthMode}
            />

            {authMode === "signup" ? (
              <input
                className="w-full rounded-2xl border border-blue-100 bg-blue-50/40 px-4 py-3 text-sm text-ink outline-none ring-blue-300 transition focus:ring-2"
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Display name"
                value={displayName}
              />
            ) : null}

            <input
              className="w-full rounded-2xl border border-blue-100 bg-blue-50/40 px-4 py-3 text-sm text-ink outline-none ring-blue-300 transition focus:ring-2"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email"
              type="email"
              value={email}
            />

            <input
              className="w-full rounded-2xl border border-blue-100 bg-blue-50/40 px-4 py-3 text-sm text-ink outline-none ring-blue-300 transition focus:ring-2"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              type="password"
              value={password}
            />

            <button
              className={cn(
                "inline-flex w-full items-center justify-center gap-2 rounded-[22px] bg-cta px-4 py-4 text-sm font-semibold text-white shadow-glow",
                (!firebaseAvailable || authBusy) && "opacity-60"
              )}
              disabled={!firebaseAvailable || authBusy}
              onClick={() => onEmailAuth({ mode: authMode, displayName, email, password })}
              type="button"
            >
              {authBusy ? "Working..." : authMode === "signup" ? "Create account" : "Sign in"}
              <ArrowRight className="h-4 w-4" />
            </button>

            <button
              className={cn(
                "w-full rounded-[22px] border border-blue-100 bg-white px-4 py-4 text-sm font-semibold text-ink",
                (!firebaseAvailable || authBusy) && "opacity-60"
              )}
              disabled={!firebaseAvailable || authBusy}
              onClick={onGoogle}
              type="button"
            >
              Continue with Google
            </button>

            <button
              className="w-full rounded-[22px] border border-dashed border-blue-200 bg-blue-50/60 px-4 py-4 text-sm font-semibold text-blue-700"
              onClick={onUseDemo}
              type="button"
            >
              Explore demo mode
            </button>

            {authError ? <p className="text-sm leading-6 text-rose-600">{authError}</p> : null}
            {!firebaseAvailable ? (
              <p className="text-sm leading-6 text-muted">
                Account sign-in is not available on this build right now, so demo mode stays open.
              </p>
            ) : null}
          </div>
        </Card>

        <div className="grid gap-3">
          {[
            "Daily readiness ring with clear body-vs-matchup context",
            "Rec score movement that explains the why, not just the number",
            "Head-to-head and recent form views that actually help before a match"
          ].map((item) => (
            <Card key={item} className="px-4 py-4">
              <p className="text-sm leading-6 text-ink">{item}</p>
            </Card>
          ))}
        </div>

        <div className="flex items-center justify-between px-1 text-sm text-muted">
          <Link className="font-semibold text-blue-600" href="/about">
            About
          </Link>
          <Link className="font-semibold text-blue-600" href="/privacy">
            Privacy
          </Link>
        </div>
      </div>
    </div>
  );
};
