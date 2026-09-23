// Task 021: one-time IG access_token encryption-at-rest migration.
// Run: npx tsx apps/api/scripts/encrypt-ig-tokens.ts
// Requires: SUPABASE_SERVICE_ROLE_KEY, PLATFORM_ENCRYPTION_KEY
// Idempotent: already-`v1.` rows are skipped; plaintext → encrypt + PATCH.
import { encryptSecret, isEncryptedSecret } from "../src/crypto";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://etwuqthopqrzffdgvhqs.supabase.co";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

interface Row {
  id: string;
  access_token: string | null;
}

async function rest(
  path: string,
  init?: { method?: string; body?: unknown; prefer?: string },
): Promise<{ status: number; data: unknown | null }> {
  const headers: Record<string, string> = {
    apikey: SERVICE,
    Authorization: `Bearer ${SERVICE}`,
    "Content-Type": "application/json",
  };
  if (init?.prefer) headers.Prefer = init.prefer;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: init?.method ?? "GET",
    headers,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { status: res.status, data: { error: text.slice(0, 200) } };
  }
  if (res.status === 204) return { status: 204, data: null };
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
}

async function main(): Promise<void> {
  if (!SERVICE) {
    console.error("Set SUPABASE_SERVICE_ROLE_KEY");
    process.exit(2);
  }
  if (!process.env.PLATFORM_ENCRYPTION_KEY?.trim()) {
    console.error("Set PLATFORM_ENCRYPTION_KEY");
    process.exit(2);
  }

  const listed = await rest(
    "social_accounts?select=id,access_token&platform=eq.instagram",
  );
  if (listed.status >= 400 || !Array.isArray(listed.data)) {
    console.error("list failed", listed.status, listed.data);
    process.exit(1);
  }
  const rows = listed.data as Row[];
  let encrypted = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    const token = row.access_token;
    if (!token) {
      skipped += 1;
      continue;
    }
    if (isEncryptedSecret(token)) {
      skipped += 1;
      continue;
    }
    try {
      const enc = encryptSecret(token);
      const patch = await rest(`social_accounts?id=eq.${row.id}`, {
        method: "PATCH",
        prefer: "return=minimal",
        body: { access_token: enc },
      });
      if (patch.status >= 400) {
        failed += 1;
        console.error(`patch failed id=${row.id} status=${patch.status}`);
      } else {
        encrypted += 1;
      }
    } catch (err) {
      failed += 1;
      console.error(`encrypt failed id=${row.id}`, (err as Error).message);
    }
  }

  // Verify: no plaintext tokens remain for this platform.
  const after = await rest(
    "social_accounts?select=access_token&platform=eq.instagram",
  );
  const afterRows = (after.data as Row[] | null) ?? [];
  const plaintextLeft = afterRows.filter(
    (r) => r.access_token && !isEncryptedSecret(r.access_token),
  ).length;

  console.log(
    JSON.stringify({
      total: rows.length,
      encrypted,
      skipped,
      failed,
      plaintextLeft,
    }),
  );
  if (failed > 0 || plaintextLeft > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
