import Link from "next/link";

const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-hero px-4 py-6 text-ink">
      <div className="mx-auto max-w-[430px] space-y-5">
        <div className="rounded-[34px] border border-border bg-surface/95 px-5 py-6 shadow-card backdrop-blur-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-500">About PickleReady</p>
          <h1 className="mt-2 text-[2rem] font-bold tracking-[-0.06em]">A clearer answer for every day on court.</h1>
          <p className="mt-3 text-sm leading-7 text-muted">
            PickleReady combines recovery, recent results, and matchup context to help players understand whether a rough session came from fatigue, rhythm, or the opponent across the net.
          </p>
        </div>

        <section className="rounded-[28px] border border-border bg-surface/95 px-5 py-5 shadow-card backdrop-blur-sm">
          <h2 className="text-lg font-semibold tracking-tight">How it works</h2>
          <div className="mt-4 space-y-4 text-sm leading-7 text-muted">
            <p>
              The readiness score blends physical input, recent competitive form, and activity rhythm into one daily score with a confidence label.
            </p>
            <p>
              The rec score is an internal ladder rating that moves after every logged match using opponent strength, match margin, verification, and match type.
            </p>
            <p>
              If you do not wear Whoop, Morning Check-In gives PickleReady a device-free fatigue signal so the app still has real context for the day.
            </p>
          </div>
        </section>

        <section className="rounded-[28px] border border-border bg-surface/95 px-5 py-5 shadow-card backdrop-blur-sm">
          <h2 className="text-lg font-semibold tracking-tight">Data sources</h2>
          <div className="mt-4 space-y-4 text-sm leading-7 text-muted">
            <p>Whoop contributes recovery, HRV, resting heart rate, sleep, and strain when connected.</p>
            <p>DUPR provides your rating baseline and rating trend when linked or manually anchored.</p>
            <p>In-app match logging adds the context that most wearable-only products miss: who you played, how close it was, and how you typically perform in that matchup.</p>
          </div>
        </section>

        {supportEmail ? (
          <section className="rounded-[28px] border border-border bg-surface/95 px-5 py-5 shadow-card backdrop-blur-sm">
            <h2 className="text-lg font-semibold tracking-tight">Support</h2>
            <p className="mt-3 text-sm leading-7 text-muted">
              Questions, data corrections, or account issues can be sent to{" "}
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
          <Link className="font-semibold text-blue-600" href="/privacy">
            Privacy
          </Link>
        </div>
      </div>
    </main>
  );
}
