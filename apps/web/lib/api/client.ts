// Single seam between UI and data. Every feature module calls through here so
// switching from mocks to the real Fastify API is one flag flip, not a sweep
// of `fetch` calls through components.

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// Task 014: apps/api serves every path below (auth via cookie session +
// RLS). Flip back to true only if the API is down and you want the old
// mock data for local UI work — note mock ids/rows are not real data.
export const USE_MOCK = false;

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
}

/**
 * Resolve a resource through the API seam.
 * - mock mode: returns `mockValue()` (sync resolver keeps call sites simple)
 * - real mode: `${API_BASE}${path}` with credentials (Supabase session cookie)
 *   404 → `undefined` so get-by-id resolvers keep their `| undefined` contract
 *   (unknown/mock-era ids are genuinely not found — never a fake row).
 */
export async function request<T>(
  path: string,
  mockValue: () => T,
  options?: RequestOptions,
): Promise<T> {
  if (USE_MOCK) {
    return mockValue();
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(options?.body !== undefined
      ? { "Content-Type": "application/json" }
      : {}),
  };

  // Server Components fetch server→API with no ambient browser cookies;
  // forward the incoming request's session cookie or auth sees nobody.
  // Dynamic import keeps `next/headers` out of the client bundle.
  if (typeof window === "undefined") {
    const { headers: getHeaders } = await import("next/headers");
    const cookie = (await getHeaders()).get("cookie");
    if (cookie) headers.Cookie = cookie;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method: options?.method ?? "GET",
    credentials: "include",
    headers,
    body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 404) {
    return undefined as T;
  }

  if (!response.ok) {
    // Safe to surface: path + status only, no response body (may contain
    // sensitive data) and never tokens.
    throw new Error(`API request failed: ${response.status} on ${path}`);
  }

  return (await response.json()) as T;
}
