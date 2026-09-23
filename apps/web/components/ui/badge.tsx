import type { ReactNode } from "react";

type Tone = "success" | "paused" | "draft" | "failed" | "neutral" | "info";

const tones: Record<Tone, string> = {
  success: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  paused: "bg-amber-50 text-amber-700 ring-amber-600/20",
  draft: "bg-zinc-100 text-zinc-600 ring-zinc-500/20",
  failed: "bg-red-50 text-red-700 ring-red-600/20",
  neutral: "bg-zinc-100 text-zinc-700 ring-zinc-500/20",
  info: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
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
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
