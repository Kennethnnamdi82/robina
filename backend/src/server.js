import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import axios from "axios";

import { env } from "./config/env.js";
import { connectMongo } from "./db/mongo.js";
import authRoutes from "./routes/auth.js";
import adminAuthRoutes from "./routes/adminAuth.js";
import miningRoutes from "./routes/mining.js";
import paymentRoutes from "./routes/payments.js";
import taskRoutes from "./routes/tasks.js";
import adminRoutes from "./routes/admin.js";
import leaderboardRoutes from "./routes/leaderboard.js";
import gameRoutes from "./routes/game.js";
import { notFound, errorHandler } from "./middleware/error.js";
import { startAutoClaimWorker } from "./services/autoClaimWorker.js";
import { startSeasonScheduler } from "./services/seasonScheduler.js";

const app = express();

app.disable("x-powered-by");

// ✅ REQUIRED FOR RENDER
app.set("trust proxy", 1);

app.get("/ping", (req, res) => {
  res.status(200).send("pong");
});

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (env.corsOrigins.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS blocked: ${origin}`));
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
app.get("/health", (_req, res) => res.json({ ok: true, chainId: env.chainId }));

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminAuthRoutes);
app.use("/api/mining", miningRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/leaderboard", leaderboardRoutes);
app.use("/api/game", gameRoutes);
app.use("/api/admin", adminRoutes);

app.use(notFound);
app.use(errorHandler);

const start = async () => {
  await connectMongo();
  try {
    const { User } = await import("./models/User.js");
    await User.collection.dropIndex("walletAddress_1");
  } catch (err) {}

  app.listen(env.port, () => {
    console.log(`[backend] port=${env.port}`);
    // Self-ping to keep Render awake
    const BACKEND_URL = "https://basedrop-game-app-6.onrender.com";
    setInterval(async () => {
      try {
        await axios.get(`${BACKEND_URL}/ping`);
      } catch (e) {}
    }, 300000);
  });
  startAutoClaimWorker();
  startSeasonScheduler();
};

start().catch((err) => {
  console.error("[fatal]", err);
  process.exit(1);
});
