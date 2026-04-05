"use client";

import { useEffect, useState } from "react";
import { ChevronRight, CloudOff, Sparkles } from "lucide-react";
import Image from "next/image";

import { diagnoseFatigueVsMatchup } from "@shared/domain/matchup-diagnosis";
import type { MatchRecord } from "@shared/domain/types";

import { BottomNav, type TabId } from "@/components/bottom-nav";
import { LandingPage } from "@/components/landing-page";
import { MatchDetailSheet } from "@/components/match-detail-sheet";
import { MatchLogSheet } from "@/components/match-log-sheet";
import { MorningCheckInSheet } from "@/components/morning-check-in-sheet";
import { OnboardingFlow } from "@/components/onboarding-flow";
import { ScoreExplanationsSheet } from "@/components/score-explanations-sheet";
import { HomeTab } from "@/components/tabs/home-tab";
import { MatchesTab } from "@/components/tabs/matches-tab";
import { PlayersTab } from "@/components/tabs/players-tab";
import { SettingsTab } from "@/components/tabs/settings-tab";
import { StatsTab } from "@/components/tabs/stats-tab";
import { Card } from "@/components/ui";
import { usePickleReadyState } from "@/hooks/use-pickle-ready-state";
import { initializeFirebaseAnalytics } from "@/lib/firebase/client";

const formatPercentage = (value: number | undefined | null) => (typeof value === "number" ? `${Math.round(value)}%` : "—");
const formatHours = (value: number | undefined | null) => (typeof value === "number" ? `${(value / 3_600_000).toFixed(1)}h` : "—");
const formatNumber = (value: number | undefined | null, digits = 0) =>
  typeof value === "number" ? value.toFixed(digits) : "—";
const formatSigned = (value: number | undefined | null, digits = 1) =>
  typeof value === "number" ? `${value >= 0 ? "+" : ""}${value.toFixed(digits)}` : "—";
const formatDayGap = (value: number | null | undefined) => (typeof value === "number" ? `${value}d` : "—");

export const PickleReadyApp = () => {
  const {
    loading,
    state,
    opponents,
    currentReadiness,
    currentCheckIn,
    currentRating,
    recentMatches,
    todayRecScore,
    mode,
    authBusy,
    syncing,
    error,
    firebaseReady,
    whoopConnectionAvailable,
    saveMatch,
    saveMorningCheckIn,
    deleteMatch,
    completeOnboarding,
    reopenOnboarding,
    toggleWhoopConnection,
    toggleNotifications,
    resetDemoData,
    enterDemoMode,
    exitDemoMode,
    signInWithGoogle,
    submitEmailAuth,
    signOutFromApp
  } = usePickleReadyState();
  const [activeTab, setActiveTab] = useState<TabId>("home");
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingMatch, setEditingMatch] = useState<MatchRecord | null>(null);
  const [prefilledOpponentName, setPrefilledOpponentName] = useState<string | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<MatchRecord | null>(null);
  const [onboardingVisible, setOnboardingVisible] = useState(false);
  const [readinessSheetOpen, setReadinessSheetOpen] = useState(false);
  const [recSheetOpen, setRecSheetOpen] = useState(false);
  const [checkInOpen, setCheckInOpen] = useState(false);

  useEffect(() => {
    void initializeFirebaseAnalytics();
  }, []);

  useEffect(() => {
    if (state && !state.onboardingComplete) {
      setOnboardingVisible(true);
    }
  }, [state]);

  if (loading) {
    return (
      <div className="min-h-screen bg-hero px-4 py-8">
        <div className="mx-auto max-w-[390px] space-y-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-32 animate-pulse rounded-[28px] bg-white/70" />
          ))}
        </div>
      </div>
    );
  }

  if (mode === "guest" || !state) {
    return (
      <LandingPage
        authBusy={authBusy}
        authError={error}
        firebaseAvailable={firebaseReady}
        onEmailAuth={(payload) => void submitEmailAuth(payload)}
        onGoogle={() => void signInWithGoogle()}
        onUseDemo={enterDemoMode}
      />
    );
  }

  const openNewMatch = (opponentName?: string) => {
    setSelectedMatch(null);
    setEditingMatch(null);
    setPrefilledOpponentName(opponentName ?? null);
    setComposerOpen(true);
  };

  const openEditMatch = (match: MatchRecord) => {
    setSelectedMatch(null);
    setEditingMatch(match);
    setPrefilledOpponentName(null);
    setComposerOpen(true);
  };

  const diagnosis = diagnoseFatigueVsMatchup(
    currentReadiness,
    state.matches,
    todayRecScore,
    state.profile.timeZone
  );
  const readinessDetailSections = currentReadiness
    ? [
        {
          eyebrow: "Score mix",
          title: "How the overall score is built",
          items: [
            { label: "Overall", value: formatNumber(currentReadiness.overall) },
            { label: "Physical", value: `${formatNumber(currentReadiness.physical)} x 45%` },
            { label: "Skill", value: `${formatNumber(currentReadiness.performance)} x 35%` },
            { label: "Activity", value: `${formatNumber(currentReadiness.activity)} x 20%` }
          ]
        },
        currentReadiness.physicalSource === "whoop"
          ? {
              eyebrow: "Whoop inputs",
              title: "Today's wearable data",
              items: [
                { label: "Recovery", value: formatPercentage(currentReadiness.whoopData.recoveryScore) },
                { label: "Sleep perf", value: formatPercentage(currentReadiness.whoopData.sleepPerformance) },
                { label: "Sleep", value: formatHours(currentReadiness.whoopData.sleepDurationMs) },
                { label: "HRV", value: formatNumber(currentReadiness.whoopData.hrvRmssd) },
                { label: "Resting HR", value: currentReadiness.whoopData.restingHeartRate != null ? `${Math.round(currentReadiness.whoopData.restingHeartRate)} bpm` : "—" },
                { label: "Strain", value: formatNumber(currentReadiness.whoopData.strain, 1) }
              ]
            }
          : currentReadiness.checkInData
            ? {
                eyebrow: "Morning Check-In",
                title: "Today's manual inputs",
                items: [
                  { label: "Sleep", value: currentReadiness.checkInData.sleepHours != null ? `${currentReadiness.checkInData.sleepHours.toFixed(1)}h` : "—" },
                  { label: "Quality", value: currentReadiness.checkInData.sleepQuality != null ? `${currentReadiness.checkInData.sleepQuality}/5` : "—" },
                  { label: "Energy", value: currentReadiness.checkInData.energy != null ? `${currentReadiness.checkInData.energy}/5` : "—" },
                  { label: "Soreness", value: currentReadiness.checkInData.soreness != null ? `${currentReadiness.checkInData.soreness}/5` : "—" },
                  { label: "Stress", value: currentReadiness.checkInData.stress != null ? `${currentReadiness.checkInData.stress}/5` : "—" },
                  { label: "Sharpness", value: currentReadiness.checkInData.mentalSharpness != null ? `${currentReadiness.checkInData.mentalSharpness}/5` : "—" }
                ]
              }
            : {
                eyebrow: "Physical input",
                title: "Fallback mode",
                items: [
                  { label: "Source", value: "No live body signal", caption: "Connect Whoop or complete a Morning Check-In to replace the default physical estimate." },
                  { label: "Physical", value: formatNumber(currentReadiness.physical) }
                ]
              },
        {
          eyebrow: "Context",
          title: "Match and rating signals",
          items: [
            { label: "14-day matches", value: formatNumber(currentReadiness.matchData.recentMatchCount) },
            { label: "Win rate", value: formatPercentage(currentReadiness.matchData.recentWinRate * 100) },
            { label: "Days since", value: formatDayGap(currentReadiness.matchData.daysSinceLastMatch) },
            { label: "Avg margin", value: formatSigned(currentReadiness.matchData.avgMargin, 1) },
            { label: "DUPR", value: currentReadiness.duprData.doublesRating != null ? currentReadiness.duprData.doublesRating.toFixed(2) : currentReadiness.duprData.singlesRating != null ? currentReadiness.duprData.singlesRating.toFixed(2) : "—" },
            { label: "14-day trend", value: formatSigned(currentReadiness.duprData.ratingTrend, 2) }
          ]
        }
      ]
    : [];

  const handleShare = async () => {
    const shareText = `My PickleReady today: readiness ${currentReadiness?.overall ?? 65} (${currentReadiness?.label ?? "Good for rec"}) and rec score ${todayRecScore.toFixed(2)}.`;
    const shareUrl = typeof window !== "undefined" ? window.location.href : "https://swisher-pickleready-codex.web.app";

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "PickleReady",
          text: shareText,
          url: shareUrl
        });
        return;
      } catch {
        // fall through to clipboard
      }
    }

    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
    }
  };

  return (
    <div className="min-h-screen bg-hero text-ink">
      <div className="relative mx-auto flex min-h-screen w-full max-w-[430px] flex-col px-4 pb-28 pt-5">
        <div className="absolute left-[-5rem] top-[-4rem] h-40 w-40 rounded-full bg-cyan-200/45 blur-3xl" />
        <div className="absolute right-[-4rem] top-20 h-36 w-36 rounded-full bg-violet-200/45 blur-3xl" />

        <header className="relative z-10">
          <Card className="overflow-hidden rounded-[32px] px-5 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-500">PickleReady</p>
                <h1 className="mt-1 text-[1.75rem] font-bold tracking-[-0.06em] text-ink">
                  {state.profile.displayName.split(" ")[0]}&apos;s court report
                </h1>
                <p className="mt-2 max-w-[18rem] text-sm leading-6 text-muted">
                  Daily readiness, matchup context, and rec-score movement in one native-feeling flow.
                </p>
              </div>
              <Image
                alt={state.profile.displayName}
                className="h-14 w-14 rounded-[20px] border border-white/80 object-cover shadow-card"
                height={56}
                src={state.profile.photoURL}
                width={56}
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${mode === "live" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"}`}>
                <Sparkles className="h-3.5 w-3.5" />
                {mode === "live" ? "Live account mode" : "Demo mode"}
              </span>
              <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${state.profile.whoopConnected ? "bg-cyan-50 text-cyan-700" : "bg-amber-50 text-amber-700"}`}>
                {state.profile.whoopConnected ? "Wearable data connected" : "Morning Check-In ready"}
              </span>
              {!state.profile.whoopConnected ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                  <CloudOff className="h-3.5 w-3.5" />
                  Whoop not connected
                </span>
              ) : null}
            </div>
          </Card>
        </header>

        {!state.profile.whoopConnected ? (
          <div className="mt-4">
            <Card className="rounded-[28px] border-amber-100 bg-gradient-to-r from-amber-50 via-white to-amber-50 px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink">
                    {currentCheckIn ? "Manual readiness mode is active" : "Physical readiness is in fallback mode"}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-muted">
                    {currentCheckIn
                      ? "Your Morning Check-In is powering today’s physical score with medium confidence."
                      : "Complete a Morning Check-In to replace the 65-point fallback with a real fatigue signal right away."}
                  </p>
                </div>
                <button
                  className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600"
                  onClick={() => setCheckInOpen(true)}
                  type="button"
                >
                  Check in
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </Card>
          </div>
        ) : null}

        <main className="relative z-10 mt-5 flex-1">
          {activeTab === "home" ? (
            <HomeTab
              currentCheckIn={currentCheckIn}
              diagnosis={diagnosis}
              dupr={state.dupr}
              onLogMatch={openNewMatch}
              onOpenCheckIn={() => setCheckInOpen(true)}
              onOpenReadinessDetails={() => setReadinessSheetOpen(true)}
              onOpenRecDetails={() => setRecSheetOpen(true)}
              onOpenMatch={(match) => setSelectedMatch(match)}
              onShare={() => void handleShare()}
              ratingHistory={state.ratingHistory}
              readiness={currentReadiness ?? null}
              recentMatches={recentMatches}
              recScore={todayRecScore}
              syncing={syncing}
            />
          ) : null}

          {activeTab === "stats" ? (
            <StatsTab
              matches={state.matches}
              ratingHistory={state.ratingHistory}
              readinessHistory={state.readinessHistory}
            />
          ) : null}

          {activeTab === "matches" ? (
            <MatchesTab matches={state.matches} onLogMatch={openNewMatch} onOpenMatch={(match) => setSelectedMatch(match)} />
          ) : null}

          {activeTab === "players" ? (
            <PlayersTab currentRecScore={todayRecScore} onQuickLog={openNewMatch} opponents={opponents} />
          ) : null}

          {activeTab === "settings" ? (
            <SettingsTab
              error={error}
              mode={mode}
              notificationsEnabled={state.notificationsEnabled}
              onExitDemo={exitDemoMode}
              onReopenOnboarding={async () => {
                const reopened = await reopenOnboarding();

                if (reopened !== false) {
                  setOnboardingVisible(true);
                }
              }}
              onResetDemoData={resetDemoData}
              onSignOut={() => void signOutFromApp()}
              onToggleNotifications={toggleNotifications}
              onToggleWhoop={toggleWhoopConnection}
              profile={state.profile}
              syncing={syncing}
              whoopConnected={state.profile.whoopConnected}
              whoopConnectionAvailable={whoopConnectionAvailable}
            />
          ) : null}
        </main>

        <BottomNav activeTab={activeTab} onChange={setActiveTab} />
      </div>

      <MatchLogSheet
        currentReadiness={currentReadiness ?? null}
        initialMatch={editingMatch}
        onClose={() => {
          setComposerOpen(false);
          setEditingMatch(null);
          setPrefilledOpponentName(null);
        }}
        onSave={async (match) => {
          const saved = await saveMatch(match);

          if (saved !== false) {
            setComposerOpen(false);
            setEditingMatch(null);
            setPrefilledOpponentName(null);
          }

          return saved;
        }}
        open={composerOpen}
        opponents={opponents}
        prefilledOpponentName={prefilledOpponentName}
      />

      <MatchDetailSheet
        match={selectedMatch}
        onClose={() => setSelectedMatch(null)}
        onDelete={deleteMatch}
        onEdit={openEditMatch}
      />

      <OnboardingFlow
        initialDuprId={state.profile.duprId}
        initialDuprRating={state.dupr.doublesRating ?? state.dupr.singlesRating}
        initialEmail={state.profile.email}
        initialName={state.profile.displayName}
        initialWhoopConnected={state.profile.whoopConnected}
        onClose={() => setOnboardingVisible(false)}
        onComplete={completeOnboarding}
        open={onboardingVisible}
        whoopConnectionAvailable={whoopConnectionAvailable}
      />

      <MorningCheckInSheet
        initialCheckIn={currentCheckIn}
        onClose={() => setCheckInOpen(false)}
        onSave={async (checkIn) => {
          const saved = await saveMorningCheckIn(checkIn);

          if (saved !== false) {
            setCheckInOpen(false);
          }

          return saved;
        }}
        open={checkInOpen}
      />

      <ScoreExplanationsSheet
        detailSections={readinessDetailSections}
        explanations={currentReadiness?.changeExplanations ?? []}
        onClose={() => setReadinessSheetOpen(false)}
        open={readinessSheetOpen}
        score={`${currentReadiness?.overall ?? 65}`}
        subtitle="These are the biggest drivers behind today’s readiness score."
        title="Readiness score"
      />

      <ScoreExplanationsSheet
        explanations={currentRating?.recScoreChangeExplanations ?? []}
        onClose={() => setRecSheetOpen(false)}
        open={recSheetOpen}
        score={todayRecScore.toFixed(2)}
        subtitle="These factors explain the latest movement in your internal rec score."
        title="Rec score"
      />
    </div>
  );
};
