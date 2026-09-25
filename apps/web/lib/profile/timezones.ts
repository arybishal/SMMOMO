// IANA timezone identifiers from the runtime (Intl.supportedValuesOf) — no
// hardcoded shortlist, always in sync with the engine's tz database.
// Called from client effects only: the server never renders this list, so a
// browser with no supportedValuesOf can't break SSR/hydration.

export function supportedTimeZones(): string[] {
  try {
    const fn = (
      Intl as unknown as { supportedValuesOf?: (k: string) => string[] }
    ).supportedValuesOf;
    const zones = typeof fn === "function" ? fn("timeZone") : null;
    if (Array.isArray(zones) && zones.length > 100) {
      return [...zones].sort();
    }
  } catch {
    // Unsupported runtime — caller falls back to a minimal list.
  }
  return [];
}
