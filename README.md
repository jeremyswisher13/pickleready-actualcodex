# PickleReady

PickleReady is a mobile-first pickleball performance app built with Next.js, TypeScript, Tailwind CSS, Firebase, and Cloud Functions. It combines:

- Daily readiness scoring from Whoop or Morning Check-In
- DUPR baseline context
- In-app match logging
- An Elo-style internal rec score
- Deterministic post-match insights that answer: "Was it fatigue, or was it the matchup?"

Live site: [https://swisher-pickleready-codex.web.app](https://swisher-pickleready-codex.web.app)

## Stack

- Next.js App Router
- React + TypeScript
- Tailwind CSS
- Firebase Auth
- Firestore
- Firebase Hosting
- Firebase Cloud Functions
- Recharts

## Local setup

1. Install dependencies:

```bash
npm install
cd functions && npm install
```

2. Create local env files:

```bash
cp .env.example .env.local
cp functions/.env.example functions/.env.local
```

3. Fill in the Firebase web config in `.env.local`.

4. Fill in the server-only credentials in `functions/.env.local`:

- `WHOOP_CLIENT_ID`
- `WHOOP_CLIENT_SECRET`
- `WHOOP_REDIRECT_URI`
- `DUPR_EMAIL`
- `DUPR_PASSWORD`
- `TOKEN_ENCRYPTION_KEY`

5. Run the app:

```bash
npm run dev
```

## Scripts

```bash
npm run dev
npm run lint
npm test
npm run build
cd functions && npm run build
```

## Deploy

Hosting and Firestore:

```bash
firebase deploy --only hosting,firestore --project swisher-pickleready-codex
```

Functions:

```bash
firebase deploy --only functions --project swisher-pickleready-codex
```

## Production notes

- Derived readiness and rec-score documents are server-managed.
- Firestore rules restrict users to their own account data.
- Whoop tokens are stored server-side and encrypted before persistence.
- Morning Check-In is the current live fallback for non-Whoop users.

## Suggested collaboration workflow

- Protect `golden` as the production branch.
- Use a separate `dev` branch for staging and shared integration work.
- Create short-lived feature branches off `dev`.
- Point the production Hosting target at `golden` and a dev Hosting target at `dev`.
- Keep Cloud Functions and env secrets managed outside the repo.

## Current operational blocker

Cloud Functions deployment requires the Firebase project `swisher-pickleready-codex` to be on the Blaze plan. Until that upgrade happens, Hosting and Firestore can deploy, but the live scheduled/backend sync pipeline cannot be published.
