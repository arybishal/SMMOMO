// Task 024: derived first-run / onboarding state — pure functions so the
// validation harness can assert every branch without rendering React.
// Inputs are counts the dashboard already loads; nothing is fetched here.

export type OnboardingStep =
  | "connect"
  | "reconnect"
  | "import"
  | "create"
  | "activate"
  | "waiting"
  | "live";

export interface OnboardingInput {
  account: "connected" | "error" | "none";
  postCount: number;
  automationCount: number;
  activeCount: number;
  hasActivity: boolean;
}

/** Linear funnel: connection → content → automation → activity. */
export function onboardingStep(input: OnboardingInput): OnboardingStep {
  if (input.account === "none") return "connect";
  if (input.account === "error") return "reconnect";
  if (input.postCount === 0) return "import";
  if (input.automationCount === 0) return "create";
  if (input.activeCount === 0) return "activate";
  if (!input.hasActivity) return "waiting";
  return "live";
}

export type SetupState = "done" | "current" | "pending";

export interface SetupItem {
  key: "connect" | "import" | "create" | "activate";
  label: string;
  href: string;
  state: SetupState;
}

const ORDER: SetupItem["key"][] = ["connect", "import", "create", "activate"];

const LABELS: Record<SetupItem["key"], [string, string]> = {
  // [normal, reconnect wording]
  connect: ["Connect Instagram", "Reconnect Instagram"],
  import: ["Import posts", "Import posts"],
  create: ["Create an automation", "Create an automation"],
  activate: ["Activate automation", "Activate automation"],
};

const HREFS: Record<SetupItem["key"], string> = {
  connect: "/settings/social-accounts",
  import: "/posts",
  create: "/automations/new",
  activate: "/automations",
};

/** Checklist with done/current/pending per step; `waiting`/`live` → all done. */
export function setupChecklist(step: OnboardingStep): SetupItem[] {
  const currentKey: SetupItem["key"] | null =
    step === "connect" || step === "reconnect"
      ? "connect"
      : step === "import"
        ? "import"
        : step === "create"
          ? "create"
          : step === "activate"
            ? "activate"
            : null;
  const currentIdx = currentKey ? ORDER.indexOf(currentKey) : ORDER.length;
  const reconnect = step === "reconnect";
  return ORDER.map((key, i) => ({
    key,
    label: reconnect && key === "connect" ? LABELS[key][1] : LABELS[key][0],
    href: HREFS[key],
    state:
      i < currentIdx ? "done" : i === currentIdx ? "current" : "pending",
  }));
}
