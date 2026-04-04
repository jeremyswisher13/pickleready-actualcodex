"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User
} from "firebase/auth";
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  writeBatch
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

import { createSeedData } from "@shared/data/mock";
import { generatePostMatchInsight } from "@shared/domain/insight";
import { calculateReadinessScore } from "@shared/domain/readiness";
import { averageMatchMargin, replayRecRatings } from "@shared/domain/rec-score";
import type {
  ChangeExplanation,
  DailyCheckIn,
  DuprSnapshot,
  MatchRecord,
  OpponentProfile,
  RatingEntry,
  ReadinessScore,
  UserProfile,
  WhoopBaseline,
  WhoopMetrics
} from "@shared/domain/types";
import { detectTimeZone, localDateKey } from "@shared/domain/utils";

import { auth, db, firebaseConfigured, functions as firebaseFunctions, googleProvider } from "@/lib/firebase/client";

export interface DemoState {
  profile: UserProfile;
  dupr: DuprSnapshot;
  whoopToday: WhoopMetrics | null;
  whoopBaseline: WhoopBaseline | null;
  dailyCheckins: DailyCheckIn[];
  matches: MatchRecord[];
  readinessHistory: ReadinessScore[];
  ratingHistory: RatingEntry[];
  onboardingComplete: boolean;
  notificationsEnabled: boolean;
}

export type AppMode = "guest" | "demo" | "live";

const STORAGE_KEY = "pickleready-demo-state-v3";
const MODE_STORAGE_KEY = "pickleready-app-mode";
const DEFAULT_PHOTO_URL =
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80";
const WHOOP_OAUTH_ENABLED = process.env.NEXT_PUBLIC_WHOOP_OAUTH_ENABLED === "true";

const createInitialState = (): DemoState => {
  const seed = createSeedData();
  return {
    ...seed,
    dailyCheckins: [],
    onboardingComplete: false,
    notificationsEnabled: true
  };
};

const readModePreference = () => {
  const storedMode = window.localStorage.getItem(MODE_STORAGE_KEY);
  return storedMode === "demo" ? "demo" : "guest";
};

const fromStoredDate = (value: unknown) => {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string") {
    return value;
  }

  return new Date().toISOString();
};

const asNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
};

const buildReadinessStub = (score: number): ReadinessScore => ({
  dateString: localDateKey(),
  overall: score,
  physical: score,
  performance: score,
  activity: score,
  whoopData: {},
  checkInData: undefined,
  duprData: {},
  matchData: {
    recentMatchCount: 0,
    recentWinRate: 0,
    daysSinceLastMatch: null,
    avgMargin: 0
  },
  changeExplanations: [],
  calculatedAt: new Date().toISOString(),
  label: score >= 80 ? "Go compete" : score >= 60 ? "Good for rec" : score >= 40 ? "Light session" : "Rest day",
  confidence: "low",
  physicalSource: "fallback"
});

const getTodayDateString = () => localDateKey();

const sortCheckInsDesc = (checkIns: DailyCheckIn[]) =>
  [...checkIns].sort((left, right) => new Date(right.submittedAt).getTime() - new Date(left.submittedAt).getTime());

const getCurrentCheckIn = (checkIns: DailyCheckIn[]) =>
  sortCheckInsDesc(checkIns).find((checkIn) => checkIn.dateString === getTodayDateString()) ?? null;

const sortReadinessAsc = (entries: ReadinessScore[]) =>
  [...entries].sort((left, right) => new Date(left.calculatedAt).getTime() - new Date(right.calculatedAt).getTime());

const sortRatingsAsc = (entries: RatingEntry[]) =>
  [...entries].sort((left, right) => {
    if (left.dateString !== right.dateString) {
      return left.dateString.localeCompare(right.dateString);
    }

    return new Date(left.updatedAt).getTime() - new Date(right.updatedAt).getTime();
  });

const sortMatchesDesc = (matches: MatchRecord[]) =>
  [...matches].sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime());

const buildOpponentProfiles = (matches: MatchRecord[]): OpponentProfile[] => {
  const groups = new Map<string, OpponentProfile>();

  sortMatchesDesc(matches).forEach((match) => {
    match.opponents.forEach((opponent) => {
      const key = opponent.userId ?? opponent.duprId ?? opponent.name.toLowerCase().replace(/\s+/g, "-");
      const existing = groups.get(key);
      const margin = averageMatchMargin(match.games);

      if (!existing) {
        groups.set(key, {
          id: key,
          name: opponent.name,
          duprId: opponent.duprId,
          userId: opponent.userId,
          rating: opponent.rating,
          matchesPlayed: 1,
          wins: match.result === "win" ? 1 : 0,
          losses: match.result === "loss" ? 1 : 0,
          lastPlayed: match.date,
          avgMargin: margin,
          lastFiveMatches: [match]
        });
        return;
      }

      existing.matchesPlayed += 1;
      existing.wins += match.result === "win" ? 1 : 0;
      existing.losses += match.result === "loss" ? 1 : 0;
      existing.rating = opponent.rating ?? existing.rating;
      existing.lastPlayed = existing.lastPlayed > match.date ? existing.lastPlayed : match.date;
      existing.avgMargin = (existing.avgMargin * (existing.matchesPlayed - 1) + margin) / existing.matchesPlayed;
      existing.lastFiveMatches = [match, ...existing.lastFiveMatches].slice(0, 5);
    });
  });

  return [...groups.values()].sort((left, right) => right.matchesPlayed - left.matchesPlayed);
};

const normalizeState = (state: DemoState): DemoState => {
  const dailyCheckins = sortCheckInsDesc(state.dailyCheckins ?? []);
  const chronologicalMatches = [...state.matches].sort(
    (left, right) => new Date(left.date).getTime() - new Date(right.date).getTime()
  );
  const startingRating = state.dupr.doublesRating ?? state.dupr.singlesRating ?? 3.5;
  const replay = replayRecRatings(chronologicalMatches, startingRating, {
    singles: state.dupr.singlesRating,
    doubles: state.dupr.doublesRating
  });

  let runningPreviousRec = startingRating;
  const recalculatedMatches = chronologicalMatches.map((match, index) => {
    const update = replay.updates.get(match.id);
    const previousMatchesAgainstOpponent = chronologicalMatches.slice(0, index).filter((candidate) =>
      candidate.opponents.some((opponent) => match.opponents.some((matchOpponent) => matchOpponent.name === opponent.name))
    );

    const readinessStub = buildReadinessStub(match.readinessAtTime);
    const recScoreAfter = update?.newRating ?? runningPreviousRec;
    const insight = generatePostMatchInsight({
      match,
      readiness: readinessStub,
      previousRecScore: runningPreviousRec,
      newRecScore: recScoreAfter,
      opponentRating: match.opponentAverageRating,
      h2hMatchesBefore: previousMatchesAgainstOpponent.length,
      h2hWinsBefore: previousMatchesAgainstOpponent.filter((candidate) => candidate.result === "win").length,
      h2hLossesBefore: previousMatchesAgainstOpponent.filter((candidate) => candidate.result === "loss").length
    });

    runningPreviousRec = recScoreAfter;

    return {
      ...match,
      postMatchInsight: insight,
      recScoreDelta: update?.delta ?? 0,
      recScoreAfter
    };
  });

  const todayReadiness = calculateReadinessScore({
    dateString: getTodayDateString(),
    calculatedAt: new Date().toISOString(),
    userTimeZone: state.profile.timeZone,
    whoop: state.whoopToday ?? undefined,
    baseline: state.whoopBaseline ?? undefined,
    checkIn: getCurrentCheckIn(dailyCheckins) ?? undefined,
    dupr: state.dupr,
    matches: recalculatedMatches,
    userCreatedAt: state.profile.createdAt
  });

  const readinessHistory = [
    ...state.readinessHistory.filter((entry) => entry.dateString !== todayReadiness.dateString).slice(-29),
    todayReadiness
  ].sort((left, right) => new Date(left.calculatedAt).getTime() - new Date(right.calculatedAt).getTime());

  return {
    ...state,
    dailyCheckins,
    matches: sortMatchesDesc(recalculatedMatches),
    ratingHistory: replay.entries,
    readinessHistory
  };
};

const parseStoredState = (rawValue: string | null) => {
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as DemoState;
  } catch {
    return null;
  }
};

const toChangeExplanations = (value: unknown): ChangeExplanation[] =>
  Array.isArray(value)
    ? value
        .map((entry) => {
          if (!entry || typeof entry !== "object") {
            return null;
          }

          const payload = entry as Record<string, unknown>;
          return {
            factor: typeof payload.factor === "string" ? payload.factor : "update",
            impact: asNumber(payload.impact) ?? 0,
            description: typeof payload.description === "string" ? payload.description : ""
          };
        })
        .filter((entry): entry is ChangeExplanation => Boolean(entry))
    : [];

const toMatchRecord = (id: string, payload: Record<string, unknown>): MatchRecord => ({
  id,
  date: fromStoredDate(payload.date),
  createdAt: fromStoredDate(payload.createdAt),
  matchType: (payload.matchType as MatchRecord["matchType"]) ?? "singles",
  category: (payload.category as MatchRecord["category"]) ?? "rec",
  format: (payload.format as MatchRecord["format"]) ?? "standard",
  environment: (payload.environment as MatchRecord["environment"]) ?? "outdoor",
  genderFormat: (payload.genderFormat as MatchRecord["genderFormat"]) ?? "open",
  opponents: Array.isArray(payload.opponents) ? (payload.opponents as MatchRecord["opponents"]) : [],
  partner: payload.partner as MatchRecord["partner"],
  games: Array.isArray(payload.games) ? (payload.games as MatchRecord["games"]) : [],
  result: (payload.result as MatchRecord["result"]) ?? "loss",
  notes: typeof payload.notes === "string" ? payload.notes : "",
  verified: Boolean(payload.verified),
  verifiedBy: Array.isArray(payload.verifiedBy) ? (payload.verifiedBy as string[]) : [],
  readinessAtTime: asNumber(payload.readinessAtTime) ?? 65,
  postMatchInsight: typeof payload.postMatchInsight === "string" ? payload.postMatchInsight : "",
  opponentAverageRating: asNumber(payload.opponentAverageRating),
  recScoreAfter: asNumber(payload.recScoreAfter),
  recScoreDelta: asNumber(payload.recScoreDelta)
});

const toCheckInRecord = (id: string, payload: Record<string, unknown>): DailyCheckIn => ({
  dateString: typeof payload.dateString === "string" ? payload.dateString : id,
  submittedAt: fromStoredDate(payload.submittedAt),
  source: "manual",
  sleepHours: asNumber(payload.sleepHours) ?? 7,
  sleepQuality: asNumber(payload.sleepQuality) ?? 3,
  energy: asNumber(payload.energy) ?? 3,
  soreness: asNumber(payload.soreness) ?? 3,
  stress: asNumber(payload.stress) ?? 3,
  mentalSharpness: asNumber(payload.mentalSharpness) ?? 3,
  illness: Boolean(payload.illness),
  alcohol: Boolean(payload.alcohol),
  travel: Boolean(payload.travel),
  painAreas: Array.isArray(payload.painAreas) ? payload.painAreas.filter((item): item is string => typeof item === "string") : [],
  note: typeof payload.note === "string" ? payload.note : "",
  physicalEstimate: asNumber(payload.physicalEstimate) ?? 65,
  confidence: "medium"
});

const toRatingEntry = (id: string, payload: Record<string, unknown>): RatingEntry => ({
  dateString: typeof payload.dateString === "string" ? payload.dateString : id,
  duprSingles: asNumber(payload.duprSingles),
  duprDoubles: asNumber(payload.duprDoubles),
  recScore: asNumber(payload.recScore) ?? 3.5,
  recScoreChangeExplanations: toChangeExplanations(payload.recScoreChangeExplanations),
  updatedAt: fromStoredDate(payload.updatedAt)
});

const toReadinessRecord = (id: string, payload: Record<string, unknown>): ReadinessScore => {
  const whoopData =
    payload.whoopData && typeof payload.whoopData === "object" ? (payload.whoopData as Record<string, unknown>) : {};
  const checkInData =
    payload.checkInData && typeof payload.checkInData === "object"
      ? (payload.checkInData as Record<string, unknown>)
      : undefined;
  const duprData =
    payload.duprData && typeof payload.duprData === "object" ? (payload.duprData as Record<string, unknown>) : {};
  const matchData =
    payload.matchData && typeof payload.matchData === "object" ? (payload.matchData as Record<string, unknown>) : {};
  const overall = asNumber(payload.overall) ?? 65;

  return {
    dateString: typeof payload.dateString === "string" ? payload.dateString : id,
    overall,
    physical: asNumber(payload.physical) ?? overall,
    performance: asNumber(payload.performance) ?? overall,
    activity: asNumber(payload.activity) ?? overall,
    whoopData: {
      recoveryScore: asNumber(whoopData.recoveryScore),
      hrvRmssd: asNumber(whoopData.hrvRmssd),
      restingHeartRate: asNumber(whoopData.restingHeartRate),
      sleepPerformance: asNumber(whoopData.sleepPerformance),
      sleepDurationMs: asNumber(whoopData.sleepDurationMs),
      strain: asNumber(whoopData.strain),
      cycleId: typeof whoopData.cycleId === "string" ? whoopData.cycleId : undefined,
      steps: asNumber(whoopData.steps)
    },
    checkInData: checkInData
      ? {
          dateString: typeof checkInData.dateString === "string" ? checkInData.dateString : undefined,
          submittedAt: typeof checkInData.submittedAt === "string" ? checkInData.submittedAt : undefined,
          source: "manual",
          sleepHours: asNumber(checkInData.sleepHours),
          sleepQuality: asNumber(checkInData.sleepQuality),
          energy: asNumber(checkInData.energy),
          soreness: asNumber(checkInData.soreness),
          stress: asNumber(checkInData.stress),
          mentalSharpness: asNumber(checkInData.mentalSharpness),
          illness: checkInData.illness === undefined ? undefined : Boolean(checkInData.illness),
          alcohol: checkInData.alcohol === undefined ? undefined : Boolean(checkInData.alcohol),
          travel: checkInData.travel === undefined ? undefined : Boolean(checkInData.travel),
          painAreas: Array.isArray(checkInData.painAreas)
            ? checkInData.painAreas.filter((entry): entry is string => typeof entry === "string")
            : undefined,
          note: typeof checkInData.note === "string" ? checkInData.note : undefined,
          physicalEstimate: asNumber(checkInData.physicalEstimate),
          confidence: "medium"
        }
      : undefined,
    duprData: {
      singlesRating: asNumber(duprData.singlesRating),
      doublesRating: asNumber(duprData.doublesRating),
      ratingTrend: asNumber(duprData.ratingTrend)
    },
    matchData: {
      recentMatchCount: asNumber(matchData.recentMatchCount) ?? 0,
      recentWinRate: asNumber(matchData.recentWinRate) ?? 0,
      daysSinceLastMatch:
        matchData.daysSinceLastMatch == null ? null : (asNumber(matchData.daysSinceLastMatch) ?? null),
      avgMargin: asNumber(matchData.avgMargin) ?? 0
    },
    changeExplanations: toChangeExplanations(payload.changeExplanations),
    calculatedAt: fromStoredDate(payload.calculatedAt),
    label:
      payload.label === "Go compete" ||
      payload.label === "Good for rec" ||
      payload.label === "Light session" ||
      payload.label === "Rest day"
        ? payload.label
        : overall >= 80
          ? "Go compete"
          : overall >= 60
            ? "Good for rec"
            : overall >= 40
              ? "Light session"
              : "Rest day",
    confidence:
      payload.confidence === "high" || payload.confidence === "medium" || payload.confidence === "low"
        ? payload.confidence
        : "low",
    physicalSource:
      payload.physicalSource === "whoop" || payload.physicalSource === "checkin" || payload.physicalSource === "fallback"
        ? payload.physicalSource
        : "fallback"
  };
};

const createDefaultProfile = (user: User): UserProfile => {
  const now = new Date().toISOString();

  return {
    displayName: user.displayName ?? "PickleReady Player",
    email: user.email ?? "",
    photoURL: user.photoURL ?? DEFAULT_PHOTO_URL,
    duprId: "",
    duprPlayerId: "",
    whoopConnected: false,
    whoopUserId: "",
    timeZone: detectTimeZone(),
    createdAt: now,
    updatedAt: now
  };
};

const createDefaultLiveState = (user: User): DemoState =>
  normalizeState({
    profile: createDefaultProfile(user),
    dupr: {},
    whoopToday: null,
    whoopBaseline: null,
    dailyCheckins: [],
    matches: [],
    readinessHistory: [],
    ratingHistory: [],
    onboardingComplete: false,
    notificationsEnabled: true
  });

const buildLiveState = (
  user: User,
  rootData: Record<string, unknown> | null,
  matches: MatchRecord[],
  dailyCheckins: DailyCheckIn[],
  readinessHistory: ReadinessScore[],
  ratingHistory: RatingEntry[],
  pendingReadinessSyncAt: number | null,
  pendingRatingSyncAt: number | null
): DemoState => {
  const profilePayload =
    rootData && typeof rootData.profile === "object" && rootData.profile
      ? (rootData.profile as Record<string, unknown>)
      : null;
  const preferences =
    rootData && typeof rootData.preferences === "object" && rootData.preferences
      ? (rootData.preferences as Record<string, unknown>)
      : {};
  const duprPayload =
    rootData && typeof rootData.duprSnapshot === "object" && rootData.duprSnapshot
      ? (rootData.duprSnapshot as Record<string, unknown>)
      : {};
  const defaultProfile = createDefaultProfile(user);
  const profile: UserProfile = {
    ...defaultProfile,
    displayName: (profilePayload?.displayName as string | undefined) ?? defaultProfile.displayName,
    email: (profilePayload?.email as string | undefined) ?? defaultProfile.email,
    photoURL: (profilePayload?.photoURL as string | undefined) ?? defaultProfile.photoURL,
    duprId: (profilePayload?.duprId as string | undefined) ?? "",
    duprPlayerId: (profilePayload?.duprPlayerId as string | undefined) ?? "",
    whoopConnected: Boolean(profilePayload?.whoopConnected),
    whoopUserId: (profilePayload?.whoopUserId as string | undefined) ?? "",
    timeZone: (profilePayload?.timeZone as string | undefined) ?? defaultProfile.timeZone,
    createdAt: fromStoredDate(profilePayload?.createdAt ?? defaultProfile.createdAt),
    updatedAt: fromStoredDate(profilePayload?.updatedAt ?? defaultProfile.updatedAt)
  };
  const dupr: DuprSnapshot = {
    singlesRating: asNumber(duprPayload.singlesRating),
    doublesRating: asNumber(duprPayload.doublesRating),
    ratingTrend14d: asNumber(duprPayload.ratingTrend14d)
  };

  const fallbackState = normalizeState({
    profile,
    dupr,
    whoopToday: null,
    whoopBaseline: null,
    dailyCheckins,
    matches,
    readinessHistory: [],
    ratingHistory: [],
    onboardingComplete: Boolean(preferences.onboardingComplete),
    notificationsEnabled: preferences.notificationsEnabled === undefined ? true : Boolean(preferences.notificationsEnabled)
  });

  const latestStoredReadiness = readinessHistory.at(-1);
  const latestStoredRating = ratingHistory.at(-1);
  const shouldUseFallbackReadiness =
    readinessHistory.length === 0 ||
    (pendingReadinessSyncAt != null &&
      (!latestStoredReadiness || new Date(latestStoredReadiness.calculatedAt).getTime() < pendingReadinessSyncAt));
  const shouldUseFallbackRatings =
    ratingHistory.length === 0 ||
    (pendingRatingSyncAt != null &&
      (!latestStoredRating || new Date(latestStoredRating.updatedAt).getTime() < pendingRatingSyncAt));

  return {
    ...fallbackState,
    readinessHistory: shouldUseFallbackReadiness ? fallbackState.readinessHistory : sortReadinessAsc(readinessHistory),
    ratingHistory: shouldUseFallbackRatings ? fallbackState.ratingHistory : sortRatingsAsc(ratingHistory)
  };
};

const serializeRootDocument = (state: DemoState) => ({
  profile: {
    ...state.profile,
    updatedAt: new Date().toISOString()
  },
  preferences: {
    onboardingComplete: state.onboardingComplete,
    notificationsEnabled: state.notificationsEnabled
  },
  duprSnapshot: state.dupr
});

const syncDerivedDocuments = async (userId: string, state: DemoState) => {
  const firestore = db;

  if (!firestore) {
    return;
  }

  const batch = writeBatch(firestore);

  batch.set(doc(firestore, "users", userId), serializeRootDocument(state), { merge: true });

  buildOpponentProfiles(state.matches).forEach((opponent) => {
    batch.set(
      doc(firestore, `users/${userId}/opponents/${opponent.id}`),
      {
        name: opponent.name,
        duprId: opponent.duprId,
        userId: opponent.userId,
        matchesPlayed: opponent.matchesPlayed,
        wins: opponent.wins,
        losses: opponent.losses,
        lastPlayed: opponent.lastPlayed,
        rating: opponent.rating,
        avgMargin: opponent.avgMargin
      },
      { merge: true }
    );
  });

  await batch.commit();
};

const friendlyError = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
};

export const usePickleReadyState = () => {
  const [guestMode, setGuestMode] = useState<AppMode>("guest");
  const [demoState, setDemoState] = useState<DemoState | null>(null);
  const [authReady, setAuthReady] = useState(!firebaseConfigured || !auth);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [liveRoot, setLiveRoot] = useState<Record<string, unknown> | null>(null);
  const [liveMatches, setLiveMatches] = useState<MatchRecord[]>([]);
  const [liveCheckIns, setLiveCheckIns] = useState<DailyCheckIn[]>([]);
  const [liveReadinessHistory, setLiveReadinessHistory] = useState<ReadinessScore[]>([]);
  const [liveRatingHistory, setLiveRatingHistory] = useState<RatingEntry[]>([]);
  const [authBusy, setAuthBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingReadinessSyncAt, setPendingReadinessSyncAt] = useState<number | null>(null);
  const [pendingRatingSyncAt, setPendingRatingSyncAt] = useState<number | null>(null);
  const liveWhoopConnectionAvailable = WHOOP_OAUTH_ENABLED && Boolean(firebaseFunctions);

  useEffect(() => {
    const stored = parseStoredState(window.localStorage.getItem(STORAGE_KEY));
    setDemoState(normalizeState(stored ?? createInitialState()));
    setGuestMode(readModePreference());
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    const whoopStatus = url.searchParams.get("whoop");
    const whoopMessage = url.searchParams.get("whoopMessage");

    if (!whoopStatus) {
      return;
    }

    if (whoopStatus === "error") {
      setError(whoopMessage || "Whoop connection failed. Please try again.");
    } else {
      setError(null);
    }

    url.searchParams.delete("whoop");
    url.searchParams.delete("whoopMessage");
    window.history.replaceState({}, "", url.toString());
  }, []);

  useEffect(() => {
    if (!demoState) {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(demoState));
  }, [demoState]);

  useEffect(() => {
    if (!firebaseConfigured || !auth) {
      setAuthReady(true);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
      if (!user) {
        setLiveRoot(null);
        setLiveMatches([]);
        setLiveCheckIns([]);
        setLiveReadinessHistory([]);
        setLiveRatingHistory([]);
        setPendingReadinessSyncAt(null);
        setPendingRatingSyncAt(null);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!firebaseUser || !db) {
      return;
    }

    const rootRef = doc(db, "users", firebaseUser.uid);
    const matchesRef = collection(db, `users/${firebaseUser.uid}/matches`);
    const checkInsRef = collection(db, `users/${firebaseUser.uid}/dailyCheckins`);
    const readinessRef = collection(db, `users/${firebaseUser.uid}/readinessScores`);
    const ratingsRef = collection(db, `users/${firebaseUser.uid}/ratings`);

    const unsubscribeRoot = onSnapshot(rootRef, async (snapshot) => {
      if (!snapshot.exists()) {
        await setDoc(rootRef, serializeRootDocument(createDefaultLiveState(firebaseUser)), { merge: true });
        return;
      }

      setLiveRoot(snapshot.data() as Record<string, unknown>);
    });

    const unsubscribeMatches = onSnapshot(matchesRef, (snapshot) => {
      const nextMatches = snapshot.docs.map((entry) => toMatchRecord(entry.id, entry.data() as Record<string, unknown>));
      setLiveMatches(sortMatchesDesc(nextMatches));
    });

    const unsubscribeCheckIns = onSnapshot(checkInsRef, (snapshot) => {
      const nextCheckIns = snapshot.docs.map((entry) => toCheckInRecord(entry.id, entry.data() as Record<string, unknown>));
      setLiveCheckIns(sortCheckInsDesc(nextCheckIns));
    });

    const unsubscribeReadiness = onSnapshot(readinessRef, (snapshot) => {
      const nextReadiness = snapshot.docs.map((entry) =>
        toReadinessRecord(entry.id, entry.data() as Record<string, unknown>)
      );
      setLiveReadinessHistory(sortReadinessAsc(nextReadiness));
    });

    const unsubscribeRatings = onSnapshot(ratingsRef, (snapshot) => {
      const nextRatings = snapshot.docs.map((entry) => toRatingEntry(entry.id, entry.data() as Record<string, unknown>));
      setLiveRatingHistory(sortRatingsAsc(nextRatings));
    });

    return () => {
      unsubscribeRoot();
      unsubscribeMatches();
      unsubscribeCheckIns();
      unsubscribeReadiness();
      unsubscribeRatings();
    };
  }, [firebaseUser]);

  useEffect(() => {
    window.localStorage.setItem(MODE_STORAGE_KEY, guestMode === "demo" ? "demo" : "guest");
  }, [guestMode]);

  const liveState = useMemo(
    () =>
      firebaseUser
        ? buildLiveState(
            firebaseUser,
            liveRoot,
            liveMatches,
            liveCheckIns,
            liveReadinessHistory,
            liveRatingHistory,
            pendingReadinessSyncAt,
            pendingRatingSyncAt
          )
        : null,
    [
      firebaseUser,
      liveCheckIns,
      liveMatches,
      liveRatingHistory,
      liveReadinessHistory,
      liveRoot,
      pendingRatingSyncAt,
      pendingReadinessSyncAt
    ]
  );

  const mode: AppMode = firebaseUser ? "live" : guestMode;
  const state = mode === "live" ? liveState : mode === "demo" ? demoState : null;
  const loading = !authReady || (mode === "demo" && !demoState) || (mode === "live" && !liveState);
  const opponents = useMemo(() => (state ? buildOpponentProfiles(state.matches) : []), [state]);

  const saveDemoState = (updater: (current: DemoState) => DemoState) => {
    setDemoState((current) => (current ? normalizeState(updater(current)) : current));
  };

  const syncLiveState = async (nextState: DemoState) => {
    if (!firebaseUser || !db) {
      return false;
    }

    setSyncing(true);
    setError(null);

    try {
      await syncDerivedDocuments(firebaseUser.uid, nextState);
      startTransition(() => setLiveRoot(serializeRootDocument(nextState)));
      return true;
    } catch (nextError) {
      setError(friendlyError(nextError));
      return false;
    } finally {
      setSyncing(false);
    }
  };

  const startWhoopConnectionFlow = async () => {
    if (!firebaseUser || !firebaseFunctions) {
      setError("Whoop connection is not configured for this environment yet.");
      return false;
    }

    setSyncing(true);
    setError(null);

    try {
      const createConnectUrl = httpsCallable<{ continueUrl: string }, { url: string }>(
        firebaseFunctions,
        "createWhoopConnectUrl"
      );
      const result = await createConnectUrl({
        continueUrl: window.location.href
      });

      if (!result.data?.url) {
        throw new Error("Whoop did not return a connection URL.");
      }

      window.location.assign(result.data.url);
      return true;
    } catch (nextError) {
      setError(friendlyError(nextError));
      setSyncing(false);
      return false;
    }
  };

  const disconnectWhoopAccount = async () => {
    if (!firebaseFunctions) {
      setError("Whoop connection is not configured for this environment yet.");
      return false;
    }

    setSyncing(true);
    setError(null);

    try {
      const disconnectWhoop = httpsCallable(firebaseFunctions, "disconnectWhoop");
      await disconnectWhoop();
      return true;
    } catch (nextError) {
      setError(friendlyError(nextError));
      return false;
    } finally {
      setSyncing(false);
    }
  };

  const saveMatch = async (match: MatchRecord) => {
    if (mode === "demo") {
      saveDemoState((current) => {
        const existingIndex = current.matches.findIndex((candidate) => candidate.id === match.id);
        const matches =
          existingIndex >= 0
            ? current.matches.map((candidate) => (candidate.id === match.id ? match : candidate))
            : [match, ...current.matches];

        return {
          ...current,
          matches
        };
      });
      return true;
    }

    if (!firebaseUser || !db || !state) {
      return false;
    }

    const existingIndex = state.matches.findIndex((candidate) => candidate.id === match.id);
    const nextMatches =
      existingIndex >= 0
        ? state.matches.map((candidate) => (candidate.id === match.id ? match : candidate))
        : [match, ...state.matches];
    const nextState = normalizeState({ ...state, matches: nextMatches });

    const mutationAt = Date.now();
    setPendingRatingSyncAt(mutationAt);
    setPendingReadinessSyncAt(mutationAt);
    setSyncing(true);
    setError(null);

    try {
      await setDoc(doc(db, `users/${firebaseUser.uid}/matches/${match.id}`), match, { merge: true });
      await syncDerivedDocuments(firebaseUser.uid, nextState);
      startTransition(() => {
        setLiveMatches(sortMatchesDesc(nextMatches));
        setLiveRoot(serializeRootDocument(nextState));
      });
      return true;
    } catch (nextError) {
      setError(friendlyError(nextError));
      setPendingRatingSyncAt(null);
      setPendingReadinessSyncAt(null);
      return false;
    } finally {
      setSyncing(false);
    }
  };

  const deleteExistingMatch = async (matchId: string) => {
    if (mode === "demo") {
      saveDemoState((current) => ({
        ...current,
        matches: current.matches.filter((match) => match.id !== matchId)
      }));
      return true;
    }

    if (!firebaseUser || !db || !state) {
      return false;
    }

    const nextMatches = state.matches.filter((match) => match.id !== matchId);
    const nextState = normalizeState({ ...state, matches: nextMatches });

    const mutationAt = Date.now();
    setPendingRatingSyncAt(mutationAt);
    setPendingReadinessSyncAt(mutationAt);
    setSyncing(true);
    setError(null);

    try {
      await deleteDoc(doc(db, `users/${firebaseUser.uid}/matches/${matchId}`));
      await syncDerivedDocuments(firebaseUser.uid, nextState);
      startTransition(() => {
        setLiveMatches(sortMatchesDesc(nextMatches));
        setLiveRoot(serializeRootDocument(nextState));
      });
      return true;
    } catch (nextError) {
      setError(friendlyError(nextError));
      setPendingRatingSyncAt(null);
      setPendingReadinessSyncAt(null);
      return false;
    } finally {
      setSyncing(false);
    }
  };

  const saveMorningCheckIn = async (checkIn: DailyCheckIn) => {
    if (mode === "demo") {
      saveDemoState((current) => ({
        ...current,
        dailyCheckins: [
          checkIn,
          ...current.dailyCheckins.filter((existing) => existing.dateString !== checkIn.dateString)
        ]
      }));
      return true;
    }

    if (!firebaseUser || !db || !state) {
      return false;
    }

    const nextCheckIns = [
      checkIn,
      ...state.dailyCheckins.filter((existing) => existing.dateString !== checkIn.dateString)
    ];
    const nextState = normalizeState({
      ...state,
      dailyCheckins: nextCheckIns
    });

    setPendingReadinessSyncAt(Date.now());
    setSyncing(true);
    setError(null);

    try {
      await setDoc(doc(db, `users/${firebaseUser.uid}/dailyCheckins/${checkIn.dateString}`), checkIn, { merge: true });
      await syncDerivedDocuments(firebaseUser.uid, nextState);
      startTransition(() => {
        setLiveCheckIns(sortCheckInsDesc(nextCheckIns));
        setLiveRoot(serializeRootDocument(nextState));
      });
      return true;
    } catch (nextError) {
      setError(friendlyError(nextError));
      setPendingReadinessSyncAt(null);
      return false;
    } finally {
      setSyncing(false);
    }
  };

  const completeOnboarding = async (payload: {
    displayName: string;
    email: string;
    duprId: string;
    whoopConnected: boolean;
    manualDuprRating?: number | null;
  }) => {
    if (mode === "demo") {
      saveDemoState((current) => ({
        ...current,
        onboardingComplete: true,
        profile: {
          ...current.profile,
          displayName: payload.displayName,
          email: payload.email,
          duprId: payload.duprId,
          whoopConnected: payload.whoopConnected,
          updatedAt: new Date().toISOString()
        },
        dupr: payload.manualDuprRating
          ? {
              singlesRating: payload.manualDuprRating,
              doublesRating: payload.manualDuprRating,
              ratingTrend14d: current.dupr.ratingTrend14d
            }
          : current.dupr,
        whoopToday: payload.whoopConnected ? current.whoopToday : null,
        whoopBaseline: payload.whoopConnected ? current.whoopBaseline : null
      }));
      return true;
    }

    if (!firebaseUser || !state) {
      return false;
    }

    const nextState = normalizeState({
      ...state,
      onboardingComplete: true,
      profile: {
        ...state.profile,
        displayName: payload.displayName,
        email: payload.email,
        duprId: payload.duprId,
        whoopConnected: state.profile.whoopConnected,
        updatedAt: new Date().toISOString()
      },
      dupr: payload.manualDuprRating
        ? {
            singlesRating: payload.manualDuprRating,
            doublesRating: payload.manualDuprRating,
            ratingTrend14d: state.dupr.ratingTrend14d
          }
        : state.dupr
    });

    const synced = await syncLiveState(nextState);
    if (!synced) {
      return false;
    }

    if (payload.whoopConnected && !state.profile.whoopConnected && liveWhoopConnectionAvailable) {
      return await startWhoopConnectionFlow();
    }

    return true;
  };

  const reopenOnboarding = async () => {
    if (mode === "demo") {
      saveDemoState((current) => ({
        ...current,
        onboardingComplete: false
      }));
      return true;
    }

    if (!state) {
      return false;
    }

    const nextState = {
      ...state,
      onboardingComplete: false
    };
    return await syncLiveState(nextState);
  };

  const toggleWhoopConnection = async () => {
    if (!state) {
      return;
    }

    if (mode === "demo") {
      saveDemoState((current) => ({
        ...current,
        profile: {
          ...current.profile,
          whoopConnected: !current.profile.whoopConnected,
          updatedAt: new Date().toISOString()
        },
        whoopToday: current.profile.whoopConnected ? null : createSeedData().whoopToday,
        whoopBaseline: current.profile.whoopConnected ? null : createSeedData().whoopBaseline
      }));
      return;
    }

    if (!liveWhoopConnectionAvailable) {
      setError("Wearable connection is almost ready. Morning Check-In is active until the secure sync service is turned on for this environment.");
      return;
    }

    if (state.profile.whoopConnected) {
      await disconnectWhoopAccount();
      return;
    }

    await startWhoopConnectionFlow();
  };

  const toggleNotifications = async () => {
    if (!state) {
      return false;
    }

    if (mode === "demo") {
      saveDemoState((current) => ({
        ...current,
        notificationsEnabled: !current.notificationsEnabled
      }));
      return true;
    }

    const nextState = {
      ...state,
      notificationsEnabled: !state.notificationsEnabled
    };
    return await syncLiveState(nextState);
  };

  const resetDemoData = () => {
    setDemoState(normalizeState(createInitialState()));
  };

  const enterDemoMode = () => {
    if (!demoState) {
      setDemoState(normalizeState(createInitialState()));
    }
    setGuestMode("demo");
    setError(null);
  };

  const exitDemoMode = () => {
    setGuestMode("guest");
  };

  const signInWithGoogleAccount = async () => {
    if (!auth || !googleProvider) {
      return;
    }

    setAuthBusy(true);
    setError(null);

    try {
      await signInWithPopup(auth, googleProvider);
    } catch (nextError) {
      setError(friendlyError(nextError));
    } finally {
      setAuthBusy(false);
    }
  };

  const submitEmailAuth = async (payload: {
    mode: "signin" | "signup";
    displayName: string;
    email: string;
    password: string;
  }) => {
    if (!auth) {
      return;
    }

    setAuthBusy(true);
    setError(null);

    try {
      if (payload.mode === "signup") {
        const credential = await createUserWithEmailAndPassword(auth, payload.email, payload.password);

        if (payload.displayName.trim()) {
          await updateProfile(credential.user, { displayName: payload.displayName.trim() });
        }
      } else {
        await signInWithEmailAndPassword(auth, payload.email, payload.password);
      }
    } catch (nextError) {
      setError(friendlyError(nextError));
    } finally {
      setAuthBusy(false);
    }
  };

  const signOutFromApp = async () => {
    if (!auth) {
      return;
    }

    await signOut(auth);
    setGuestMode("guest");
  };

  useEffect(() => {
    if (pendingReadinessSyncAt == null) {
      return;
    }

    const latestReadiness = liveReadinessHistory.at(-1);
    if (latestReadiness && new Date(latestReadiness.calculatedAt).getTime() >= pendingReadinessSyncAt) {
      setPendingReadinessSyncAt(null);
    }
  }, [liveReadinessHistory, pendingReadinessSyncAt]);

  useEffect(() => {
    if (pendingRatingSyncAt == null) {
      return;
    }

    const latestRating = liveRatingHistory.at(-1);
    if (latestRating && new Date(latestRating.updatedAt).getTime() >= pendingRatingSyncAt) {
      setPendingRatingSyncAt(null);
    }
  }, [liveRatingHistory, pendingRatingSyncAt]);

  const currentReadiness = state?.readinessHistory.at(-1) ?? null;
  const currentCheckIn = state ? getCurrentCheckIn(state.dailyCheckins) : null;
  const currentRating = state?.ratingHistory.at(-1);
  const recentMatches = state?.matches.slice(0, 3) ?? [];
  const todayRecScore = currentRating?.recScore ?? state?.dupr.doublesRating ?? state?.dupr.singlesRating ?? 3.5;

  return {
    loading,
    mode,
    state,
    opponents,
    currentReadiness,
    currentCheckIn,
    currentRating,
    recentMatches,
    todayRecScore,
    authBusy,
    syncing,
    error,
    firebaseReady: firebaseConfigured,
    whoopConnectionAvailable: mode === "demo" || (mode === "live" && liveWhoopConnectionAvailable),
    saveMatch,
    saveMorningCheckIn,
    deleteMatch: deleteExistingMatch,
    completeOnboarding,
    reopenOnboarding,
    toggleWhoopConnection,
    toggleNotifications,
    resetDemoData,
    enterDemoMode,
    exitDemoMode,
    signInWithGoogle: signInWithGoogleAccount,
    submitEmailAuth,
    signOutFromApp
  };
};
