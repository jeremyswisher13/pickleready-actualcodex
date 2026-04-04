import { logger } from "firebase-functions";

const WHOOP_BASE = "https://api.prod.whoop.com/developer";
const WHOOP_AUTH_BASE = "https://api.prod.whoop.com/oauth/oauth2";
const DUPR_BASE = "https://api.dupr.gg";

interface WhoopAuthResult {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}): ${await response.text()}`);
  }

  return (await response.json()) as T;
}

export async function withBackoff<T>(label: string, task: () => Promise<T>, attempts = 4): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      logger.warn(`${label} failed`, { attempt, error: error instanceof Error ? error.message : String(error) });

      if (attempt < attempts) {
        await sleep(350 * 2 ** (attempt - 1) + Math.floor(Math.random() * 100));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function refreshWhoopAccessToken(refreshToken: string) {
  const clientId = process.env.WHOOP_CLIENT_ID;
  const clientSecret = process.env.WHOOP_CLIENT_SECRET;
  const redirectUri = process.env.WHOOP_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Missing WHOOP OAuth environment variables.");
  }

  return withBackoff("refreshWhoopAccessToken", async () => {
    const response = await fetch(`${WHOOP_AUTH_BASE}/token`, {
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        scope: "offline"
      }),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      method: "POST"
    });

    return parseJson<WhoopAuthResult>(response);
  });
}

export async function exchangeWhoopAuthorizationCode(code: string) {
  const clientId = process.env.WHOOP_CLIENT_ID;
  const clientSecret = process.env.WHOOP_CLIENT_SECRET;
  const redirectUri = process.env.WHOOP_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Missing WHOOP OAuth environment variables.");
  }

  return withBackoff("exchangeWhoopAuthorizationCode", async () => {
    const response = await fetch(`${WHOOP_AUTH_BASE}/token`, {
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri
      }),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      method: "POST"
    });

    return parseJson<WhoopAuthResult>(response);
  });
}

export async function revokeWhoopAccess(accessToken: string) {
  return withBackoff("revokeWhoopAccess", async () => {
    const response = await fetch(`${WHOOP_BASE}/v2/user/access`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      method: "DELETE"
    });

    if (!response.ok && response.status !== 204) {
      throw new Error(`Request failed (${response.status}): ${await response.text()}`);
    }
  });
}

export async function fetchWhoopSnapshot(accessToken: string) {
  const headers = {
    Authorization: `Bearer ${accessToken}`
  };

  const [recovery, cycle, sleepData, profile] = await Promise.all([
    withBackoff("whoopRecovery", async () => {
      const response = await fetch(`${WHOOP_BASE}/v2/recovery`, { headers });
      return parseJson<{ records: Array<Record<string, unknown>> }>(response);
    }),
    withBackoff("whoopCycle", async () => {
      const response = await fetch(`${WHOOP_BASE}/v2/cycle`, { headers });
      return parseJson<{ records: Array<Record<string, unknown>> }>(response);
    }),
    withBackoff("whoopSleep", async () => {
      const response = await fetch(`${WHOOP_BASE}/v2/sleep`, { headers });
      return parseJson<{ records: Array<Record<string, unknown>> }>(response);
    }),
    withBackoff("whoopProfile", async () => {
      const response = await fetch(`${WHOOP_BASE}/v2/user/profile/basic`, { headers });
      return parseJson<Record<string, unknown>>(response);
    })
  ]);

  return {
    recovery: recovery.records[0] ?? null,
    cycle: cycle.records[0] ?? null,
    sleep: sleepData.records[0] ?? null,
    profile
  };
}

export async function fetchDuprReadOnlyToken() {
  const email = process.env.DUPR_EMAIL;
  const password = process.env.DUPR_PASSWORD;

  if (!email || !password) {
    throw new Error("Missing DUPR credential environment variables.");
  }

  return withBackoff("fetchDuprReadOnlyToken", async () => {
    const response = await fetch(`${DUPR_BASE}/auth/v1.0/login-read-only-token`, {
      body: JSON.stringify({ email, password }),
      headers: {
        "Content-Type": "application/json"
      },
      method: "POST"
    });

    return parseJson<{ token: string }>(response);
  });
}

export async function fetchDuprPlayer(token: string, playerId: string) {
  return withBackoff("fetchDuprPlayer", async () => {
    const response = await fetch(`${DUPR_BASE}/player/v1.0/${playerId}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    return parseJson<Record<string, unknown>>(response);
  });
}

export async function fetchDuprStats(token: string, playerId: string) {
  return withBackoff("fetchDuprStats", async () => {
    const response = await fetch(`${DUPR_BASE}/player/v1.0/stats/${playerId}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    return parseJson<Record<string, unknown>>(response);
  });
}
