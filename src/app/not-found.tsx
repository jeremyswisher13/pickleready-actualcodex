import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="min-h-screen bg-hero px-4 py-6 text-ink">
      <div className="mx-auto max-w-[430px] rounded-[34px] border border-border bg-surface/95 px-5 py-6 shadow-card backdrop-blur-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-500">Not found</p>
        <h1 className="mt-2 text-[2rem] font-bold tracking-[-0.06em]">That page is out of bounds.</h1>
        <p className="mt-3 text-sm leading-7 text-muted">
          The link may be old, or the page may have moved while the app was updated.
        </p>
        <Link
          className="mt-6 inline-flex rounded-[22px] bg-cta px-4 py-3 text-sm font-semibold text-white shadow-glow"
          href="/"
        >
          Return home
        </Link>
      </div>
    </main>
  );
}
