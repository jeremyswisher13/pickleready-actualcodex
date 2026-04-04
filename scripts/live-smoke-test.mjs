import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ENV_PATH = resolve(".env.local");
const PROJECT_REGION = "us-central1";
const FIRESTORE_BASE = (projectId) =>
  `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
const AUTH_BASE = "https://identitytoolkit.googleapis.com/v1";

const parseEnvFile = (filePath) => {
  const raw = readFileSync(filePath, "utf8");
  const env = {};

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    env[key] = value;
  }

  return env;
};

const env = parseEnvFile(ENV_PATH);
const apiKey = env.NEXT_PUBLIC_FIREBASE_API_KEY;
const projectId = env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const appUrl = env.NEXT_PUBLIC_APP_URL || `https://${projectId}.web.app`;
const whoopClientId = env.NEXT_PUBLIC_WHOOP_CLIENT_ID;

if (!apiKey || !projectId) {
  throw new Error("Missing NEXT_PUBLIC_FIREBASE_API_KEY or NEXT_PUBLIC_FIREBASE_PROJECT_ID in .env.local");
}

const projectNumber = "1001447168173";
const now = new Date();
const testId = `${Date.now()}-${randomUUID().slice(0, 8)}`;
const testEmail = `pickleready.smoke.${testId}@example.com`;
const testPassword = `Smoke!${testId.slice(-12)}`;
const testDisplayName = "PickleReady Smoke Test";
const testTimeZone = "America/Los_Angeles";
const todayDateString = new Intl.DateTimeFormat("en-CA", {
  timeZone: testTimeZone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
}).format(now);
const matchId = `smoke-match-${testId}`;
const opponentName = "Smoke Test Opponent";
const opponentDocId = opponentName.toLowerCase().replace(/\s+/g, "-");
const callableBase = `https://${PROJECT_REGION}-${projectId}.cloudfunctions.net`;
const whoopCallbackUrl = `${callableBase}/whoopOAuthCallback`;
const whoopRedirectUri = whoopCallbackUrl;
const whoopScopes = [
  "offline",
  "read:recovery",
  "read:cycles",
  "read:sleep",
  "read:workout",
  "read:profile",
  "read:body_measurement"
];
const whoopStateCharset = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

const delay = (ms) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms));

const toFirestoreValue = (value) => {
  if (value === null) {
    return { nullValue: null };
  }

  if (value instanceof Date) {
    return { timestampValue: value.toISOString() };
  }

  if (typeof value === "string") {
    return { stringValue: value };
  }

  if (typeof value === "boolean") {
    return { booleanValue: value };
  }

  if (typeof value === "number") {
    if (Number.isInteger(value)) {
      return { integerValue: String(value) };
    }

    return { doubleValue: value };
  }

  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map((entry) => toFirestoreValue(entry))
      }
    };
  }

  if (typeof value === "object") {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(value)
            .filter(([, entry]) => entry !== undefined)
            .map(([key, entry]) => [key, toFirestoreValue(entry)])
        )
      }
    };
  }

  throw new Error(`Unsupported Firestore value: ${String(value)}`);
};

const fromFirestoreValue = (value) => {
  if ("timestampValue" in value) {
    return value.timestampValue;
  }

  if ("stringValue" in value) {
    return value.stringValue;
  }

  if ("booleanValue" in value) {
    return value.booleanValue;
  }

  if ("integerValue" in value) {
    return Number(value.integerValue);
  }

  if ("doubleValue" in value) {
    return Number(value.doubleValue);
  }

  if ("nullValue" in value) {
    return null;
  }

  if ("arrayValue" in value) {
    return (value.arrayValue.values ?? []).map((entry) => fromFirestoreValue(entry));
  }

  if ("mapValue" in value) {
    return Object.fromEntries(
      Object.entries(value.mapValue.fields ?? {}).map(([key, entry]) => [key, fromFirestoreValue(entry)])
    );
  }

  return undefined;
};

const decodeFirestoreDocument = (document) =>
  Object.fromEntries(Object.entries(document.fields ?? {}).map(([key, value]) => [key, fromFirestoreValue(value)]));

const requestJson = async (url, { method = "GET", headers = {}, body, allowStatuses = [] } = {}) => {
  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  let json = null;

  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      if (!response.ok && !allowStatuses.includes(response.status)) {
        throw new Error(`${method} ${url} failed (${response.status}): ${text}`);
      }
    }
  }

  if (!response.ok && !allowStatuses.includes(response.status)) {
    throw new Error(`${method} ${url} failed (${response.status}): ${text}`);
  }

  return { response, json };
};

const requestText = async (url, { method = "GET", headers = {}, redirect = "follow" } = {}) => {
  const response = await fetch(url, {
    method,
    headers,
    redirect
  });
  const text = await response.text();
  return { response, text };
};

const createWhoopOAuthState = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(8)), (value) => whoopStateCharset[value % whoopStateCharset.length]).join("");

const buildWhoopAuthorizationUrl = (state) => {
  const params = new URLSearchParams({
    client_id: whoopClientId,
    redirect_uri: whoopRedirectUri,
    response_type: "code",
    scope: whoopScopes.join(" "),
    state
  });

  return `https://api.prod.whoop.com/oauth/oauth2/auth?${params.toString()}`;
};

const authRequest = (endpoint, payload) =>
  requestJson(`${AUTH_BASE}/${endpoint}?key=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: payload
  });

const firestoreHeaders = (idToken) => ({
  Authorization: `Bearer ${idToken}`,
  "Content-Type": "application/json"
});

const firestoreDocUrl = (path) => `${FIRESTORE_BASE(projectId)}/${path}`;

const patchDocument = async (path, data, idToken) =>
  requestJson(firestoreDocUrl(path), {
    method: "PATCH",
    headers: firestoreHeaders(idToken),
    body: {
      fields: Object.fromEntries(
        Object.entries(data)
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => [key, toFirestoreValue(value)])
      )
    }
  });

const createDocument = async (collectionPath, documentId, data, idToken) =>
  requestJson(`${FIRESTORE_BASE(projectId)}/${collectionPath}?documentId=${encodeURIComponent(documentId)}`, {
    method: "POST",
    headers: firestoreHeaders(idToken),
    body: {
      fields: Object.fromEntries(
        Object.entries(data)
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => [key, toFirestoreValue(value)])
      )
    }
  });

const getDocument = async (path, idToken) => {
  const { response, json } = await requestJson(firestoreDocUrl(path), {
    headers: {
      Authorization: `Bearer ${idToken}`
    },
    allowStatuses: [404]
  });

  if (response.status === 404) {
    return null;
  }

  return decodeFirestoreDocument(json);
};

const deleteDocument = async (path, idToken) =>
  requestText(firestoreDocUrl(path), {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${idToken}`
    }
  });

const callFunction = async (name, idToken, data) => {
  const { json } = await requestJson(`${callableBase}/${name}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json"
    },
    body: {
      data
    }
  });

  if (json?.error) {
    throw new Error(`${name} returned an error: ${JSON.stringify(json.error)}`);
  }

  return json?.result;
};

const expectPermissionDenied = async (path, data, idToken) => {
  try {
    await patchDocument(path, data, idToken);
    throw new Error(`Expected write to ${path} to be denied, but it succeeded.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (!message.includes("(403)") && !message.includes("PERMISSION_DENIED")) {
      throw error;
    }
  }
};

const pollFor = async (label, getter, predicate, timeoutMs = 45000) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const value = await getter();
    if (predicate(value)) {
      return value;
    }

    await delay(2000);
  }

  throw new Error(`Timed out waiting for ${label}.`);
};

const cleanupPaths = new Set();

const logStep = (message) => {
  console.log(`• ${message}`);
};

let deleteIdToken = null;

try {
  logStep(`Creating live auth user ${testEmail}`);
  const { json: signUp } = await authRequest("accounts:signUp", {
    email: testEmail,
    password: testPassword,
    returnSecureToken: true
  });

  const uid = signUp.localId;
  deleteIdToken = signUp.idToken;

  logStep("Verifying email/password sign-in works");
  const { json: signIn } = await authRequest("accounts:signInWithPassword", {
    email: testEmail,
    password: testPassword,
    returnSecureToken: true
  });

  if (signIn.localId !== uid) {
    throw new Error("Sign-in returned a different user id than sign-up.");
  }

  const idToken = signIn.idToken;
  deleteIdToken = idToken;

  logStep("Writing the initial live user document");
  await patchDocument(
    `users/${uid}`,
    {
      profile: {
        displayName: testDisplayName,
        email: testEmail,
        photoURL: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80",
        duprId: "",
        duprPlayerId: "",
        whoopConnected: false,
        whoopUserId: "",
        timeZone: testTimeZone,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      },
      preferences: {
        onboardingComplete: true,
        notificationsEnabled: true
      },
      duprSnapshot: {}
    },
    idToken
  );
  cleanupPaths.add(`users/${uid}`);

  logStep("Confirming server-managed ratings are protected by Firestore rules");
  await expectPermissionDenied(
    `users/${uid}/ratings/manual-write-test`,
    {
      dateString: todayDateString,
      recScore: 9.99,
      updatedAt: now.toISOString()
    },
    idToken
  );

  logStep("Saving a live Morning Check-In");
  await patchDocument(
    `users/${uid}/dailyCheckins/${todayDateString}`,
    {
      dateString: todayDateString,
      submittedAt: now.toISOString(),
      source: "manual",
      sleepHours: 7.5,
      sleepQuality: 4,
      energy: 4,
      soreness: 2,
      stress: 2,
      mentalSharpness: 4,
      illness: false,
      alcohol: false,
      travel: false,
      painAreas: [],
      note: "Automated live smoke test",
      physicalEstimate: 82,
      confidence: "medium"
    },
    idToken
  );
  cleanupPaths.add(`users/${uid}/dailyCheckins/${todayDateString}`);

  logStep("Calling calculateReadinessNow");
  const readiness = await callFunction("calculateReadinessNow", idToken, {});
  if (typeof readiness?.overall !== "number") {
    throw new Error("calculateReadinessNow did not return a numeric overall score.");
  }

  cleanupPaths.add(`users/${uid}/readinessScores/${readiness.dateString}`);

  logStep("Writing a live match document");
  await patchDocument(
    `users/${uid}/matches/${matchId}`,
    {
      id: matchId,
      date: now.toISOString(),
      createdAt: now.toISOString(),
      matchType: "singles",
      category: "rec",
      format: "standard",
      environment: "outdoor",
      genderFormat: "open",
      opponents: [
        {
          name: opponentName,
          rating: 4
        }
      ],
      games: [
        {
          myScore: 11,
          opponentScore: 8
        },
        {
          myScore: 11,
          opponentScore: 9
        }
      ],
      result: "win",
      notes: "Automated live smoke test match",
      verified: false,
      verifiedBy: [],
      readinessAtTime: readiness.overall,
      postMatchInsight: "",
      opponentAverageRating: 4
    },
    idToken
  );
  cleanupPaths.add(`users/${uid}/matches/${matchId}`);
  cleanupPaths.add(`users/${uid}/opponents/${opponentDocId}`);

  logStep("Waiting for rec score and insight generation");
  const enrichedMatch = await pollFor(
    "match enrichment",
    () => getDocument(`users/${uid}/matches/${matchId}`, idToken),
    (document) =>
      Boolean(
        document &&
          typeof document.recScoreAfter === "number" &&
          typeof document.recScoreDelta === "number" &&
          typeof document.postMatchInsight === "string" &&
          document.postMatchInsight.trim().length > 0
      )
  );

  const ratingDoc = await pollFor(
    "rating document",
    () => getDocument(`users/${uid}/ratings/${todayDateString}`, idToken),
    (document) => Boolean(document && typeof document.recScore === "number")
  );
  cleanupPaths.add(`users/${uid}/ratings/${todayDateString}`);

  let whoopAuthUrlVerified = false;
  if (whoopClientId) {
    logStep("Creating a temporary Whoop OAuth state");
    const oauthState = createWhoopOAuthState();
    const whoopStateCreatedAt = new Date();

    await createDocument(
      "oauthStates",
      oauthState,
      {
        continueUrl: appUrl,
        createdAt: whoopStateCreatedAt,
        expiresAt: new Date(whoopStateCreatedAt.getTime() + 15 * 60 * 1000),
        provider: "whoop",
        userId: uid
      },
      idToken
    );
    cleanupPaths.add(`oauthStates/${oauthState}`);

    const whoopConnect = buildWhoopAuthorizationUrl(oauthState);
    if (!whoopConnect.includes("api.prod.whoop.com/oauth/oauth2/auth")) {
      throw new Error("Whoop auth URL did not use the official Whoop OAuth endpoint.");
    }

    logStep("Cleaning up the temporary Whoop OAuth state through the callback");
    const callbackResponse = await requestText(
      `${whoopCallbackUrl}?state=${encodeURIComponent(oauthState)}&error=access_denied&error_description=smoke-test`,
      { redirect: "manual" }
    );

    if (callbackResponse.response.status !== 303) {
      throw new Error(`Expected Whoop callback cleanup redirect, got ${callbackResponse.response.status}.`);
    }

    whoopAuthUrlVerified = true;
  } else {
    logStep("Skipping Whoop connect verification because NEXT_PUBLIC_WHOOP_CLIENT_ID is not configured");
  }

  logStep("Verifying disconnectWhoop succeeds cleanly when nothing is connected");
  const disconnectResult = await callFunction("disconnectWhoop", idToken, {});
  if (!disconnectResult?.disconnected) {
    throw new Error("disconnectWhoop did not report success.");
  }

  console.log("");
  console.log("Live smoke test passed.");
  console.log(JSON.stringify(
    {
      uid,
      email: testEmail,
      readinessOverall: readiness.overall,
      recScore: ratingDoc.recScore,
      recScoreDelta: enrichedMatch.recScoreDelta,
      whoopAuthUrlVerified
    },
    null,
    2
  ));
} finally {
  try {
    if (deleteIdToken) {
      for (const path of [...cleanupPaths].reverse()) {
        try {
          await deleteDocument(path, deleteIdToken);
        } catch {
          // Best-effort cleanup.
        }
      }

      await authRequest("accounts:delete", {
        idToken: deleteIdToken
      });
    }
  } catch {
    // Best-effort cleanup.
  }
}
