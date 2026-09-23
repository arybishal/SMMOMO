// Task 021: token encryption unit + DB regression checks.
// Run: npx tsx apps/api/scripts/validate-tokens.ts
// Requires: PLATFORM_ENCRYPTION_KEY; optional SUPABASE_SERVICE_ROLE_KEY for DB probe.
import {
  decryptSecret,
  encryptSecret,
  encryptionReady,
  isEncryptedSecret,
} from "../src/crypto";

let pass = 0;
let fail = 0;
function ok(name: string, cond: boolean, extra = ""): void {
  if (cond) {
    pass += 1;
    console.log(`PASS ${name}${extra ? " " + extra : ""}`);
  } else {
    fail += 1;
    console.log(`FAIL ${name}${extra ? " " + extra : ""}`);
  }
}

async function main(): Promise<void> {
  ok("encryption key ready", encryptionReady());

  // --- roundtrip ---
  const plain = "IGQVJ-test-token-abc123";
  const enc = encryptSecret(plain);
  ok("encrypt produces v1 envelope", isEncryptedSecret(enc), enc.slice(0, 12));
  ok("ciphertext not equal plaintext", enc !== plain && !enc.includes(plain));
  ok("decrypt roundtrip", decryptSecret(enc) === plain);

  // --- malformed fails safely ---
  ok("malformed empty → null", decryptSecret("") === null);
  ok("malformed no dots → null", decryptSecret("not-encrypted") === null);
  ok(
    "malformed wrong version → null",
    decryptSecret("v2.a.b.c") === null,
  );
  ok(
    "malformed short fields → null",
    decryptSecret("v1.x.y") === null,
  );

  // --- tampered ciphertext fails auth tag ---
  const parts = enc.split(".");
  const tamperedTag = [parts[0], parts[1], "AAAA", parts[3]].join(".");
  ok("tampered tag → null", decryptSecret(tamperedTag) === null);
  const tamperedCt = [parts[0], parts[1], parts[2], "AAAA"].join(".");
  ok("tampered ciphertext → null", decryptSecret(tamperedCt) === null);

  // --- wrong key fails (simulate by clearing key mid-flight is hard;
  //     decrypt with different PLATFORM_ENCRYPTION_KEY via temp env) ---
  const saved = process.env.PLATFORM_ENCRYPTION_KEY;
  process.env.PLATFORM_ENCRYPTION_KEY = "0".repeat(64);
  ok("wrong key → null", decryptSecret(enc) === null);
  if (saved !== undefined) process.env.PLATFORM_ENCRYPTION_KEY = saved;
  else delete process.env.PLATFORM_ENCRYPTION_KEY;
  ok("key restored", encryptionReady());

  // --- DB probe: every stored IG token is encrypted ---
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    "https://etwuqthopqrzffdgvhqs.supabase.co";
  if (service) {
    const res = await fetch(
      `${url}/rest/v1/social_accounts?select=access_token&platform=eq.instagram`,
      {
        headers: {
          apikey: service,
          Authorization: `Bearer ${service}`,
        },
      },
    );
    if (res.ok) {
      const rows = (await res.json()) as { access_token: string | null }[];
      const withToken = rows.filter((r) => r.access_token);
      const encrypted = withToken.filter((r) =>
        isEncryptedSecret(r.access_token as string),
      );
      ok(
        "DB IG tokens all encrypted",
        encrypted.length === withToken.length,
        `encrypted=${encrypted.length}/${withToken.length}`,
      );
      const roundtrips = withToken.every(
        (r) => decryptSecret(r.access_token as string) !== null,
      );
      ok("DB tokens decrypt with current key", roundtrips);
    } else {
      ok("DB probe", false, `status=${res.status}`);
    }
  } else {
    console.log("SKIP DB probe (no SUPABASE_SERVICE_ROLE_KEY)");
  }

  console.log(`\nRESULT pass=${pass} fail=${fail}`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
