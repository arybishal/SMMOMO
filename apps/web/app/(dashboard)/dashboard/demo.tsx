"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";

// Task 027 — interactive "How SMMOMO works" (spec §12–§17). Every value in
// this file is demo content: no data-layer imports, no fetch, no records —
// the harness statically asserts it stays that way (spec §44).

const STEPS = [
  { key: "01", tab: "Comment" },
  { key: "02", tab: "Match" },
  { key: "03", tab: "DM" },
  { key: "04", tab: "Result" },
] as const;

const TRY_STAGES = [
  "Comment received",
  "Keyword matched",
  "Automation triggered",
  "DM sent",
];

export default function Demo() {
  const [step, setStep] = useState(0);
  const [comment, setComment] = useState("SALE");
  const [stage, setStage] = useState(0);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((t) => clearTimeout(t)), []);

  function runDemo() {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current = [];
    setStage(0);
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setStage(TRY_STAGES.length);
      return;
    }
    TRY_STAGES.forEach((_, i) => {
      timers.current.push(window.setTimeout(() => setStage(i + 1), (i + 1) * 700));
    });
  }

  return (
    <Card className="mt-6 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>See how SMMOMO works</CardTitle>
        <Badge tone="info">Interactive demo</Badge>
      </div>

      {/* Step tabs */}
      <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Demo steps">
        {STEPS.map((s, i) => (
          <button
            key={s.key}
            type="button"
            role="tab"
            aria-selected={step === i}
            aria-current={step === i ? "step" : undefined}
            onClick={() => setStep(i)}
            className={`rounded-control border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
              step === i
                ? "border-primary bg-primary-soft text-primary-strong"
                : "border-border-muted bg-surface text-muted-foreground hover:text-foreground"
            }`}
          >
            <span aria-hidden="true" className="mr-1.5 tabular-nums opacity-70">
              {s.key}
            </span>
            {s.tab}
          </button>
        ))}
      </div>

      {/* Step panel — demo content only */}
      <div className="mt-4 min-h-[13rem] rounded-control border border-border-muted bg-surface-muted/50 p-4">
        {step === 0 && (
          <div className="space-y-3">
            <div className="max-w-sm rounded-control border border-border-muted bg-surface p-3 shadow-xs">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="flex h-7 w-7 items-center justify-center rounded-pill bg-gradient-to-br from-fuchsia-500 to-amber-400 text-xs font-bold text-white"
                >
                  S
                </span>
                <span className="text-sm font-semibold text-foreground">Summer Sale</span>
              </div>
              <div className="mt-3 rounded-control bg-surface-muted px-3 py-2">
                <span className="text-sm font-medium text-foreground">Sarah</span>{" "}
                <span className="text-sm text-foreground">SALE</span>
              </div>
            </div>
            <p className="text-sm font-medium text-foreground">New comment detected</p>
            <p className="text-xs text-subtle-foreground">
              Simulated Instagram comment — demo content only.
            </p>
          </div>
        )}

        {step === 1 && (
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Comment received</dt>
              <dd className="font-medium text-foreground">“SALE”</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Keyword</dt>
              <dd>
                <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-medium text-zinc-700">
                  SALE
                </code>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Automation</dt>
              <dd className="font-medium text-foreground">Summer Sale Campaign</dd>
            </div>
            <p className="pt-1 text-sm font-medium text-success-strong">✓ Match detected</p>
          </dl>
        )}

        {step === 2 && (
          <div className="max-w-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Private DM
            </p>
            <div className="mt-2 rounded-control rounded-tl-none bg-primary-soft px-4 py-3">
              <p className="text-sm text-foreground">
                Hi Sarah,
                <br />
                Thanks for your interest. Here&apos;s the information you requested.
              </p>
            </div>
            <p className="mt-2 text-sm font-medium text-success-strong">Message sent ✓</p>
          </div>
        )}

        {step === 3 && (
          <div>
            <p className="text-sm font-semibold text-foreground">Automation completed</p>
            <dl className="mt-3 grid max-w-md grid-cols-3 gap-3 text-center">
              <div className="rounded-control border border-border-muted bg-surface p-3">
                <dd className="text-xl font-semibold tabular-nums text-foreground">128</dd>
                <dt className="mt-1 text-xs text-muted-foreground">Comments matched</dt>
              </div>
              <div className="rounded-control border border-border-muted bg-surface p-3">
                <dd className="text-xl font-semibold tabular-nums text-foreground">117</dd>
                <dt className="mt-1 text-xs text-muted-foreground">Private DMs sent</dt>
              </div>
              <div className="rounded-control border border-border-muted bg-surface p-3">
                <dd className="text-xl font-semibold tabular-nums text-danger">2</dd>
                <dt className="mt-1 text-xs text-muted-foreground">Failed</dt>
              </div>
            </dl>
            <p className="mt-3 text-xs text-subtle-foreground">
              Demo data — example numbers, not real activity.
            </p>
            <Link
              href="/automations/new"
              className={`${buttonClasses("primary")} mt-4 inline-flex`}
            >
              Create your first automation
            </Link>
          </div>
        )}
      </div>

      {/* Step nav */}
      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className={`${buttonClasses("secondary")} disabled:cursor-not-allowed disabled:opacity-50`}
        >
          ← Previous
        </button>
        <span className="text-xs text-subtle-foreground" aria-live="polite">
          Step {step + 1} of {STEPS.length}
        </span>
        <button
          type="button"
          onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
          disabled={step === STEPS.length - 1}
          className={`${buttonClasses("secondary")} disabled:cursor-not-allowed disabled:opacity-50`}
        >
          Next →
        </button>
      </div>

      {/* Try the demo — pure local animation (spec §17) */}
      <div className="mt-5 border-t border-border-muted pt-4">
        <p className="text-sm font-semibold text-foreground">Try the demo</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label htmlFor="demo-comment" className="sr-only">
            Write a sample comment
          </label>
          <input
            id="demo-comment"
            type="text"
            value={comment}
            maxLength={120}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Write a sample comment"
            className="h-10 w-56 rounded-control border border-input bg-surface px-3 text-sm text-foreground placeholder:text-subtle-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          />
          <button type="button" onClick={runDemo} className={buttonClasses("primary")}>
            Run demo
          </button>
        </div>
        {stage > 0 && (
          <ol className="mt-3 space-y-1.5" aria-live="polite">
            {TRY_STAGES.map((label, i) => (
              <li
                key={label}
                className={`flex items-center gap-2 text-sm transition-opacity duration-300 ${
                  stage > i ? "opacity-100" : "opacity-0"
                }`}
              >
                <span aria-hidden="true" className="text-success-strong">
                  ✓
                </span>
                <span className="text-foreground">{label}</span>
                {i === 0 && comment.trim() !== "" && (
                  <span className="text-muted-foreground">— “{comment.trim()}”</span>
                )}
              </li>
            ))}
          </ol>
        )}
        <p className="mt-2 text-xs text-subtle-foreground">
          Local only — nothing is sent and no records are created.
        </p>
      </div>
    </Card>
  );
}
