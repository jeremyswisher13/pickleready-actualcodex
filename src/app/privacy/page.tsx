import Link from "next/link";

const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-hero px-4 py-6 text-ink">
      <div className="mx-auto max-w-[430px] space-y-5">
        <div className="rounded-[34px] border border-border bg-surface/95 px-5 py-6 shadow-card backdrop-blur-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-500">Privacy</p>
          <h1 className="mt-2 text-[2rem] font-bold tracking-[-0.06em]">Your training data stays personal.</h1>
          <p className="mt-3 text-sm leading-7 text-muted">
            PickleReady is designed so each user can only access their own documents, and third-party wearable tokens stay server-side.
          </p>
        </div>

        <section className="rounded-[28px] border border-border bg-surface/95 px-5 py-5 shadow-card backdrop-blur-sm">
          <h2 className="text-lg font-semibold tracking-tight">What we store</h2>
          <div className="mt-4 space-y-4 text-sm leading-7 text-muted">
            <p>Profile basics such as name, email, photo, and linked DUPR identifiers.</p>
            <p>Match logs, opponent summaries, Morning Check-Ins, readiness history, and rec-score history tied to your account.</p>
            <p>When Whoop is connected, access and refresh tokens are kept on the server and encrypted before storage.</p>
          </div>
        </section>

        <section className="rounded-[28px] border border-border bg-surface/95 px-5 py-5 shadow-card backdrop-blur-sm">
          <h2 className="text-lg font-semibold tracking-tight">How data is used</h2>
          <div className="mt-4 space-y-4 text-sm leading-7 text-muted">
            <p>Your data is used to calculate readiness, explain score changes, and improve matchup context inside your own account.</p>
            <p>PickleReady does not expose your private score history or connected-account credentials to other users.</p>
            <p>Optional match verification only shares the minimum context needed to confirm a logged result.</p>
          </div>
        </section>

        {supportEmail ? (
          <section className="rounded-[28px] border border-border bg-surface/95 px-5 py-5 shadow-card backdrop-blur-sm">
            <h2 className="text-lg font-semibold tracking-tight">Privacy requests</h2>
            <p className="mt-3 text-sm leading-7 text-muted">
              For account, correction, or deletion requests, contact{" "}
              <a className="font-semibold text-blue-600" href={`mailto:${supportEmail}`}>
                {supportEmail}
              </a>
              .
            </p>
          </section>
        ) : null}

        <div className="flex items-center justify-between rounded-[24px] border border-blue-100 bg-white/90 px-4 py-4 text-sm text-muted shadow-card">
          <Link className="font-semibold text-blue-600" href="/">
            Back to app
          </Link>
          <Link className="font-semibold text-blue-600" href="/about">
            About
          </Link>
        </div>
      </div>
    </main>
  );
}
