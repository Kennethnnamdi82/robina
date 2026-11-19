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
import { createBountyRoutes } from './bounties/routes.js';
import { createLegacyBaseVerifier } from './bounties/baseTreasury.js';
import { createMissionRoutes } from './missions/routes.js';
import {MissionCompletions} from './missions/completions.js';
import { createBachsWebhookRoutes } from './payments/bachsWebhook.js';
import {createBachsProvider} from './payments/provider.js';
import {createPaymentService} from './payments/service.js';
import {createPaymentRoutes} from './payments/routes.js';
import {createAndroidDownloadRoutes} from './downloads/android.js';



export function createApp(isReady = () => mongoose.connection.readyState === 1, options = {}) {
const app = express();
app.locals.missionCompletions=options.missionCompletions??new MissionCompletions();
const payments=createPaymentService(options.paymentProvider===undefined?createBachsProvider():options.paymentProvider);

app.disable("x-powered-by");

// âœ… REQUIRED FOR RENDER
app.set("trust proxy", 1);

app.get("/ping", (req, res) => {
  res.status(200).send("pong");
});

app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: env.nodeEnv === "production" ? undefined : false,
  }),
);

// Provider authentication is its signature, not player cookies/browser CSRF.
// Mount BEFORE JSON parsing, security scrubbing and request/access logging.
app.use('/api/payments/bachs', createBachsWebhookRoutes({ isReady, logger: options.bachsWebhookLogger, processEvent: payments.event }));

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
app.use('/api/downloads',createAndroidDownloadRoutes(options.androidDownload));
app.get('/health', (_req, res) => {
  const ready = isReady();
  const release=process.env.RENDER_GIT_COMMIT;
  res.set('Cache-Control', 'no-store').status(ready ? 200 : 503).json({ ok: ready, chainId: env.chainId, bountyPayoutMode: 'manual',...(/^[a-f\d]{40}$/i.test(release??'')?{release}:{}) });
});
app.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  if (!isReady()) return res.status(503).json({ error: 'service_unavailable' });
  next();
});

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminAuthRoutes);
const bountyRoutes = createBountyRoutes(options.bountyChain ?? createLegacyBaseVerifier());
app.use('/api/bounties', bountyRoutes.player);
app.use('/api/admin/bounties', bountyRoutes.admin);
app.use('/api/missions', createMissionRoutes(options.missionAuthority, { allowUnverified: options.allowUnverifiedMissions === true,completions:app.locals.missionCompletions }));
const paymentRoutes=createPaymentRoutes(payments);
app.use('/api/payments',paymentRoutes.player);
app.use('/api/admin/payments',paymentRoutes.admin);

app.use(notFound);
app.use(errorHandler);


return app;
}
