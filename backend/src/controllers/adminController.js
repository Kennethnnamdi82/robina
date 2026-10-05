import { z } from "zod";
import { User } from "../models/User.js";
import { Payment } from "../models/Payment.js";
import { Task } from "../models/Task.js";
import { Season } from "../models/Season.js";
import { GameSession } from "../models/GameSession.js";
import { ActivityLog } from "../models/ActivityLog.js";
import { LoginSession } from "../models/LoginSession.js";
import { TaskDefinition } from "../models/TaskDefinition.js";
import { TreasureRewardState } from "../models/TreasureRewardState.js";
import { settleReferralReward } from "../services/referrals.js";
import { syncSeasonStates } from "../services/seasonLifecycle.js";
import { logActivity } from "../services/activityLogger.js";

const USER_LEVELS = [
  "Beginner",
  "Bronze",
  "Silver",
  "Gold",
  "Platinum",
  "Diamond",
  "Master",
  "Grandmaster",
  "Legendary",
  "Top Legendary",
];

const reviewSchema = z.object({
  taskMongoId: z.string().min(1),
  decision: z.enum(["approve", "reject"]),
});
const ACTION_TASK_CATEGORIES = new Set([
  "x_follow",
  "x_like",
  "x_retweet",
  "x_comment",
  "telegram_join",
  "discord_join",
]);
const TASK_TYPES = [
  "default",
  "daily",
  "temporary_engagement",
  "campaign",
  "event_community",
];
const startSeasonSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  endDate: z.string().datetime().optional(),
  topN: z.number().int().min(1).max(10000).default(50),
  totalPayout: z.number().min(0).default(0),
});
const listUsersQuerySchema = z.object({
  q: z.string().max(120).optional(),
  level: z.enum(USER_LEVELS).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  skip: z.coerce.number().int().min(0).max(100000).optional(),
});
const listTasksQuerySchema = z.object({
  status: z.enum(["pending", "complete", "rejected"]).optional(),
});
const createTaskDefinitionSchema = z
  .object({
    id: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .regex(/^[a-z0-9_]+$/),
    title: z.string().trim().min(1).max(160),
    description: z.string().trim().max(300).optional(),
    reward: z.number().min(0).optional(),
    rewardPoints: z.number().min(0).optional(),
    category: z
      .enum([
        "custom",
        "x_follow",
        "x_like",
        "x_retweet",
        "x_comment",
        "x_post",
        "telegram_join",
        "discord_join",
      ])
      .optional(),
    taskType: z.enum(TASK_TYPES).optional(),
    actionUrl: z.string().trim().url().max(500).optional(),
    published: z.boolean().optional(),
    status: z.enum(["active", "inactive", "archived"]).optional(),
    expiresAt: z.string().datetime().nullable().optional(),
  })
  .superRefine((data, ctx) => {
    const category = data.category || "custom";
    if (ACTION_TASK_CATEGORIES.has(category) && !data.actionUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["actionUrl"],
        message: "action_url_required_for_action_task",
      });
    }
    if (data.reward === undefined && data.rewardPoints === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rewardPoints"],
        message: "reward_points_required",
      });
    }
  });
const updateTaskDefinitionSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(300).optional(),
  reward: z.number().min(0).optional(),
  rewardPoints: z.number().min(0).optional(),
  category: z
    .enum([
      "custom",
      "x_follow",
      "x_like",
      "x_retweet",
      "x_comment",
      "x_post",
      "telegram_join",
      "discord_join",
    ])
    .optional(),
  taskType: z.enum(TASK_TYPES).optional(),
  actionUrl: z.string().trim().url().max(500).optional(),
  published: z.boolean().optional(),
  status: z.enum(["active", "inactive", "archived"]).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});
const suspendUserSchema = z.object({
  wallet: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^0x[0-9a-f]{40}$/),
  durationHours: z
    .number()
    .int()
    .min(1)
    .max(24 * 365)
    .default(24),
});
const userWalletSchema = z.object({
  wallet: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^0x[0-9a-f]{40}$/),
});
const addBdBalanceSchema = z.object({
  wallet: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^0x[0-9a-f]{40}$/),
  amount: z.number().finite().positive().max(1_000_000),
});
const TREASURE_REWARD_STATE_KEY = "season_treasure_reward_limit";
const DEFAULT_MAX_ELIGIBLE_TREASURE_USERS = 4;
const TASK_LIFETIME_MS = 24 * 60 * 60 * 1000;

export async function listUsers(req, res) {
  const parsed = listUsersQuerySchema.safeParse(req.query);
  if (!parsed.success)
    return res
      .status(400)
      .json({ error: "invalid_query", details: parsed.error.flatten() });
  const { q = "", level, limit = 50, skip = 0 } = parsed.data;
  const filter = {};
  if (level) filter.level = level;
  if (q)
    filter.wallet = {
      $regex: String(q)
        .toLowerCase()
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      $options: "i",
    };
  const [users, total] = await Promise.all([
    User.find(filter)
      .select(
        "wallet level bdBalance referralCount createdAt autoClaimActive autoClaimExpiry accountStatus suspendedUntil updatedAt",
      )
      .sort({ bdBalance: -1 })
      .skip(skip)
      .limit(limit),
    User.countDocuments(filter),
  ]);
  const wallets = users.map((u) => u.wallet);
  const sessions = wallets.length
    ? await GameSession.find({ wallet: { $in: wallets } }).select(
        "wallet requiredTreasures seasonTreasures seasonEligible completed",
      )
    : [];
  const sessionByWallet = new Map(
    sessions.map((session) => [session.wallet.toLowerCase(), session]),
  );
  const rows = users.map((u) => {
    let activityStatus = "inactive";
    if (u.accountStatus === "suspended") activityStatus = "suspended";
    else if (
      u.updatedAt &&
      Date.now() - new Date(u.updatedAt).getTime() <= 30 * 86400000
    )
      activityStatus = "active";
    const session = sessionByWallet.get(String(u.wallet || "").toLowerCase());
    const requiredTreasures = Number(session?.requiredTreasures || 6);
    const seasonTreasuresCount = new Set(session?.seasonTreasures || []).size;
    const hasAllSeasonTreasures =
      seasonTreasuresCount >= requiredTreasures ||
      Boolean(session?.seasonEligible);
    return {
      ...u.toObject(),
      activityStatus,
      requiredTreasures,
      seasonTreasuresCount,
      seasonEligible: Boolean(session?.seasonEligible),
      completed: Boolean(session?.completed),
      hasAllSeasonTreasures,
    };
  });
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const page = Math.floor(skip / limit) + 1;
  res.json({
    users: rows,
    total,
    limit,
    skip,
    page,
    totalPages,
  });
}

export async function listPayments(_req, res) {
  const now = new Date();
  await syncSeasonStates();

  const activeSeason = await Season.findOne({ status: "active" }).sort({
    startDate: -1,
  });

  if (!activeSeason) {
    return res.json({
      seasonComingSoon: true,
      activeSeason: null,
      payments: [],
      summary: {
        totalRevenue: 0,
        totalTransactions: 0,
        totalRecords: 0,
        byAction: [],
        statusCounts: {},
      },
    });
  }

  const windowFilter = {
    createdAt: { $gte: activeSeason.startDate, $lte: now },
  };
  const [payments, summary, statusAgg] = await Promise.all([
    Payment.find(windowFilter).sort({ createdAt: -1 }).limit(200),
    Payment.aggregate([
      { $match: { ...windowFilter, status: "verified" } },
      {
        $group: {
          _id: "$action",
          revenue: { $sum: "$amountUsdc" },
          count: { $sum: 1 },
        },
      },
    ]),
    Payment.aggregate([
      { $match: windowFilter },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
  ]);
  const totalRevenue = summary.reduce((sum, row) => sum + row.revenue, 0);
  const totalTransactions = summary.reduce((sum, row) => sum + row.count, 0);
  const statusCounts = statusAgg.reduce((acc, row) => {
    acc[row._id] = row.count;
    return acc;
  }, {});
  res.json({
    seasonComingSoon: false,
    activeSeason: {
      id: activeSeason._id,
      name: activeSeason.name,
      startDate: activeSeason.startDate,
      endDate: activeSeason.endDate,
    },
    payments,
    summary: {
      totalRevenue,
      totalTransactions,
      totalRecords: payments.length,
      byAction: summary,
      statusCounts,
    },
  });
}

export async function listTasks(req, res) {
  const parsed = listTasksQuerySchema.safeParse(req.query);
  if (!parsed.success)
    return res
      .status(400)
      .json({ error: "invalid_query", details: parsed.error.flatten() });
  const { status } = parsed.data;
  const filter = {};
  if (status) filter.status = status;
  const tasks = await Task.find(filter).sort({ createdAt: -1 }).limit(1000);
  const definitions = await TaskDefinition.find({}).sort({ createdAt: -1 });
  res.json({
    tasks,
    definitions: definitions.map((def) => {
      const row = def.toObject();
      const rewardPoints = Number(row.rewardPoints ?? row.reward ?? 0);
      const createdAtMs = row.createdAt ? new Date(row.createdAt).getTime() : 0;
      const effectiveExpiresAt = createdAtMs
        ? new Date(createdAtMs + TASK_LIFETIME_MS)
        : null;
      return {
        ...row,
        reward: rewardPoints,
        rewardPoints,
        reward_points: rewardPoints,
        task_type: row.taskType || "temporary_engagement",
        created_at: row.createdAt || null,
        expiresAt: effectiveExpiresAt,
        expires_at: effectiveExpiresAt,
      };
    }),
  });
}

export async function reviewTask(req, res) {
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_body" });

  const task = await Task.findOneAndUpdate(
    {
      _id: parsed.data.taskMongoId,
      status: "pending",
      reviewRequired: { $ne: false },
    },
    {
      $set: {
        status: parsed.data.decision === "approve" ? "complete" : "rejected",
      },
    },
    { new: true },
  );
  if (!task)
    return res.status(409).json({ error: "already_reviewed_or_not_found" });

  if (parsed.data.decision === "approve") {
    await User.updateOne(
      { wallet: task.wallet, completedTasks: { $ne: task.taskId } },
      {
        $inc: { bdBalance: task.reward },
        $addToSet: { completedTasks: task.taskId },
      },
    );
    await settleReferralReward(task.wallet);
    void logActivity({
      wallet: task.wallet,
      activityType: "social_task_completed",
      activityDetails: `${task.taskId} approved for ${Number(task.reward || 0)} BD`,
      module: "tasks",
      status: "success",
      bdAmount: Number(task.reward || 0),
      metadata: {
        taskId: task.taskId,
        reviewedBy: req.admin?.username || "admin",
      },
    });
  }
  res.json({ ok: true, task });
}

export async function adminLeaderboard(req, res) {
  const now = new Date();
  await syncSeasonStates();

  const activeSeason = await Season.findOne({ status: "active" }).sort({
    startDate: -1,
  });

  const page = Math.max(
    1,
    Number.parseInt(String(req.query.page || "1"), 10) || 1,
  );
  const limit = Math.min(
    200,
    Math.max(1, Number.parseInt(String(req.query.limit || "50"), 10) || 50),
  );

  if (!activeSeason) {
    return res.json({
      seasonComingSoon: true,
      activeSeason: null,
      leaderboard: [],
      page: 1,
      limit,
      total: 0,
      totalPages: 1,
    });
  }

  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    User.find({})
      .sort({ bdBalance: -1 })
      .skip(skip)
      .limit(limit)
      .select("wallet bdBalance level"),
    User.countDocuments({}),
  ]);
  const wallets = users.map((user) => user.wallet);
  const sessions = await GameSession.find({ wallet: { $in: wallets } }).select(
    "wallet attempts totalSpent bdPoints treasuresCollected requiredTreasures seasonTreasures seasonEligible",
  );
  const paymentsAgg = await Payment.aggregate([
    { $match: { status: "verified", wallet: { $in: wallets } } },
    { $group: { _id: "$wallet", totalUsdcSpent: { $sum: "$amountUsdc" } } },
  ]);
  const sessionByWallet = new Map(
    sessions.map((session) => [session.wallet.toLowerCase(), session]),
  );
  const paymentsByWallet = new Map(
    paymentsAgg.map((row) => [
      String(row._id).toLowerCase(),
      Number(row.totalUsdcSpent || 0),
    ]),
  );

  res.json({
    seasonComingSoon: false,
    activeSeason: {
      id: activeSeason._id,
      name: activeSeason.name,
      startDate: activeSeason.startDate,
      endDate: activeSeason.endDate,
    },
    leaderboard: users.map((user, i) => {
      const game = sessionByWallet.get(user.wallet.toLowerCase());
      const requiredTreasures = Number(game?.requiredTreasures || 6);
      const seasonTreasuresCount = new Set(game?.seasonTreasures || []).size;
      const hasAllSeasonTreasures =
        seasonTreasuresCount >= requiredTreasures ||
        Boolean(game?.seasonEligible);
      return {
        rank: skip + i + 1,
        wallet: user.wallet,
        bd: user.bdBalance,
        level: user.level,
        totalUsdcSpent: Number(
          paymentsByWallet.get(user.wallet.toLowerCase()) || 0,
        ),
        gameplay: game
          ? {
              attempts: game.attempts,
              totalSpent: game.totalSpent,
              bdPoints: game.bdPoints,
              treasuresCollected: game.treasuresCollected,
              requiredTreasures,
              seasonTreasuresCount,
              seasonEligible: Boolean(game.seasonEligible),
              hasAllSeasonTreasures,
            }
          : null,
      };
    }),
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
}

export async function analytics(_req, res) {
  const [users, payments, tasksAgg, totalBd, revenue] = await Promise.all([
    User.countDocuments({}),
    Payment.countDocuments({ status: "verified" }),
    Task.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    User.aggregate([{ $group: { _id: null, total: { $sum: "$bdBalance" } } }]),
    Payment.aggregate([
      { $match: { status: "verified" } },
      { $group: { _id: null, total: { $sum: "$amountUsdc" } } },
    ]),
  ]);
  res.json({
    users,
    payments,
    tasks: tasksAgg,
    totalBd: totalBd[0]?.total || 0,
    totalRevenue: revenue[0]?.total || 0,
  });
}

function clampPagination(query) {
  const page = Math.max(1, Number.parseInt(String(query.page || "1"), 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(String(query.limit || "50"), 10) || 50),
  );
  return { page, limit, skip: (page - 1) * limit };
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function applyDateRange(filter, query) {
  const range = {};
  if (query.from) {
    const from = new Date(String(query.from));
    if (Number.isFinite(from.getTime())) range.$gte = from;
  }
  if (query.to) {
    const to = new Date(String(query.to));
    if (Number.isFinite(to.getTime())) range.$lte = to;
  }
  if (Object.keys(range).length > 0) filter.createdAt = range;
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function ago(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function sumRevenueSince(since) {
  const match = { status: "verified" };
  if (since) match.createdAt = { $gte: since };
  const rows = await Payment.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        revenue: { $sum: "$amountUsdc" },
        count: { $sum: 1 },
      },
    },
  ]);
  return {
    revenue: Number(rows[0]?.revenue || 0),
    count: Number(rows[0]?.count || 0),
  };
}

export async function listActivity(req, res) {
  const { page, limit, skip } = clampPagination(req.query);
  const filter = {};
  if (req.query.wallet) filter.wallet = String(req.query.wallet).toLowerCase();
  if (req.query.type) filter.activityType = String(req.query.type);
  if (req.query.module) filter.module = String(req.query.module);
  if (req.query.status) filter.status = String(req.query.status);
  applyDateRange(filter, req.query);
  if (req.query.q) {
    const rx = new RegExp(escapeRegExp(req.query.q), "i");
    filter.$or = [
      { wallet: rx },
      { username: rx },
      { activityType: rx },
      { activityDetails: rx },
      { txHash: rx },
    ];
  }

  const [activity, total] = await Promise.all([
    ActivityLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    ActivityLog.countDocuments(filter),
  ]);

  res.json({
    activity,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
  });
}

export async function listLoginSessions(req, res) {
  const { page, limit, skip } = clampPagination(req.query);
  const filter = {};
  if (req.query.wallet) filter.wallet = String(req.query.wallet).toLowerCase();
  if (req.query.country) filter.country = String(req.query.country);
  if (req.query.deviceType) filter.deviceType = String(req.query.deviceType);
  if (req.query.source) filter.loginSource = String(req.query.source);
  applyDateRange(filter, req.query);

  const [sessions, total] = await Promise.all([
    LoginSession.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    LoginSession.countDocuments(filter),
  ]);

  res.json({
    sessions,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
  });
}

export async function activitySummary(_req, res) {
  const today = startOfToday();
  const activeNowSince = new Date(Date.now() - 5 * 60 * 1000);

  const [
    totalUsers,
    newUsersToday,
    activeUsersTodayWallets,
    activeNowWallets,
    revenueToday,
    revenueWeek,
    revenueMonth,
    revenueTotal,
    revenueBreakdownRows,
    topSpenders,
    activityCounts,
    deviceCounts,
    countryCounts,
    sourceCounts,
  ] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ createdAt: { $gte: today } }),
    ActivityLog.distinct("wallet", {
      createdAt: { $gte: today },
      wallet: { $ne: "" },
    }),
    LoginSession.distinct("wallet", { createdAt: { $gte: activeNowSince } }),
    sumRevenueSince(today),
    sumRevenueSince(ago(7)),
    sumRevenueSince(ago(30)),
    sumRevenueSince(null),
    Payment.aggregate([
      { $match: { status: "verified" } },
      {
        $project: {
          amountUsdc: 1,
          bucket: {
            $switch: {
              branches: [
                { case: { $eq: ["$action", "upgrade"] }, then: "upgrade" },
                {
                  case: { $eq: ["$action", "auto_claim"] },
                  then: "auto_claim",
                },
                {
                  case: { $in: ["$action", ["game_card", "game_bundle"]] },
                  then: "treasure",
                },
              ],
              default: "$action",
            },
          },
        },
      },
      {
        $group: {
          _id: "$bucket",
          count: { $sum: 1 },
          revenue: { $sum: "$amountUsdc" },
        },
      },
      { $sort: { revenue: -1 } },
    ]),
    Payment.aggregate([
      { $match: { status: "verified" } },
      {
        $group: {
          _id: "$wallet",
          totalSpent: { $sum: "$amountUsdc" },
          count: { $sum: 1 },
        },
      },
      { $sort: { totalSpent: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "wallet",
          as: "user",
        },
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          wallet: "$_id",
          totalSpent: 1,
          count: 1,
          level: "$user.level",
          bdBalance: "$user.bdBalance",
        },
      },
    ]),
    ActivityLog.aggregate([
      { $group: { _id: "$activityType", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]),
    LoginSession.aggregate([
      { $group: { _id: "$deviceType", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    LoginSession.aggregate([
      { $group: { _id: "$country", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]),
    LoginSession.aggregate([
      { $group: { _id: "$loginSource", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
  ]);

  const revenueBreakdown = {
    upgrade: { count: 0, revenue: 0 },
    auto_claim: { count: 0, revenue: 0 },
    treasure: { count: 0, revenue: 0 },
  };
  for (const row of revenueBreakdownRows) {
    revenueBreakdown[row._id] = {
      count: Number(row.count || 0),
      revenue: Number(row.revenue || 0),
    };
  }

  res.json({
    totalUsers,
    newUsersToday,
    activeUsersToday: activeUsersTodayWallets.length,
    activeNow: activeNowWallets.length,
    revenueToday: revenueToday.revenue,
    revenueWeek: revenueWeek.revenue,
    revenueMonth: revenueMonth.revenue,
    revenueTotal: revenueTotal.revenue,
    revenueBreakdown,
    topSpenders,
    activityCounts,
    deviceCounts,
    countryCounts,
    sourceCounts,
  });
}

export async function listSeasons(_req, res) {
  const now = new Date();
  await syncSeasonStates();
  const seasons = await Season.find({}).sort({ startDate: -1 }).limit(100);

  const seasonRows = await Promise.all(
    seasons.map(async (season) => {
      const windowEnd =
        season.status === "ended"
          ? new Date(season.endedAt || season.endDate)
          : now;
      const participantsAgg = await Payment.aggregate([
        {
          $match: {
            status: "verified",
            action: { $in: ["game_card", "game_bundle"] },
            createdAt: { $gte: season.startDate, $lte: windowEnd },
          },
        },
        { $group: { _id: "$wallet" } },
        { $count: "count" },
      ]);
      return {
        ...season.toObject(),
        participants: participantsAgg[0]?.count || 0,
      };
    }),
  );

  const activeSeason =
    seasonRows.find((season) => season.status === "active") || null;
  res.json({
    seasons: seasonRows,
    activeSeason,
    seasonComingSoon: !activeSeason,
  });
}

export async function startSeason(req, res) {
  const parsed = startSeasonSchema
    .extend({
      startDate: z.string().datetime().optional(),
    })
    .safeParse(req.body);
  if (!parsed.success)
    return res
      .status(400)
      .json({ error: "invalid_body", details: parsed.error.flatten() });

  const now = new Date();
  const requestedStartDate = parsed.data.startDate
    ? new Date(parsed.data.startDate)
    : now;
  const startDate = requestedStartDate > now ? requestedStartDate : now;
  const fallbackEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const endDate = parsed.data.endDate
    ? new Date(parsed.data.endDate)
    : fallbackEnd;
  if (endDate <= startDate)
    return res.status(400).json({ error: "end_date_must_be_after_start" });
  const renewalDurationMs = Math.max(
    60 * 1000,
    endDate.getTime() - startDate.getTime(),
  );

  await Season.updateMany(
    { status: "active" },
    { $set: { status: "ended", endedAt: now, endDate: now } },
  );
  const count = await Season.countDocuments({});
  const season = await Season.create({
    name: parsed.data.name || `Season ${count + 1}`,
    status: startDate > now ? "upcoming" : "active",
    startDate,
    endDate,
    renewalDurationMs,
    topN: parsed.data.topN,
    totalPayout: parsed.data.totalPayout,
  });
  res.json({ ok: true, season });
}

export async function endCurrentSeason(_req, res) {
  const now = new Date();
  const season = await Season.findOneAndUpdate(
    { status: { $in: ["active", "upcoming"] } },
    { $set: { status: "ended", endedAt: now, endDate: now } },
    { new: true, sort: { startDate: -1 } },
  );
  if (!season) return res.status(404).json({ error: "no_active_season" });
  await Promise.all([
    User.updateMany(
      {},
      {
        $inc: { sessionVersion: 1 },
        $set: {
          bdBalance: 0,
          level: "Beginner",
          lastClaimTime: new Date(0),
          autoClaimActive: false,
          autoClaimExpiry: null,
          completedTasks: [],
          lastDailyTaskDate: "",
          boostUsesToday: 0,
          lastBoostDate: "",
          referralRewardEligible: false,
        },
      },
    ),
    GameSession.updateMany(
      {},
      {
        $set: {
          attempts: 0,
          totalSpent: 0,
          bdPoints: 0,
          treasuresCollected: 0,
          seasonStage: 1,
          seasonTreasures: [],
          treasureBank: [],
          seasonEligible: false,
          completed: false,
          requiredTreasures: 6,
          revealedCards: [],
          roundNumber: 1,
          roundStatus: "active",
          lastTxHashes: [],
          lastActivityAt: now,
        },
      },
    ),
    Task.deleteMany({}),
    TreasureRewardState.deleteMany({}),
    Payment.updateMany(
      { status: { $in: ["pending", "processing"] } },
      { $set: { status: "failed", failureReason: "season_reset" } },
    ),
  ]);
  res.json({ ok: true, season });
}

export async function resetAllUserTreasures(_req, res) {
  const now = new Date();
  const result = await GameSession.updateMany(
    {},
    {
      $set: {
        treasuresCollected: 0,
        requiredTreasures: 6,
        seasonStage: 1,
        seasonTreasures: [],
        treasureBank: [],
        seasonEligible: false,
        completed: false,
        treasureResetAt: now,
        lastActivityAt: now,
      },
    },
  );

  await TreasureRewardState.updateMany(
    {},
    {
      $set: {
        eligibleWallets: [],
        closed: false,
        closedAt: null,
      },
    },
  );

  res.json({
    ok: true,
    matchedCount: result.matchedCount ?? result.n ?? 0,
    modifiedCount: result.modifiedCount ?? result.nModified ?? 0,
  });
}

export async function createTaskDefinition(req, res) {
  const parsed = createTaskDefinitionSchema.safeParse(req.body);
  if (!parsed.success)
    return res
      .status(400)
      .json({ error: "invalid_body", details: parsed.error.flatten() });
  try {
    const rewardPoints = Number(
      parsed.data.rewardPoints ?? parsed.data.reward ?? 0,
    );
    const category = parsed.data.category || "custom";
    const expiresAt = new Date(Date.now() + TASK_LIFETIME_MS);
    const status =
      parsed.data.status ||
      (parsed.data.published === false ? "inactive" : "active");
    const published = parsed.data.published ?? status === "active";
    const created = await TaskDefinition.create({
      id: parsed.data.id,
      title: parsed.data.title,
      description: parsed.data.description || "",
      reward: rewardPoints,
      rewardPoints,
      category,
      taskType: parsed.data.taskType || "temporary_engagement",
      actionUrl: parsed.data.actionUrl || "",
      expiresAt,
      status,
      published,
    });
    res.json({ ok: true, taskDefinition: created });
  } catch (e) {
    if (e?.code === 11000)
      return res.status(409).json({ error: "task_id_exists" });
    throw e;
  }
}

export async function updateTaskDefinition(req, res) {
  const taskId = String(req.params.taskId || "").toLowerCase();
  const parsed = updateTaskDefinitionSchema.safeParse(req.body);
  if (!parsed.success)
    return res
      .status(400)
      .json({ error: "invalid_body", details: parsed.error.flatten() });
  const existing = await TaskDefinition.findOne({ id: taskId });
  if (!existing) return res.status(404).json({ error: "task_not_found" });
  const effectiveCategory =
    parsed.data.category || existing.category || "custom";
  const effectiveActionUrl =
    parsed.data.actionUrl !== undefined
      ? parsed.data.actionUrl
      : existing.actionUrl || "";
  if (ACTION_TASK_CATEGORIES.has(effectiveCategory) && !effectiveActionUrl) {
    return res
      .status(400)
      .json({ error: "action_url_required_for_action_task" });
  }
  const next = { ...parsed.data };
  next.expiresAt = new Date(
    new Date(existing.createdAt).getTime() + TASK_LIFETIME_MS,
  );
  const rewardPoints = parsed.data.rewardPoints ?? parsed.data.reward;
  if (rewardPoints !== undefined) {
    next.reward = Number(rewardPoints);
    next.rewardPoints = Number(rewardPoints);
  }
  if (next.status && next.published === undefined) {
    next.published = next.status === "active";
  }
  if (next.published !== undefined && !next.status) {
    next.status = next.published ? "active" : "inactive";
  }
  const updated = await TaskDefinition.findOneAndUpdate(
    { id: taskId },
    { $set: next },
    { new: true },
  );
  if (!updated) return res.status(404).json({ error: "task_not_found" });
  res.json({ ok: true, taskDefinition: updated });
}

export async function deleteTaskDefinition(req, res) {
  const taskId = String(req.params.taskId || "").toLowerCase();
  const deleted = await TaskDefinition.findOneAndDelete({ id: taskId });
  if (!deleted) return res.status(404).json({ error: "task_not_found" });
  res.json({ ok: true });
}

export async function suspendUser(req, res) {
  const parsed = suspendUserSchema.safeParse(req.body);
  if (!parsed.success)
    return res
      .status(400)
      .json({ error: "invalid_body", details: parsed.error.flatten() });
  const until = new Date(Date.now() + parsed.data.durationHours * 3600000);
  const user = await User.findOneAndUpdate(
    { wallet: parsed.data.wallet },
    { $set: { accountStatus: "suspended", suspendedUntil: until } },
    { new: true },
  );
  if (!user) return res.status(404).json({ error: "user_not_found" });
  res.json({ ok: true, user });
}

export async function reactivateUser(req, res) {
  const parsed = userWalletSchema.safeParse(req.body);
  if (!parsed.success)
    return res
      .status(400)
      .json({ error: "invalid_body", details: parsed.error.flatten() });
  const user = await User.findOneAndUpdate(
    { wallet: parsed.data.wallet },
    { $set: { accountStatus: "active", suspendedUntil: null } },
    { new: true },
  );
  if (!user) return res.status(404).json({ error: "user_not_found" });
  res.json({ ok: true, user });
}

export async function addUserBdBalance(req, res) {
  const parsed = addBdBalanceSchema.safeParse(req.body);
  if (!parsed.success)
    return res
      .status(400)
      .json({ error: "invalid_body", details: parsed.error.flatten() });
  const user = await User.findOneAndUpdate(
    { wallet: parsed.data.wallet },
    { $inc: { bdBalance: parsed.data.amount } },
    { new: true },
  ).select("wallet bdBalance level");
  if (!user) return res.status(404).json({ error: "user_not_found" });
  res.json({ ok: true, user, added: parsed.data.amount });
}

export async function reduceUserBdBalance(req, res) {
  const parsed = addBdBalanceSchema.safeParse(req.body); // Assuming same schema
  if (!parsed.success)
    return res
      .status(400)
      .json({ error: "invalid_body", details: parsed.error.flatten() });

  const { wallet, amount } = parsed.data;

  // 1. First, find the user to check their current balance
  const user = await User.findOne({ wallet });
  if (!user) return res.status(404).json({ error: "user_not_found" });

  // 2. Check if user has enough balance
  if (user.bdBalance < amount) {
    return res.status(400).json({ error: "insufficient_balance" });
  }

  // 3. Perform the update
  const updatedUser = await User.findOneAndUpdate(
    { wallet },
    { $inc: { bdBalance: -amount } }, // Subtract the amount
    { new: true },
  ).select("wallet bdBalance level");

  res.json({ ok: true, user: updatedUser, deducted: amount });
}

export async function deleteUser(req, res) {
  const parsed = userWalletSchema.safeParse(req.body);
  if (!parsed.success)
    return res
      .status(400)
      .json({ error: "invalid_body", details: parsed.error.flatten() });
  const wallet = parsed.data.wallet;
  await Promise.all([
    Task.deleteMany({ wallet }),
    Payment.deleteMany({ wallet }),
    GameSession.deleteMany({ wallet }),
    User.deleteOne({ wallet }),
  ]);
  res.json({ ok: true });
}

export async function getTreasureRewardState(_req, res) {
  let state = await TreasureRewardState.findOne({
    key: TREASURE_REWARD_STATE_KEY,
  });
  if (!state) {
    state = await TreasureRewardState.findOneAndUpdate(
      { key: TREASURE_REWARD_STATE_KEY },
      {
        $setOnInsert: {
          key: TREASURE_REWARD_STATE_KEY,
          maxEligible: DEFAULT_MAX_ELIGIBLE_TREASURE_USERS,
          eligibleWallets: [],
          closed: false,
          closedAt: null,
        },
      },
      { upsert: true, new: true },
    );
  }

  const eligibleWallets = Array.isArray(state.eligibleWallets)
    ? state.eligibleWallets
    : [];
  const maxEligible = Number(
    state.maxEligible || DEFAULT_MAX_ELIGIBLE_TREASURE_USERS,
  );
  const qualifiedCount = eligibleWallets.length;
  const closed = Boolean(state.closed || qualifiedCount >= maxEligible);
  const completedSessions = await GameSession.find({
    $or: [
      { seasonEligible: true },
      {
        $expr: {
          $gte: [
            { $size: { $ifNull: ["$seasonTreasures", []] } },
            { $ifNull: ["$requiredTreasures", 6] },
          ],
        },
      },
    ],
  }).select("wallet");
  const completedWallets = [
    ...new Set(
      completedSessions.map((s) => String(s.wallet || "").toLowerCase()),
    ),
  ];

  res.json({
    key: state.key,
    maxEligible,
    qualifiedCount,
    eligibleWallets,
    completedCount: completedWallets.length,
    completedWallets,
    closed,
    closedAt: state.closedAt,
    updatedAt: state.updatedAt,
  });
}
