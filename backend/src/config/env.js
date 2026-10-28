import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Loads backend/.env first, then the project-root .env (earlier files win). Real env vars (Render) win over both.
const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
dotenv.config({ path: [path.join(backendDir, ".env"), path.join(backendDir, "..", ".env")], quiet: true });

// Centralised, validated configuration. Fails fast in production if secrets are missing.
const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 5000,
  dbPath: process.env.DB_PATH || path.join(backendDir, "data", "talentverse.db"),
  groqApiKey: process.env.GROQ_API_KEY || "",
  groqModel: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
  groqAudioModel: process.env.GROQ_AUDIO_MODEL || "whisper-large-v3-turbo",
  corsOrigins: (process.env.CORS_ORIGINS || "http://localhost:5173")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB) || 10,
  maxInputChars: Number(process.env.MAX_INPUT_CHARS) || 20000,
};

env.isProd = env.nodeEnv === "production";
env.isTest = env.nodeEnv === "test" || Boolean(process.env.NODE_TEST_CONTEXT);

export function assertRuntimeConfig() {
  const missing = [];
  if (!env.groqApiKey) missing.push("GROQ_API_KEY");
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}

export default env;
