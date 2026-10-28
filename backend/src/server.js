import env, { assertRuntimeConfig } from "./config/env.js";
import { connectDB } from "./config/db.js";
import { createApp } from "./app.js";

async function main() {
  assertRuntimeConfig();
  connectDB(env.dbPath);
  const app = createApp();
  app.listen(env.port, () => console.log(`[api] TalentVerse listening on :${env.port}`));
}

main().catch((err) => {
  console.error("[startup] failed:", err.message);
  process.exit(1);
});
