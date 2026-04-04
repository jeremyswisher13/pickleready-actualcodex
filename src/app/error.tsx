"use client";

import Link from "next/link";

export default function ErrorPage({
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen bg-hero px-4 py-6 text-ink">
      <div className="mx-auto max-w-[430px] rounded-[34px] border border-border bg-surface/95 px-5 py-6 shadow-card backdrop-blur-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-500">Something broke</p>
        <h1 className="mt-2 text-[2rem] font-bold tracking-[-0.06em]">PickleReady hit a snag.</h1>
        <p className="mt-3 text-sm leading-7 text-muted">
          Try loading the view again. If the issue keeps happening, head back to the main dashboard and retry from there.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            className="rounded-[22px] bg-cta px-4 py-3 text-sm font-semibold text-white shadow-glow"
            onClick={reset}
            type="button"
          >
            Try again
          </button>
          <Link className="rounded-[22px] border border-blue-100 bg-white px-4 py-3 text-sm font-semibold text-ink" href="/">
            Back home
          </Link>
        </div>
      </div>
    </main>
  );
}
