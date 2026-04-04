# PickleReady Launch Checklist

This is the exact production checklist for publishing the live backend, Whoop OAuth, and final polish for `swisher-pickleready-codex`.

## 1. Upgrade Firebase To Blaze

You need Blaze before Cloud Functions can deploy.

- Open the Firebase project billing page:
  [https://console.firebase.google.com/project/swisher-pickleready-codex/usage/details](https://console.firebase.google.com/project/swisher-pickleready-codex/usage/details)
- Upgrade the project to the Blaze plan.
- Wait until Google Cloud billing is fully active for the project.

## 2. Confirm Firebase Auth Setup

In Firebase Console:

- Go to `Authentication` -> `Sign-in method`
- Enable `Email/Password`
- Enable `Google`
- If you plan to use a custom domain, add it under `Authentication` -> `Settings` -> `Authorized domains`

## 3. Decide The Production App URL

Pick one canonical app URL and use it everywhere:

- Current default: `https://swisher-pickleready-codex.web.app`
- Optional custom domain: your branded domain once connected in Firebase Hosting

Use the same canonical URL for:

- `NEXT_PUBLIC_APP_URL`
- `APP_URL`
- Whoop app website / redirect settings
- Metadata and privacy/support links

## 4. Configure The Web App Env

Copy the example if needed:

```bash
cp .env.example .env.local
```

Fill in:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPPORT_EMAIL`
- `NEXT_PUBLIC_WHOOP_OAUTH_ENABLED=false`

Leave `NEXT_PUBLIC_WHOOP_OAUTH_ENABLED=false` until Functions are deployed successfully.

## 5. Configure The Functions Env

For deployed Functions, Firebase loads `functions/.env` or `functions/.env.<project-or-alias>`.
`functions/.env.local` is for the local emulator only.

Copy the example:

```bash
cp functions/.env.example functions/.env
```

Fill in:

- `APP_URL`
- `WHOOP_CLIENT_ID`
- `WHOOP_CLIENT_SECRET`
- `WHOOP_REDIRECT_URI`
- `DUPR_EMAIL`
- `DUPR_PASSWORD`
- `TOKEN_ENCRYPTION_KEY`

Generate a stable encryption key once:

```bash
openssl rand -hex 32
```

Important:

- Do not rotate `TOKEN_ENCRYPTION_KEY` casually, or existing encrypted Whoop tokens will stop decrypting.
- `WHOOP_REDIRECT_URI` must exactly match the value registered in the Whoop developer console.

## 6. Configure The Whoop Developer App

In the Whoop developer dashboard:

- Create or update your app
- Set the app website to your production app URL
- Set the privacy policy URL to your public privacy page:
  `https://swisher-pickleready-codex.web.app/privacy`
  or your custom domain equivalent
- Use this redirect URI unless you change region or project:
  `https://us-central1-swisher-pickleready-codex.cloudfunctions.net/whoopOAuthCallback`

Scopes used by PickleReady:

- `offline`
- `read:recovery`
- `read:cycles`
- `read:sleep`
- `read:workout`
- `read:profile`
- `read:body_measurement`

Notes:

- The redirect URI must match exactly.
- The app will stay limited until Whoop approves it for broader use.
- If you later move the function to another region, update the redirect URI in both places.

## 7. Build And Deploy Functions First

From the repo root:

```bash
cd functions && npm run build
cd ..
firebase deploy --only functions --project swisher-pickleready-codex
```

After deploy:

- Confirm `whoopOAuthCallback` deployed successfully
- Confirm callable functions deployed successfully:
  - `createWhoopConnectUrl`
  - `disconnectWhoop`
  - `calculateReadinessNow`

## 8. Turn On The Live Whoop Button

Only after Functions are live:

- Set `NEXT_PUBLIC_WHOOP_OAUTH_ENABLED=true` in `.env.local`
- Rebuild the web app
- Redeploy Hosting

```bash
npm run build
firebase deploy --only hosting,firestore --project swisher-pickleready-codex
```

## 9. Production Smoke Test

Run this end-to-end on desktop and phone:

1. Create an account with email/password
2. Sign out and sign back in
3. Sign in with Google
4. Complete onboarding
5. Submit a Morning Check-In
6. Log a match
7. Edit the match
8. Delete a match
9. Confirm readiness/rating history persists after refresh
10. Connect Whoop
11. Confirm return from OAuth lands back in the app
12. Confirm readiness updates after Whoop connection
13. Disconnect Whoop
14. Confirm the app falls back cleanly to Morning Check-In mode

## 10. Nice-To-Have Before Broader Sharing

- Add a custom domain in Firebase Hosting
- Add your real support email to `NEXT_PUBLIC_SUPPORT_EMAIL`
- Create a separate Firebase Hosting site for `dev`
- Protect `golden` in GitHub
- Add your collaborator to the repo

## Current Truth

The codebase is ready for this final activation sequence, but the live backend does not become fully real until:

1. Blaze is enabled
2. Functions envs are filled in
3. Functions deploy successfully
4. The Whoop public flag is turned on and Hosting is redeployed
