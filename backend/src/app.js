import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import env from "./config/env.js";
import { dbStatus } from "./config/db.js";
import apiRouter from "./routes/index.js";
import { errorHandler, notFound } from "./middleware/errors.js";

export function createApp({ aiClient, ocr } = {}) {
  const app = express();

  app.set("trust proxy", 1); // Render / Vercel sit behind a proxy
  app.use(helmet());
  app.use(
    cors({
      origin(origin, cb) {
        // Allow same-origin tools (curl, health checks) and the configured frontends only.
        if (!origin || env.corsOrigins.includes("*") || env.corsOrigins.includes(origin)) return cb(null, true);
        cb(null, false);
      },
    })
  );
  app.use(express.json({ limit: "1mb" }));
  if (!env.isTest) app.use(morgan(env.isProd ? "combined" : "dev"));

  // AI calls cost money: cap them per IP.
  const aiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: env.isTest ? 1000 : 40,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { ok: false, error: { code: "RATE_LIMITED", message: "Too many AI requests. Try again in a few minutes." } },
  });

  // Lets tests inject a fake AI client without touching the network.
  app.locals.aiClient = aiClient;
  app.locals.ocr = ocr;

  app.get("/api/health", (req, res) => {
    res.json({ ok: true, service: "talentverse-api", db: dbStatus(), model: env.groqModel, time: new Date().toISOString() });
  });

  // Temporary API test console (the real frontend is deployed separately).
  app.use("/demo", express.static(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "demo")));
  app.get("/", (req, res) => res.redirect("/demo/"));

  app.use("/api", (req, res, next) => (req.method === "POST" && req.path.endsWith("/extract") ? aiLimiter(req, res, next) : next()));
  app.use("/api", apiRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
