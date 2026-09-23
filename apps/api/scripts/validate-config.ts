// Task 022 production-config gate. Prints missing *names* only — never values.
// Run: npx tsx apps/api/scripts/validate-config.ts
// Exit 0: ok (or development with localhost defaults).
// Exit 1: NODE_ENV=production and required names are missing.
import {
  corsAllowlist,
  missingProductionConfig,
  resolveRedirectUri,
} from "../src/origins";

const missing = missingProductionConfig();
const env = process.env.NODE_ENV ?? "development";

console.log(`env=${env}`);
console.log(`corsAllowlist=${JSON.stringify(corsAllowlist())}`);
console.log(`redirectUri=${resolveRedirectUri()}`);

if (missing.length > 0) {
  console.error(`missing (names only): ${missing.join(", ")}`);
  process.exit(1);
}
console.log("config ok (no values printed)");
