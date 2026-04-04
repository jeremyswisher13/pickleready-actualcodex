"use client";

import { ArrowUpRight, Bell, Database, Shield, Watch } from "lucide-react";
import Image from "next/image";

import type { UserProfile } from "@shared/domain/types";
import type { AppMode } from "@/hooks/use-pickle-ready-state";

import { Card, SectionTitle } from "@/components/ui";

export const SettingsTab = ({
  profile,
  mode,
  whoopConnected,
  whoopConnectionAvailable,
  notificationsEnabled,
  syncing,
  error,
  onToggleWhoop,
  onToggleNotifications,
  onReopenOnboarding,
  onResetDemoData,
  onExitDemo,
  onSignOut
}: {
  profile: UserProfile;
  mode: AppMode;
  whoopConnected: boolean;
  whoopConnectionAvailable: boolean;
  notificationsEnabled: boolean;
  syncing: boolean;
  error: string | null;
  onToggleWhoop: () => void;
  onToggleNotifications: () => void;
  onReopenOnboarding: () => void;
  onResetDemoData: () => void;
  onExitDemo: () => void;
  onSignOut: () => void;
}) => (
  <div className="space-y-5">
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-500">Settings</p>
      <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink">Profile, connections, and privacy.</h2>
    </div>

    <Card className="px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-500">App mode</p>
          <p className="mt-1 text-sm text-ink">{mode === "live" ? "Signed-in live account" : "Demo exploration mode"}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${mode === "live" ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-700"}`}>
          {mode === "live" ? "Live" : "Demo"}
        </span>
      </div>
      {syncing ? <p className="mt-3 text-sm text-muted">Syncing your latest profile and score changes...</p> : null}
      {error ? <p className="mt-3 text-sm leading-6 text-rose-600">{error}</p> : null}
    </Card>

    <Card className="px-5 py-5">
      <SectionTitle eyebrow="Profile" title="Account" />
      <div className="mt-4 flex items-center gap-4">
        <Image
          alt={profile.displayName}
          className="h-16 w-16 rounded-[22px] object-cover"
          height={64}
          src={profile.photoURL}
          width={64}
        />
        <div>
          <p className="text-lg font-semibold text-ink">{profile.displayName}</p>
          <p className="mt-1 text-sm text-muted">{profile.email}</p>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-blue-500">
            {profile.duprId || "No DUPR ID linked yet"}
          </p>
        </div>
      </div>
    </Card>

    <Card className="px-5 py-5">
      <SectionTitle eyebrow="Connected accounts" title="Integrations" />
      <div className="mt-4 space-y-3">
        <div className="flex w-full items-center justify-between rounded-[22px] border border-blue-100 bg-blue-50/40 px-4 py-4 text-left">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-white p-2 text-blue-700">
              <Watch className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">Whoop</p>
              <p className="text-sm text-muted">
                {whoopConnected
                  ? "Connected and feeding wearable recovery into your readiness."
                  : whoopConnectionAvailable
                    ? "Available in demo mode so you can preview the wearable path."
                    : "Morning Check-In is the active path today while wearable sync is being finalized."}
              </p>
            </div>
          </div>
          {whoopConnectionAvailable ? (
            <button
              className={`rounded-full px-3 py-1 text-xs font-semibold ${whoopConnected ? "bg-emerald-50 text-emerald-600" : "bg-blue-100 text-blue-700"}`}
              onClick={onToggleWhoop}
              type="button"
            >
              {whoopConnected ? "Connected" : "Preview"}
            </button>
          ) : (
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${whoopConnected ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-700"}`}>
              {whoopConnected ? "Connected" : "Morning Check-In"}
            </span>
          )}
        </div>

        <div className="rounded-[22px] border border-blue-100 bg-blue-50/40 px-4 py-4">
          <p className="text-sm font-semibold text-ink">DUPR baseline</p>
          <p className="mt-1 text-sm text-muted">
            {profile.duprId
              ? `DUPR ID ${profile.duprId} is saved as your skill anchor.`
              : "Add your DUPR ID in onboarding so your rec score starts from a realistic baseline."}
          </p>
        </div>
      </div>
    </Card>

    <Card className="px-5 py-5">
      <SectionTitle eyebrow="Preferences" title="Alerts and data" />
      <div className="mt-4 space-y-3">
        <button
          className="flex w-full items-center justify-between rounded-[22px] border border-blue-100 bg-blue-50/40 px-4 py-4 text-left"
          onClick={onToggleNotifications}
          type="button"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-white p-2 text-blue-700">
              <Bell className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">Daily readiness alert</p>
              <p className="text-sm text-muted">Readiness reminder preference for this account.</p>
            </div>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${notificationsEnabled ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-600"}`}>
            {notificationsEnabled ? "On" : "Off"}
          </span>
        </button>

        <div className="rounded-[22px] border border-blue-100 bg-blue-50/40 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-white p-2 text-blue-700">
              <Shield className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">Privacy</p>
              <p className="text-sm text-muted">Firestore rules are locked so users only access their own documents.</p>
            </div>
          </div>
        </div>

        <div className="rounded-[22px] border border-blue-100 bg-blue-50/40 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-white p-2 text-blue-700">
              <Database className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">Data policy</p>
              <p className="text-sm text-muted">Third-party tokens stay server-side only and are encrypted before they are stored.</p>
            </div>
          </div>
        </div>
      </div>
    </Card>

    <Card className="px-5 py-5">
      <SectionTitle eyebrow="Learn more" title="About and privacy" />
      <div className="mt-4 space-y-3">
        <a
          className="flex items-center justify-between rounded-[22px] border border-blue-100 bg-blue-50/40 px-4 py-4 text-left"
          href="/about"
        >
          <div>
            <p className="text-sm font-semibold text-ink">About PickleReady</p>
            <p className="text-sm text-muted">How readiness, rec score, and matchup context fit together.</p>
          </div>
          <ArrowUpRight className="h-4 w-4 text-blue-600" />
        </a>
        <a
          className="flex items-center justify-between rounded-[22px] border border-blue-100 bg-blue-50/40 px-4 py-4 text-left"
          href="/privacy"
        >
          <div>
            <p className="text-sm font-semibold text-ink">Privacy policy</p>
            <p className="text-sm text-muted">What data is stored, how connected accounts are handled, and what stays private.</p>
          </div>
          <ArrowUpRight className="h-4 w-4 text-blue-600" />
        </a>
      </div>
    </Card>

    <div className="grid grid-cols-2 gap-3">
      <button
        className="rounded-[22px] border border-blue-100 bg-white px-4 py-4 text-sm font-semibold text-ink"
        onClick={onReopenOnboarding}
        type="button"
      >
        Reopen onboarding
      </button>
      {mode === "demo" ? (
        <button
          className="rounded-[22px] bg-blue-600 px-4 py-4 text-sm font-semibold text-white"
          onClick={onResetDemoData}
          type="button"
        >
          Reset demo data
        </button>
      ) : (
        <button
          className="rounded-[22px] bg-blue-600 px-4 py-4 text-sm font-semibold text-white"
          onClick={onSignOut}
          type="button"
        >
          Sign out
        </button>
      )}
    </div>

    {mode === "demo" ? (
      <div className="grid grid-cols-2 gap-3">
        <button
          className="rounded-[22px] border border-blue-100 bg-white px-4 py-4 text-sm font-semibold text-ink"
          onClick={onExitDemo}
          type="button"
        >
          Exit demo
        </button>
        <div className="rounded-[22px] bg-blue-50/60 px-4 py-4 text-sm leading-6 text-muted">
          Demo mode keeps the full product feel while letting you explore without touching live account data.
        </div>
      </div>
    ) : (
      <div className="rounded-[22px] bg-blue-50/60 px-4 py-4 text-sm leading-6 text-muted">
        Your account data stays private to you, and the live app is built to surface the why behind each readiness and rec-score change.
      </div>
    )}
  </div>
);
