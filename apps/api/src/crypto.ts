import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Shared AES-256-GCM helpers (platform_settings secrets + IG access tokens).
// Stored format: `v1.<iv>.<tag>.<ct>` (base64url) — version prefix enables a
// future key rotation without guessing plaintext vs ciphertext.
//
// Key: PLATFORM_ENCRYPTION_KEY (API env only; 64 hex chars or 32-byte base64).
// Never NEXT_PUBLIC_*, never hardcoded, never logged.

export function encryptionKey(): Buffer | null {
  const raw = (process.env.PLATFORM_ENCRYPTION_KEY ?? "").trim();
  if (!raw) return null;
  if (/^[0-9a-f]{64}$/i.test(raw)) return Buffer.from(raw, "hex");
  const b64 = Buffer.from(raw, "base64");
  if (b64.length === 32) return b64;
  return null;
}

export function encryptionReady(): boolean {
  return encryptionKey() !== null;
}

export function encryptSecret(plain: string): string {
  const key = encryptionKey();
  if (!key) {
    throw Object.assign(new Error("PLATFORM_ENCRYPTION_KEY not configured"), {
      statusCode: 503,
    });
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${ct.toString("base64url")}`;
}

/** Returns null on missing key, bad format, or failed auth tag (tamper). */
export function decryptSecret(encoded: string): string | null {
  const key = encryptionKey();
  if (!key) return null;
  try {
    const [v, ivS, tagS, ctS] = encoded.split(".");
    if (v !== "v1" || !ivS || !tagS || !ctS) return null;
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(ivS, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagS, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(ctS, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

/** True when the value is our encrypted envelope (not plaintext). */
export function isEncryptedSecret(value: string): boolean {
  return value.startsWith("v1.");
}
