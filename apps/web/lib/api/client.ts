// Single seam between UI and data. Every feature module calls through here so
// switching from mocks to the real Fastify API is one flag flip, not a sweep
// of `fetch` calls through components.

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// Frontend-first phase: mocked. Set to false once apps/api serves these paths.
// ponytail: boolean flag; replace with env-driven config when backend exists.
export const USE_MOCK = true;

/**
 * Resolve a resource through the API seam.
 * - mock mode: returns `mockValue()` (sync resolver keeps call sites simple)
 * - real mode: GET `${API_BASE}${path}` with credentials (cookies/session later)
 */
export async function request<T>(path: string, mockValue: () => T): Promise<T> {
  if (USE_MOCK) {
    return mockValue();
  }

  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    // Safe to surface: path + status only, no response body (may contain
    // sensitive data) and never tokens.
    throw new Error(`API request failed: ${response.status} on ${path}`);
  }

  return (await response.json()) as T;
}
