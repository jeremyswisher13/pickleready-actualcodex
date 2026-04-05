import { randomBytes } from "node:crypto";

import { initializeApp } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { FieldValue, Timestamp, WriteBatch, getFirestore } from "firebase-admin/firestore";
import { onDocumentCreated, onDocumentWritten } from "firebase-functions/v2/firestore";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { onSchedule } from "firebase-functions/v2/scheduler";

import { generatePostMatchInsight as buildPostMatchInsight } from "../../shared/domain/insight";
import { calculateReadinessScore as calculateReadinessScoreDomain } from "../../shared/domain/readiness";
import { replayRecRatings } from "../../shared/domain/rec-score";
import type { DailyCheckIn, DuprSnapshot, MatchRecord, RatingEntry, ReadinessScore } from "../../shared/domain/types";
import { dateKeyInTimeZone, isoDateKey } from "../../shared/domain/utils";

import { decryptSecret, encryptSecret } from "./lib/crypto";
import {
  exchangeWhoopAuthorizationCode,
  fetchDuprPlayer,
  fetchDuprReadOnlyToken,
  fetchDuprStats,
  fetchWhoopSnapshot,
  hasDuprCredentials,
  refreshWhoopAccessToken,
  revokeWhoopAccess
} from "./lib/external";

initializeApp();

const adminAuth = getAdminAuth();
const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });
const WHOOP_OAUTH_SCOPES = [
  "offline",
  "read:recovery",
  "read:cycles",
  "read:sleep",
  "read:workout",
  "read:profile",
  "read:body_measurement"
] as const;
const WHOOP_STATE_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

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

const asString = (value: unknown) => (typeof value === "string" ? value : "");

const createWhoopOAuthState = () =>
  Array.from(randomBytes(8), (value) => WHOOP_STATE_CHARSET[value % WHOOP_STATE_CHARSET.length]).join("");

const getBearerToken = (headerValue: unknown) => {
  const header = typeof headerValue === "string" ? headerValue : Array.isArray(headerValue) ? headerValue[0] : "";

  if (!header.startsWith("Bearer ")) {
    return "";
  }

  return header.slice("Bearer ".length).trim();
};

const getConfiguredAppUrl = () =>
  process.env.APP_URL ??
  process.env.NEXT_PUBLIC_APP_URL ??
  (process.env.GCLOUD_PROJECT ? `https://${process.env.GCLOUD_PROJECT}.web.app` : "http://localhost:3000");

const parseUrl = (value: string) => {
  try {
    return new URL(value);
  } catch {
    return null;
  }
};

const normalizeOrigin = (value: unknown) => {
  const candidate = typeof value === "string" ? value : Array.isArray(value) ? value[0] : "";
  const parsed = parseUrl(candidate);
  return parsed?.origin ?? "";
};

const resolveContinueUrl = (candidate: unknown, originHeader: unknown) => {
  const fallbackUrl = getConfiguredAppUrl();
  const fallback = parseUrl(fallbackUrl);
  const fallbackOrigin = fallback?.origin ?? "";
  const origin = normalizeOrigin(originHeader);
  const allowedOrigins = new Set([fallbackOrigin, origin].filter(Boolean));
  const requested = parseUrl(asString(candidate));

  if (requested && allowedOrigins.has(requested.origin)) {
    return requested.toString();
  }

  if (fallback) {
    return fallback.toString();
  }

  return origin || "http://localhost:3000";
};

const buildWhoopRedirectUrl = (target: string, status: "connected" | "error", message?: string) => {
  const fallbackUrl = getConfiguredAppUrl();
  const url = parseUrl(target) ?? parseUrl(fallbackUrl) ?? new URL("http://localhost:3000");

  url.searchParams.set("whoop", status);
  if (message) {
    url.searchParams.set("whoopMessage", message.slice(0, 140));
  }

  return url.toString();
};

const getNested = (value: unknown, path: string[]): unknown =>
  path.reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object") {
      return undefined;
    }

    return (current as Record<string, unknown>)[key];
  }, value);

const firstNumber = (...values: unknown[]) =>
  values.map(asNumber).find((value): value is number => typeof value === "number");

const toIsoString = (value: unknown) => {
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

const getProfileTimeZone = (profile: Record<string, unknown>) =>
  typeof profile.timeZone === "string" && profile.timeZone.length > 0 ? profile.timeZone : "UTC";

const getHourInTimeZone = (date: Date, timeZone: string) => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    hour12: false
  });

  return Number(formatter.formatToParts(date).find((part) => part.type === "hour")?.value ?? "0");
};

const sortMatchesChronologically = (matches: MatchRecord[]) =>
  [...matches].sort((left, right) => {
    const leftTime = new Date(left.date).getTime();
    const rightTime = new Date(right.date).getTime();

    if (leftTime !== rightTime) {
      return leftTime - rightTime;
    }

    return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
  });

const toMatchRecord = (id: string, payload: Record<string, unknown>): MatchRecord => ({
  id,
  date: toIsoString(payload.date),
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
  readinessAtTime: typeof payload.readinessAtTime === "number" ? payload.readinessAtTime : 65,
  postMatchInsight: typeof payload.postMatchInsight === "string" ? payload.postMatchInsight : "",
  createdAt: toIsoString(payload.createdAt),
  opponentAverageRating:
    typeof payload.opponentAverageRating === "number" ? payload.opponentAverageRating : undefined,
  recScoreDelta: typeof payload.recScoreDelta === "number" ? payload.recScoreDelta : undefined,
  recScoreAfter: typeof payload.recScoreAfter === "number" ? payload.recScoreAfter : undefined
});

const toDailyCheckIn = (id: string, payload: Record<string, unknown>): DailyCheckIn => ({
  dateString: typeof payload.dateString === "string" ? payload.dateString : id,
  submittedAt: toIsoString(payload.submittedAt),
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
  painAreas: Array.isArray(payload.painAreas)
    ? payload.painAreas.filter((entry): entry is string => typeof entry === "string")
    : [],
  note: typeof payload.note === "string" ? payload.note : "",
  physicalEstimate: asNumber(payload.physicalEstimate) ?? 65,
  confidence: "medium"
});

const toReadinessRecord = (id: string, payload: Record<string, unknown>): ReadinessScore => {
  const overall = asNumber(payload.overall) ?? 65;

  return {
    dateString: typeof payload.dateString === "string" ? payload.dateString : id,
    overall,
    physical: asNumber(payload.physical) ?? overall,
    performance: asNumber(payload.performance) ?? overall,
    activity: asNumber(payload.activity) ?? overall,
    whoopData:
      payload.whoopData && typeof payload.whoopData === "object"
        ? (payload.whoopData as ReadinessScore["whoopData"])
        : {},
    checkInData:
      payload.checkInData && typeof payload.checkInData === "object"
        ? (payload.checkInData as ReadinessScore["checkInData"])
        : undefined,
    duprData:
      payload.duprData && typeof payload.duprData === "object"
        ? (payload.duprData as ReadinessScore["duprData"])
        : {},
    matchData:
      payload.matchData && typeof payload.matchData === "object"
        ? (payload.matchData as ReadinessScore["matchData"])
        : {
            recentMatchCount: 0,
            recentWinRate: 0,
            daysSinceLastMatch: null,
            avgMargin: 0
          },
    changeExplanations: Array.isArray(payload.changeExplanations)
      ? (payload.changeExplanations as ReadinessScore["changeExplanations"])
      : [],
    calculatedAt: toIsoString(payload.calculatedAt),
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
      payload.physicalSource === "whoop" ||
      payload.physicalSource === "checkin" ||
      payload.physicalSource === "fallback"
        ? payload.physicalSource
        : "fallback"
  };
};

const buildReadinessStub = (score: number, dateString: string): ReadinessScore => ({
  dateString: isoDateKey(dateString),
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
  calculatedAt: dateString,
  label: score >= 80 ? "Go compete" : score >= 60 ? "Good for rec" : score >= 40 ? "Light session" : "Rest day",
  confidence: "low",
  physicalSource: "fallback"
});

const toDuprSnapshot = (rootData: Record<string, unknown>): DuprSnapshot => {
  const payload =
    rootData.duprSnapshot && typeof rootData.duprSnapshot === "object"
      ? (rootData.duprSnapshot as Record<string, unknown>)
      : {};

  return {
    singlesRating: asNumber(payload.singlesRating),
    doublesRating: asNumber(payload.doublesRating),
    ratingTrend14d: asNumber(payload.ratingTrend14d)
  };
};

const getRecScoreAnchor = async (userId: string, rootData: Record<string, unknown>) => {
  const metaSnapshot = await db.doc(`users/${userId}/privateCache/recScoreMeta`).get();
  const storedAnchor = asNumber(metaSnapshot.data()?.anchor);

  if (typeof storedAnchor === "number") {
    return storedAnchor;
  }

  const duprSnapshot = toDuprSnapshot(rootData);
  return duprSnapshot.doublesRating ?? duprSnapshot.singlesRating ?? 3.5;
};

const toWhoopMetrics = (payload: Record<string, unknown> | null) =>
  payload && typeof payload.recoveryScore === "number"
    ? {
        recoveryScore: payload.recoveryScore as number,
        hrvRmssd: (payload.hrvRmssd as number) ?? 50,
        restingHeartRate: (payload.restingHeartRate as number) ?? 55,
        sleepPerformance: (payload.sleepPerformance as number) ?? 80,
        sleepDurationMs: (payload.sleepDurationMs as number) ?? 25_200_000,
        strain: (payload.strain as number) ?? 10,
        cycleId: String(payload.cycleId ?? "cached")
      }
    : undefined;

const toWhoopBaseline = (payload: Record<string, unknown> | null) =>
  payload && typeof payload.avgRecovery7d === "number"
    ? {
        avgHrvRmssd7d: (payload.avgHrvRmssd7d as number) ?? 50,
        avgRestingHeartRate7d: (payload.avgRestingHeartRate7d as number) ?? 55,
        avgStrain7d: (payload.avgStrain7d as number) ?? 10,
        avgSleepDurationMs7d: (payload.avgSleepDurationMs7d as number) ?? 25_200_000,
        avgRecovery7d: payload.avgRecovery7d as number,
        weeklyActivityScore: (payload.weeklyActivityScore as number) ?? 75,
        observedDays: (payload.observedDays as number) ?? 0
      }
    : undefined;

const getWhoopUserId = (profile: Record<string, unknown> | null) =>
  String(getNested(profile, ["user_id"]) ?? getNested(profile, ["id"]) ?? "");

const toWhoopCacheDocument = (snapshot: Awaited<ReturnType<typeof fetchWhoopSnapshot>>) => {
  const recovery = snapshot.recovery;
  const cycle = snapshot.cycle;
  const sleep = snapshot.sleep;

  return {
    recoveryScore:
      firstNumber(
        getNested(recovery, ["score", "recovery_score"]),
        getNested(recovery, ["score", "score"]),
        getNested(recovery, ["recovery_score"])
      ) ?? 65,
    hrvRmssd:
      firstNumber(
        getNested(recovery, ["score", "hrv_rmssd_milli"]),
        getNested(recovery, ["score", "hrv_rmssd_ms"]),
        getNested(recovery, ["score", "hrv_rmssd"])
      ) ?? 55,
    restingHeartRate:
      firstNumber(getNested(recovery, ["score", "resting_heart_rate"]), getNested(recovery, ["resting_heart_rate"])) ??
      54,
    sleepPerformance:
      firstNumber(
        getNested(sleep, ["score", "sleep_performance_percentage"]),
        getNested(sleep, ["sleep_performance_percentage"])
      ) ?? 82,
    sleepDurationMs:
      firstNumber(
        getNested(sleep, ["score", "stage_summary", "total_in_bed_time_milli"]),
        getNested(sleep, ["sleep_duration_ms"])
      ) ?? 25_200_000,
    strain: firstNumber(getNested(cycle, ["score", "strain"]), getNested(cycle, ["strain"])) ?? 10,
    cycleId: String(getNested(cycle, ["id"]) ?? getNested(cycle, ["cycle_id"]) ?? "whoop-cycle"),
    avgHrvRmssd7d:
      firstNumber(
        getNested(recovery, ["score", "hrv_rmssd_milli"]),
        getNested(recovery, ["score", "hrv_rmssd_ms"]),
        getNested(recovery, ["score", "hrv_rmssd"])
      ) ?? 55,
    avgRestingHeartRate7d:
      firstNumber(getNested(recovery, ["score", "resting_heart_rate"]), getNested(recovery, ["resting_heart_rate"])) ??
      54,
    avgStrain7d: firstNumber(getNested(cycle, ["score", "strain"]), getNested(cycle, ["strain"])) ?? 10,
    avgSleepDurationMs7d:
      firstNumber(
        getNested(sleep, ["score", "stage_summary", "total_in_bed_time_milli"]),
        getNested(sleep, ["sleep_duration_ms"])
      ) ?? 25_200_000,
    avgRecovery7d:
      firstNumber(
        getNested(recovery, ["score", "recovery_score"]),
        getNested(recovery, ["score", "score"]),
        getNested(recovery, ["recovery_score"])
      ) ?? 65,
    weeklyActivityScore: 78,
    observedDays: 7,
    latestSnapshot: snapshot,
    latestSyncedAt: FieldValue.serverTimestamp()
  };
};

const toReadinessDupr = (privateSnapshot: Record<string, unknown> | null, rootData: Record<string, unknown>) => {
  if (privateSnapshot && (typeof privateSnapshot.doublesRating === "number" || typeof privateSnapshot.singlesRating === "number")) {
    return {
      singlesRating: privateSnapshot.singlesRating as number | undefined,
      doublesRating: privateSnapshot.doublesRating as number | undefined,
      ratingTrend14d: privateSnapshot.ratingTrend14d as number | undefined
    };
  }

  const fallback = toDuprSnapshot(rootData);
  return fallback.singlesRating || fallback.doublesRating || fallback.ratingTrend14d ? fallback : undefined;
};

const toStoredReadiness = (readiness: ReadinessScore) => ({
  ...readiness,
  calculatedAt: Timestamp.fromDate(new Date(readiness.calculatedAt))
});

const toStoredRating = (entry: RatingEntry) => ({
  ...entry,
  updatedAt: Timestamp.fromDate(new Date(entry.updatedAt))
});

const collapseRatingsByDate = (entries: RatingEntry[]) => {
  const byDate = new Map<string, RatingEntry>();

  entries.forEach((entry) => {
    byDate.set(entry.dateString, entry);
  });

  return [...byDate.values()].sort((left, right) => {
    if (left.dateString !== right.dateString) {
      return left.dateString.localeCompare(right.dateString);
    }

    return new Date(left.updatedAt).getTime() - new Date(right.updatedAt).getTime();
  });
};

const toComparableMatchInput = (match: MatchRecord | null) =>
  JSON.stringify(
    match
      ? {
          date: match.date,
          matchType: match.matchType,
          category: match.category,
          format: match.format,
          environment: match.environment,
          genderFormat: match.genderFormat,
          opponents: match.opponents,
          partner: match.partner,
          games: match.games,
          result: match.result,
          notes: match.notes,
          verified: match.verified,
          verifiedBy: match.verifiedBy,
          readinessAtTime: match.readinessAtTime,
          createdAt: match.createdAt,
          opponentAverageRating: match.opponentAverageRating
        }
      : null
  );

const commitOperationsInChunks = async (operations: Array<(batch: WriteBatch) => void>) => {
  if (operations.length === 0) {
    return;
  }

  let batch = db.batch();
  let count = 0;

  for (const operation of operations) {
    if (count === 400) {
      await batch.commit();
      batch = db.batch();
      count = 0;
    }

    operation(batch);
    count += 1;
  }

  if (count > 0) {
    await batch.commit();
  }
};

const loadMatches = async (userId: string) => {
  const matchesSnapshot = await db.collection(`users/${userId}/matches`).get();
  return sortMatchesChronologically(matchesSnapshot.docs.map((doc) => toMatchRecord(doc.id, doc.data())));
};

const buildReadinessForUser = async (
  userId: string,
  rootData: Record<string, unknown>,
  profile: Record<string, unknown>,
  now = new Date()
) => {
  const profileTimeZone = getProfileTimeZone(profile);
  const localDateKey = dateKeyInTimeZone(now, profileTimeZone);
  const matches = await loadMatches(userId);
  const checkInSnapshot = await db.doc(`users/${userId}/dailyCheckins/${localDateKey}`).get();
  const privateWhoopDoc = await db.doc(`users/${userId}/privateCache/whoopLatest`).get();
  const latestWhoop = privateWhoopDoc.exists ? (privateWhoopDoc.data() as Record<string, unknown>) : null;
  const privateDuprDoc = await db.doc(`users/${userId}/privateCache/duprLatest`).get();
  const latestDupr = privateDuprDoc.exists ? (privateDuprDoc.data() as Record<string, unknown>) : null;

  return calculateReadinessScoreDomain({
    dateString: localDateKey,
    calculatedAt: now.toISOString(),
    userTimeZone: profileTimeZone,
    whoop: toWhoopMetrics(latestWhoop),
    baseline: toWhoopBaseline(latestWhoop),
    dupr: toReadinessDupr(latestDupr, rootData),
    checkIn: checkInSnapshot.exists
      ? toDailyCheckIn(checkInSnapshot.id, checkInSnapshot.data() as Record<string, unknown>)
      : undefined,
    matches,
    userCreatedAt: toIsoString(profile.createdAt)
  });
};

const syncMatchDerivedStateForUser = async (userId: string, rootData: Record<string, unknown>) => {
  const profile =
    rootData.profile && typeof rootData.profile === "object"
      ? (rootData.profile as Record<string, unknown>)
      : rootData;
  const profileTimeZone = getProfileTimeZone(profile);
  const matches = await loadMatches(userId);
  const duprSnapshot = toDuprSnapshot(rootData);
  const startingRating = await getRecScoreAnchor(userId, rootData);
  const replay = replayRecRatings(matches, startingRating, {
    singles: duprSnapshot.singlesRating,
    doubles: duprSnapshot.doublesRating
  }, profileTimeZone);
  const readinessSnapshot = await db.collection(`users/${userId}/readinessScores`).get();
  const readinessByDate = new Map(
    readinessSnapshot.docs.map((doc) => [doc.id, toReadinessRecord(doc.id, doc.data() as Record<string, unknown>)])
  );

  let previousRec = startingRating;
  const enrichedMatches = matches.map((match, index) => {
    const update = replay.updates.get(match.id);
    const recScoreAfter = update?.newRating ?? previousRec;
    const previousMatchesAgainstOpponent = matches.slice(0, index).filter((candidate) =>
      candidate.opponents.some((opponent) => match.opponents.some((target) => target.name === opponent.name))
    );
    const readiness =
      readinessByDate.get(dateKeyInTimeZone(match.date, profileTimeZone)) ??
      buildReadinessStub(match.readinessAtTime, match.date);
    const postMatchInsight = buildPostMatchInsight({
      match: {
        ...match,
        recScoreAfter
      },
      readiness,
      previousRecScore: previousRec,
      newRecScore: recScoreAfter,
      opponentRating: match.opponentAverageRating,
      h2hMatchesBefore: previousMatchesAgainstOpponent.length,
      h2hWinsBefore: previousMatchesAgainstOpponent.filter((candidate) => candidate.result === "win").length,
      h2hLossesBefore: previousMatchesAgainstOpponent.filter((candidate) => candidate.result === "loss").length
    });

    previousRec = recScoreAfter;

    return {
      ...match,
      recScoreDelta: update?.delta ?? 0,
      recScoreAfter,
      postMatchInsight
    };
  });

  const existingRatingsSnapshot = await db.collection(`users/${userId}/ratings`).get();
  const recalculatedAt = new Date().toISOString();
  const ratingEntries = collapseRatingsByDate(
    replay.entries.map((entry) => ({
      ...entry,
      updatedAt: recalculatedAt
    }))
  );
  const operations: Array<(batch: WriteBatch) => void> = [
    (batch) =>
      batch.set(
        db.doc(`users/${userId}/privateCache/recScoreMeta`),
        {
          anchor: startingRating,
          updatedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      )
  ];

  existingRatingsSnapshot.docs.forEach((doc) => {
    operations.push((batch) => batch.delete(doc.ref));
  });

  ratingEntries.forEach((entry) => {
    operations.push((batch) =>
      batch.set(docRef(`users/${userId}/ratings/${entry.dateString}`), toStoredRating(entry), { merge: true })
    );
  });

  enrichedMatches.forEach((match) => {
    operations.push((batch) =>
      batch.set(
        docRef(`users/${userId}/matches/${match.id}`),
        {
          recScoreDelta: match.recScoreDelta,
          recScoreAfter: match.recScoreAfter,
          postMatchInsight: match.postMatchInsight
        },
        { merge: true }
      )
    );
  });

  await commitOperationsInChunks(operations);

  if (profile && typeof profile === "object") {
    const readiness = await buildReadinessForUser(userId, rootData, profile);
    await db.doc(`users/${userId}/readinessScores/${readiness.dateString}`).set(toStoredReadiness(readiness), { merge: true });
  }
};

const docRef = (path: string) => db.doc(path);

const getWhoopOAuthConfig = () => {
  const clientId = process.env.WHOOP_CLIENT_ID;
  const redirectUri = process.env.WHOOP_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    throw new HttpsError("failed-precondition", "WHOOP OAuth is not configured for this environment yet.");
  }

  return { clientId, redirectUri };
};

const buildWhoopAuthorizationUrl = (state: string) => {
  const { clientId, redirectUri } = getWhoopOAuthConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: WHOOP_OAUTH_SCOPES.join(" "),
    state
  });

  return `https://api.prod.whoop.com/oauth/oauth2/auth?${params.toString()}`;
};

const persistWhoopOAuthState = async (userId: string, continueUrl: string) => {
  const state = createWhoopOAuthState();
  const now = Date.now();

  await db.doc(`oauthStates/${state}`).set({
    continueUrl,
    createdAt: Timestamp.fromMillis(now),
    expiresAt: Timestamp.fromMillis(now + 15 * 60 * 1000),
    provider: "whoop",
    userId
  });

  return state;
};

const refreshReadinessForUser = async (
  userId: string,
  rootData: Record<string, unknown>,
  profile: Record<string, unknown>,
  now = new Date()
) => {
  const readiness = await buildReadinessForUser(userId, rootData, profile, now);
  await db.doc(`users/${userId}/readinessScores/${readiness.dateString}`).set(toStoredReadiness(readiness), { merge: true });
  return readiness;
};

const persistWhoopConnection = async (
  userId: string,
  rootData: Record<string, unknown>,
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    scope: string;
  },
  snapshot: Awaited<ReturnType<typeof fetchWhoopSnapshot>> | null
) => {
  const rootProfile =
    rootData.profile && typeof rootData.profile === "object"
      ? (rootData.profile as Record<string, unknown>)
      : rootData;
  const whoopUserId = snapshot ? getWhoopUserId(snapshot.profile) : asString(rootProfile.whoopUserId);
  const nextProfile = {
    ...rootProfile,
    whoopConnected: true,
    whoopUserId,
    updatedAt: new Date().toISOString()
  };
  const nextRootData =
    rootData.profile && typeof rootData.profile === "object"
      ? {
          ...rootData,
          profile: nextProfile
        }
      : nextProfile;

  const writes = [
    db.doc(`users/${userId}/connectedAccounts/whoop`).set(
      {
        accessToken: encryptSecret(tokens.accessToken),
        refreshToken: encryptSecret(tokens.refreshToken),
        expiresAt: Timestamp.fromMillis(Date.now() + tokens.expiresIn * 1000),
        scopes: tokens.scope.split(" ").filter(Boolean)
      },
      { merge: true }
    ),
    db.doc(`users/${userId}`).set(
      {
        profile: {
          whoopConnected: true,
          whoopUserId
        }
      },
      { merge: true }
    )
  ];

  if (snapshot) {
    writes.push(db.doc(`users/${userId}/privateCache/whoopLatest`).set(toWhoopCacheDocument(snapshot), { merge: true }));
  }

  await Promise.all(writes);

  if (nextProfile && typeof nextProfile === "object") {
    await refreshReadinessForUser(userId, nextRootData, nextProfile);
  }
};

const clearWhoopConnection = async (userId: string, rootData: Record<string, unknown>) => {
  const rootProfile =
    rootData.profile && typeof rootData.profile === "object"
      ? (rootData.profile as Record<string, unknown>)
      : rootData;
  const nextProfile = {
    ...rootProfile,
    whoopConnected: false,
    whoopUserId: "",
    updatedAt: new Date().toISOString()
  };
  const nextRootData =
    rootData.profile && typeof rootData.profile === "object"
      ? {
          ...rootData,
          profile: nextProfile
        }
      : nextProfile;

  await Promise.all([
    db.doc(`users/${userId}/connectedAccounts/whoop`).delete().catch(() => undefined),
    db.doc(`users/${userId}/privateCache/whoopLatest`).delete().catch(() => undefined),
    db.doc(`users/${userId}`).set(
      {
        profile: {
          whoopConnected: false,
          whoopUserId: ""
        }
      },
      { merge: true }
    )
  ]);

  if (nextProfile && typeof nextProfile === "object") {
    await refreshReadinessForUser(userId, nextRootData, nextProfile);
  }
};

const ensureWhoopTokenSet = (
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    scope: string;
  },
  context: string
) => {
  if (!tokens.accessToken || !tokens.refreshToken || !tokens.expiresIn) {
    throw new Error(`${context} did not return a complete Whoop token set.`);
  }
};

export const createWhoopConnectUrl = onCall({ invoker: "public" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }

  const continueUrl = resolveContinueUrl(
    (request.data as Record<string, unknown> | null)?.continueUrl,
    request.rawRequest.headers.origin
  );
  const state = await persistWhoopOAuthState(request.auth.uid, continueUrl);

  return {
    url: buildWhoopAuthorizationUrl(state)
  };
});

export const createWhoopConnectSession = onRequest({ cors: true, invoker: "public" }, async (request, response) => {
  if (request.method !== "POST") {
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  const idToken = getBearerToken(request.headers.authorization);
  if (!idToken) {
    response.status(401).json({ error: "Missing Firebase ID token." });
    return;
  }

  let decodedToken;

  try {
    decodedToken = await adminAuth.verifyIdToken(idToken);
  } catch {
    response.status(401).json({ error: "Invalid Firebase ID token." });
    return;
  }

  const requestBody =
    request.body && typeof request.body === "object" ? (request.body as Record<string, unknown>) : {};
  const continueUrl = resolveContinueUrl(requestBody.continueUrl, request.headers.origin);
  const state = await persistWhoopOAuthState(decodedToken.uid, continueUrl);

  response.status(200).json({
    url: buildWhoopAuthorizationUrl(state)
  });
});

export const disconnectWhoop = onCall({ invoker: "public" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }

  const userId = request.auth.uid;
  const [userDoc, whoopDoc] = await Promise.all([
    db.doc(`users/${userId}`).get(),
    db.doc(`users/${userId}/connectedAccounts/whoop`).get()
  ]);
  const rootData = (userDoc.data() ?? {}) as Record<string, unknown>;

  if (whoopDoc.exists) {
    const payload = whoopDoc.data() as Record<string, unknown>;
    const encryptedAccessToken = asString(payload.accessToken);
    const encryptedRefreshToken = asString(payload.refreshToken);

    try {
      if (encryptedAccessToken) {
        await revokeWhoopAccess(decryptSecret(encryptedAccessToken));
      } else if (encryptedRefreshToken) {
        const refreshed = await refreshWhoopAccessToken(decryptSecret(encryptedRefreshToken));
        await revokeWhoopAccess(refreshed.access_token);
      }
    } catch (error) {
      if (encryptedRefreshToken) {
        try {
          const refreshed = await refreshWhoopAccessToken(decryptSecret(encryptedRefreshToken));
          await revokeWhoopAccess(refreshed.access_token);
        } catch (refreshError) {
          logger.warn("disconnectWhoop revoke failed after refresh", {
            error: refreshError instanceof Error ? refreshError.message : String(refreshError),
            userId
          });
        }
      } else {
        logger.warn("disconnectWhoop revoke failed", {
          error: error instanceof Error ? error.message : String(error),
          userId
        });
      }
    }
  }

  await clearWhoopConnection(userId, rootData);

  return { disconnected: true };
});

export const whoopOAuthCallback = onRequest(async (request, response) => {
  const state = asString(request.query.state);
  const code = asString(request.query.code);
  const oauthError = asString(request.query.error);
  const oauthErrorDescription = asString(request.query.error_description);
  const fallbackContinueUrl = resolveContinueUrl(undefined, request.headers.origin);

  if (!state) {
    response.redirect(303, buildWhoopRedirectUrl(fallbackContinueUrl, "error", "Missing Whoop state."));
    return;
  }

  const stateRef = db.doc(`oauthStates/${state}`);
  const stateSnapshot = await stateRef.get();

  if (!stateSnapshot.exists) {
    response.redirect(303, buildWhoopRedirectUrl(fallbackContinueUrl, "error", "That Whoop session expired. Start again."));
    return;
  }

  const oauthState = stateSnapshot.data() as Record<string, unknown>;
  const continueUrl = resolveContinueUrl(oauthState.continueUrl, request.headers.origin);
  const expiresAt = oauthState.expiresAt instanceof Timestamp ? oauthState.expiresAt.toMillis() : 0;

  if (oauthState.provider !== "whoop" || !oauthState.userId || (expiresAt && expiresAt < Date.now())) {
    await stateRef.delete().catch(() => undefined);
    response.redirect(303, buildWhoopRedirectUrl(continueUrl, "error", "That Whoop session expired. Start again."));
    return;
  }

  if (oauthError) {
    await stateRef.delete().catch(() => undefined);
    const message = oauthErrorDescription || oauthError.replace(/_/g, " ");
    response.redirect(303, buildWhoopRedirectUrl(continueUrl, "error", message));
    return;
  }

  if (!code) {
    await stateRef.delete().catch(() => undefined);
    response.redirect(303, buildWhoopRedirectUrl(continueUrl, "error", "Whoop did not return an authorization code."));
    return;
  }

  try {
    const userId = asString(oauthState.userId);
    const userDoc = await db.doc(`users/${userId}`).get();
    const rootData = (userDoc.data() ?? {}) as Record<string, unknown>;
    const tokenSet = await exchangeWhoopAuthorizationCode(code);
    ensureWhoopTokenSet(
      {
        accessToken: tokenSet.access_token,
        refreshToken: tokenSet.refresh_token,
        expiresIn: tokenSet.expires_in,
        scope: tokenSet.scope
      },
      "Whoop OAuth"
    );
    let snapshot: Awaited<ReturnType<typeof fetchWhoopSnapshot>> | null = null;

    try {
      snapshot = await fetchWhoopSnapshot(tokenSet.access_token);
    } catch (error) {
      logger.warn("whoopOAuthCallback snapshot fetch failed", {
        error: error instanceof Error ? error.message : String(error),
        userId
      });
    }

    await persistWhoopConnection(
      userId,
      rootData,
      {
        accessToken: tokenSet.access_token,
        refreshToken: tokenSet.refresh_token,
        expiresIn: tokenSet.expires_in,
        scope: tokenSet.scope
      },
      snapshot
    );
    await stateRef.delete().catch(() => undefined);

    response.redirect(303, buildWhoopRedirectUrl(continueUrl, "connected"));
  } catch (error) {
    logger.error("whoopOAuthCallback failed", {
      error: error instanceof Error ? error.message : String(error),
      state
    });
    await stateRef.delete().catch(() => undefined);
    response.redirect(303, buildWhoopRedirectUrl(continueUrl, "error", "Whoop connection failed. Please try again."));
  }
});

export const calculateReadinessScore = onSchedule(
  {
    schedule: "0 * * * *",
    timeZone: "Etc/UTC"
  },
  async () => {
    const now = new Date();
    const userSnapshots = await db.collection("users").get();

    await Promise.all(
      userSnapshots.docs.map(async (userDoc) => {
        try {
          const rootData = userDoc.data();
          const profile =
            rootData.profile && typeof rootData.profile === "object"
              ? (rootData.profile as Record<string, unknown>)
              : rootData;

          if (!profile || typeof profile !== "object") {
            return;
          }

          const profileTimeZone = getProfileTimeZone(profile);
          if (getHourInTimeZone(now, profileTimeZone) !== 6) {
            return;
          }

          const readinessDateKey = dateKeyInTimeZone(now, profileTimeZone);
          const existingReadiness = await db.doc(`users/${userDoc.id}/readinessScores/${readinessDateKey}`).get();
          if (existingReadiness.exists) {
            return;
          }

          const readiness = await buildReadinessForUser(userDoc.id, rootData, profile, now);
          await db.doc(`users/${userDoc.id}/readinessScores/${readiness.dateString}`).set(toStoredReadiness(readiness), {
            merge: true
          });
        } catch (error) {
          logger.error("calculateReadinessScore failed for user", {
            error: error instanceof Error ? error.message : String(error),
            userId: userDoc.id
          });
        }
      })
    );
  }
);

export const syncWhoopData = onSchedule(
  {
    schedule: "every 2 hours",
    timeZone: "Etc/UTC"
  },
  async () => {
    const userSnapshots = await db.collection("users").where("profile.whoopConnected", "==", true).get();

    await Promise.all(
      userSnapshots.docs.map(async (userDoc) => {
        const userId = userDoc.id;
        const rootData = userDoc.data();

        try {
          const whoopDocRef = db.doc(`users/${userId}/connectedAccounts/whoop`);
          const whoopDoc = await whoopDocRef.get();

          if (!whoopDoc.exists) {
            await clearWhoopConnection(userId, rootData);
            return;
          }

          const payload = whoopDoc.data() as Record<string, unknown>;
          const refreshed = await refreshWhoopAccessToken(decryptSecret(String(payload.refreshToken ?? "")));
          ensureWhoopTokenSet(
            {
              accessToken: refreshed.access_token,
              refreshToken: refreshed.refresh_token,
              expiresIn: refreshed.expires_in,
              scope: refreshed.scope
            },
            "Whoop refresh"
          );
          const snapshot = await fetchWhoopSnapshot(refreshed.access_token);
          await persistWhoopConnection(
            userId,
            rootData,
            {
              accessToken: refreshed.access_token,
              refreshToken: refreshed.refresh_token,
              expiresIn: refreshed.expires_in,
              scope: refreshed.scope
            },
            snapshot
          );
        } catch (error) {
          logger.error("syncWhoopData failed for user", {
            error: error instanceof Error ? error.message : String(error),
            userId
          });
        }
      })
    );
  }
);

export const syncDuprData = onSchedule(
  {
    schedule: "0 4 * * *",
    timeZone: "Etc/UTC"
  },
  async () => {
    if (!hasDuprCredentials()) {
      logger.warn("syncDuprData skipped because DUPR credentials are not configured.");
      return;
    }

    const token = await fetchDuprReadOnlyToken();
    const userSnapshots = await db.collection("users").get();

    await Promise.all(
      userSnapshots.docs.map(async (userDoc) => {
        try {
          const rootData = userDoc.data();
          const profile =
            rootData.profile && typeof rootData.profile === "object"
              ? (rootData.profile as Record<string, unknown>)
              : rootData;
          const playerId = profile.duprPlayerId as string | undefined;

          if (!playerId) {
            return;
          }

          const [player, stats] = await Promise.all([
            fetchDuprPlayer(token.token, playerId),
            fetchDuprStats(token.token, playerId)
          ]);

          const duprSnapshot = {
            singlesRating:
              firstNumber(
                getNested(player, ["singles", "rating"]),
                getNested(stats, ["singles", "rating"]),
                getNested(player, ["singlesRating"])
              ) ?? null,
            doublesRating:
              firstNumber(
                getNested(player, ["doubles", "rating"]),
                getNested(stats, ["doubles", "rating"]),
                getNested(player, ["doublesRating"])
              ) ?? null,
            ratingTrend14d:
              firstNumber(
                getNested(stats, ["trend14d"]),
                getNested(stats, ["ratingTrend14d"]),
                getNested(player, ["ratingTrend14d"])
              ) ?? 0
          };

          await Promise.all([
            db.doc(`users/${userDoc.id}/privateCache/duprLatest`).set(
              {
                ...duprSnapshot,
                player,
                stats,
                latestSyncedAt: FieldValue.serverTimestamp()
              },
              { merge: true }
            ),
            db.doc(`users/${userDoc.id}`).set(
              {
                duprSnapshot
              },
              { merge: true }
            )
          ]);

          const readiness = await buildReadinessForUser(userDoc.id, { ...rootData, duprSnapshot }, profile);
          await db.doc(`users/${userDoc.id}/readinessScores/${readiness.dateString}`).set(toStoredReadiness(readiness), {
            merge: true
          });
        } catch (error) {
          logger.error("syncDuprData failed for user", {
            error: error instanceof Error ? error.message : String(error),
            userId: userDoc.id
          });
        }
      })
    );
  }
);

export const syncMatchDerivedData = onDocumentWritten("users/{userId}/matches/{matchId}", async (event) => {
  const beforeSnapshot = event.data?.before;
  const afterSnapshot = event.data?.after;
  const beforeMatch =
    beforeSnapshot && beforeSnapshot.exists
      ? toMatchRecord(beforeSnapshot.id, beforeSnapshot.data() as Record<string, unknown>)
      : null;
  const afterMatch =
    afterSnapshot && afterSnapshot.exists
      ? toMatchRecord(afterSnapshot.id, afterSnapshot.data() as Record<string, unknown>)
      : null;

  if (beforeMatch && afterMatch && toComparableMatchInput(beforeMatch) === toComparableMatchInput(afterMatch)) {
    return;
  }

  const userDoc = await db.doc(`users/${event.params.userId}`).get();
  await syncMatchDerivedStateForUser(event.params.userId, userDoc.data() ?? {});
});

export const sendVerificationRequest = onDocumentCreated("users/{userId}/matches/{matchId}", async (event) => {
  const snapshot = event.data;

  if (!snapshot) {
    return;
  }

  const match = toMatchRecord(snapshot.id, snapshot.data());

  await Promise.all(
    match.opponents
      .filter((opponent) => opponent.userId)
      .map((opponent) =>
        db.doc(`users/${opponent.userId}/notifications/${snapshot.id}`).set(
          {
            type: "match-verification",
            sourceUserId: event.params.userId,
            sourceMatchId: snapshot.id,
            message: `${match.notes || "A match was logged against you."}`,
            createdAt: FieldValue.serverTimestamp(),
            status: "pending"
          },
          { merge: true }
        )
      )
  );
});

export const syncReadinessOnCheckIn = onDocumentWritten("users/{userId}/dailyCheckins/{dateString}", async (event) => {
  const userDoc = await db.doc(`users/${event.params.userId}`).get();
  const rootData = userDoc.data();
  const profile =
    rootData?.profile && typeof rootData.profile === "object"
      ? (rootData.profile as Record<string, unknown>)
      : rootData;

  if (!profile) {
    return;
  }

  const readiness = await buildReadinessForUser(event.params.userId, rootData ?? {}, profile);
  await db.doc(`users/${event.params.userId}/readinessScores/${readiness.dateString}`).set(toStoredReadiness(readiness), {
    merge: true
  });
});

export const calculateReadinessNow = onCall({ invoker: "public" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }

  const userId = request.auth.uid;
  const userDoc = await db.doc(`users/${userId}`).get();
  const rootData = userDoc.data();
  const profile =
    rootData?.profile && typeof rootData.profile === "object"
      ? (rootData.profile as Record<string, unknown>)
      : rootData;

  if (!profile) {
    throw new HttpsError("not-found", "Profile not found.");
  }

  const readiness = await buildReadinessForUser(userId, rootData ?? {}, profile);
  await db.doc(`users/${userId}/readinessScores/${readiness.dateString}`).set(toStoredReadiness(readiness), {
    merge: true
  });

  return readiness;
});
