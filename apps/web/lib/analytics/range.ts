// Task 027 — date-range resolution shared by Dashboard + Analytics.
// Pure and server-safe: presets resolve to [start, end) UTC instants computed
// from the viewer's timezone (profile timezone, else UTC). The API only ever
// receives validated instants + tz for bucket labeling.

export type RangePreset = "today" | "yesterday" | "7d" | "30d" | "90d" | "custom";

export const RANGE_PRESETS: { value: RangePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "custom", label: "Custom" },
];

const PRESET_LABEL: Record<RangePreset, string> = {
  today: "Today",
  yesterday: "Yesterday",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  custom: "Custom",
};

export const DEFAULT_PRESET: RangePreset = "30d";
const MAX_SPAN_MS = 366 * 86_400_000;
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export type RangeResult =
  | { ok: true; start: string; end: string; label: string; preset: RangePreset }
  | { ok: false; message: string };

function tzValid(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Profile timezone, or UTC when the stored value is not a valid IANA zone. */
export function usableTz(tz: string | null | undefined): string {
  return tz && tzValid(tz) ? tz : "UTC";
}

function tzOffsetMs(tz: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return asUtc - at.getTime();
}

/** UTC instant of local midnight for a "YYYY-MM-DD" day key in `tz`. */
function midnightOfKey(tz: string, key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  const wall = Date.UTC(y, m - 1, d);
  // Two-iteration fixed point: offset is evaluated at the candidate instant
  // so DST transitions land on the right side (converges for all IANA zones).
  let guess = wall;
  for (let i = 0; i < 2; i++) guess = wall - tzOffsetMs(tz, new Date(guess));
  return new Date(guess);
}

function dayKeyInTz(tz: string, at: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "01";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function shiftDayKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d) + days * 86_400_000);
  return t.toISOString().slice(0, 10);
}

function dayLabel(key: string): string {
  return new Date(`${key}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function ok(
  startKey: string,
  endKey: string,
  tz: string,
  preset: RangePreset,
): RangeResult {
  // endKey is the last inclusive day → exclusive midnight of the next day.
  const start = midnightOfKey(tz, startKey);
  const end = midnightOfKey(tz, shiftDayKey(endKey, 1));
  return {
    ok: true,
    start: start.toISOString(),
    end: end.toISOString(),
    label:
      preset === "custom"
        ? startKey === endKey
          ? dayLabel(startKey)
          : `${dayLabel(startKey)} – ${dayLabel(endKey)}, ${endKey.slice(0, 4)}`
        : PRESET_LABEL[preset],
    preset,
  };
}

export function resolveRange(input: {
  preset?: string;
  start?: string;
  end?: string;
  tz?: string;
  now?: Date;
}): RangeResult {
  const tz = input.tz && tzValid(input.tz) ? input.tz : "UTC";
  const now = input.now ?? new Date();
  const todayKey = dayKeyInTz(tz, now);
  const hasCustom =
    (input.start !== undefined && input.start !== "") ||
    (input.end !== undefined && input.end !== "");
  const preset = (input.preset ?? (hasCustom ? "custom" : DEFAULT_PRESET)) as RangePreset;
  const bad = (message: string): RangeResult => ({ ok: false, message });

  if (preset === "today") return ok(todayKey, todayKey, tz, preset);
  if (preset === "yesterday") {
    return ok(shiftDayKey(todayKey, -1), shiftDayKey(todayKey, -1), tz, preset);
  }
  if (preset === "7d" || preset === "30d" || preset === "90d") {
    const days = preset === "7d" ? 7 : preset === "30d" ? 30 : 90;
    return ok(shiftDayKey(todayKey, -(days - 1)), todayKey, tz, preset);
  }
  if (preset !== "custom") return bad("Unknown date range.");

  const startKey = input.start ?? "";
  const endKey = input.end ?? "";
  if (!DATE_KEY.test(startKey)) return bad("Choose a start date.");
  if (!DATE_KEY.test(endKey)) return bad("Choose an end date.");
  if (startKey > endKey) return bad("Start date must be on or before the end date.");
  if (
    new Date(`${endKey}T00:00:00Z`).getTime() -
      new Date(`${startKey}T00:00:00Z`).getTime() >=
    MAX_SPAN_MS
  ) {
    return bad("Custom range is limited to 366 days.");
  }
  return ok(startKey, endKey, tz, preset);
}
