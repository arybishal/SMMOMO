import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { IconArrowRight } from "@/components/layout/icons";

const steps = [
  {
    title: "Comment",
    detail: "A follower comments a keyword on your post or reel.",
  },
  {
    title: "Match",
    detail: "SMMOMO matches the keyword to your automation instantly.",
  },
  {
    title: "DM",
    detail: "Your predefined private message lands in their DMs.",
  },
];

const features = [
  {
    title: "Comment-to-DM automations",
    detail:
      "Define a keyword and a message once. Every matching comment gets an instant private reply.",
  },
  {
    title: "Optional public reply",
    detail:
      "Confirm in the comments too — “Sent! Check your DMs.” — so everyone sees you respond.",
  },
  {
    title: "Delivery you can trust",
    detail:
      "Every send is queued, retried, and recorded. Failures are visible, never silent.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-600 text-xs font-bold text-white">
            S
          </span>
          <span className="text-sm font-semibold tracking-tight text-zinc-900">
            SMMOMO
          </span>
        </div>
        <nav className="flex items-center gap-2 sm:gap-4">
          <Link
            href="/login"
            className="text-sm font-medium text-zinc-600 hover:text-zinc-900"
          >
            Sign in
          </Link>
          <Link href="/register" className={buttonClasses("primary")}>
            Get started
          </Link>
        </nav>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-3xl px-6 pb-20 pt-16 text-center sm:pt-24">
          <p className="text-sm font-medium text-indigo-600">
            Instagram Comment → Private DM
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl">
            Turn comments into conversations
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-zinc-500">
            SMMOMO replies to Instagram comments with an automated private
            message — links, PDFs, resources — the moment someone uses your
            keyword.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link href="/register" className={buttonClasses("primary")}>
              Start free
              <IconArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/login" className={buttonClasses("secondary")}>
              Sign in
            </Link>
          </div>

          {/* How it works */}
          <div className="mt-16 grid gap-4 sm:grid-cols-3">
            {steps.map((s, i) => (
              <div
                key={s.title}
                className="rounded-lg border border-zinc-200 bg-zinc-50 p-5 text-left"
              >
                <span className="text-xs font-semibold text-indigo-600">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="mt-2 text-sm font-semibold text-zinc-900">
                  {s.title}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-zinc-500">
                  {s.detail}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="border-t border-zinc-100 bg-zinc-50">
          <div className="mx-auto grid max-w-5xl gap-8 px-6 py-16 sm:grid-cols-3">
            {features.map((f) => (
              <div key={f.title}>
                <h3 className="text-sm font-semibold text-zinc-900">
                  {f.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                  {f.detail}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-3xl px-6 py-16 text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Set up your first automation in minutes
          </h2>
          <div className="mt-6">
            <Link href="/register" className={buttonClasses("primary")}>
              Create your account
              <IconArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-100 py-8">
        <p className="text-center text-xs text-zinc-400">
          © 2026 SMMOMO. Instagram automation, done right.
        </p>
      </footer>
    </div>
  );
}
