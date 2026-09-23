import type { ReactNode } from "react";

// Public tone API preserved from Task 002 — pages keep passing these names.
// Visuals come from design-system tokens: soft background + strong text +
// base color at 20% via the /20 opacity modifier (ring-{status}/20).
type Tone = "success" | "paused" | "draft" | "failed" | "neutral" | "info";

const tones: Record<Tone, string> = {
  success: "bg-success-soft text-success-strong ring-success/20",
  paused: "bg-warning-soft text-warning-strong ring-warning/20",
  draft: "bg-neutral-soft text-neutral-strong ring-neutral/20",
  failed: "bg-danger-soft text-danger-strong ring-danger/20",
  neutral: "bg-neutral-soft text-neutral-strong ring-neutral/20",
  info: "bg-info-soft text-info-strong ring-info/20",
};

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-pill px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
