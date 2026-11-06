import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import mongoose from 'mongoose';

import { env } from "./config/env.js";

import authRoutes from "./routes/auth.js";
import adminAuthRoutes from "./routes/adminAuth.js";
import { notFound, errorHandler } from "./middleware/error.js";



export function createApp(isReady = () => mongoose.connection.readyState === 1) {
const app = express();

app.disable("x-powered-by");

// âœ… REQUIRED FOR RENDER
app.set("trust proxy", 1);

app.get("/ping", (req, res) => {
  res.status(200).send("pong");
});

const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
app.use((req, res, next) => {
  if (!unsafeMethods.has(req.method)) return next();

  const origin = req.get("origin");
  if (origin && !env.corsOrigins.includes(origin)) {
    return res.status(403).json({ error: "untrusted_origin" });
  }
  if (!origin && req.get("sec-fetch-site") === "cross-site") {
    return res.status(403).json({ error: "untrusted_origin" });
  }

  next();
});

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (env.corsOrigins.includes(origin)) return cb(null, true);
      return cb(Object.assign(new Error('untrusted_origin'), { status: 403, code: 'untrusted_origin' }));
    },
    credentials: true,
  }),
);

app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: env.nodeEnv === "production" ? undefined : false,
  }),
);

app.use(express.json({ limit: "64kb" }));

// Security Scrubbing
app.use((req, res, next) => {
  const scrub = (value) => {
    if (!value || typeof value !== "object") return;
    for (const key of Object.keys(value)) {
      if (key.startsWith("$") || key.includes(".")) {
        delete value[key];
      } else {
        scrub(value[key]);
      }
    }
  };
  scrub(req.body);
  scrub(req.query);
  scrub(req.params);
  next();
});

app.use(cookieParser());

app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));

// Routes
app.get('/health', (_req, res) => {
  const ready = isReady();
  res.set('Cache-Control', 'no-store').status(ready ? 200 : 503).json({ ok: ready, chainId: env.chainId });
});
app.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  if (!isReady()) return res.status(503).json({ error: 'service_unavailable' });
  next();
});

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminAuthRoutes);

app.use(notFound);
app.use(errorHandler);


return app;
}
