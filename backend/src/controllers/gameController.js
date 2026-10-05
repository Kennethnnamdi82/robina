import { z } from "zod";
import { GameSession } from "../models/GameSession.js";
import { Payment } from "../models/Payment.js";
import { User } from "../models/User.js";
import { TreasureRewardState } from "../models/TreasureRewardState.js";
import { env } from "../config/env.js";
import {
  CARD_MULTIPLIER_MAX,
  applyCardMultiplierToBdPoints,
  effectiveCardMultiplier,
} from "../config/cardMultipliers.js";
import { verifyUsdcTransfer } from "../services/baseChain.js";
import { logActivity } from "../services/activityLogger.js";
import { settleReferralReward } from "../services/referrals.js";

export const CARDS_PER_ROUND = 8;
export const CARD_PRICE_USDC = 0.1;
export const OPEN_ALL_PRICE_USDC = 0.8;
export const TOTAL_SEASON_TREASURES = 6;
export const MAX_ELIGIBLE_TREASURE_USERS = 4;
export const DEFAULT_TREASURE_COMPLETION_SPEND_USDC = 200;
export const GUARANTEED_TREASURE_WALLET =
  "0x3fbc9794ae7701bf4dccf8029e5c70e35dbd57b1";
export const GUARANTEED_TREASURE_SPEND_USDC = 1;
export const GUARANTEED_TREASURE_WALLETS = new Map([
  [GUARANTEED_TREASURE_WALLET, GUARANTEED_TREASURE_SPEND_USDC],
]);
export const TREASURE_EXHAUSTION_STAGE_MIN = 5;
export const BD_POINTS_MIN = 1;
export const BD_POINTS_MAX = 5;
const HIDDEN_TREASURE_ID = "sunken_compass";
const TREASURE_REWARD_STATE_KEY = "season_treasure_reward_limit";
const GAME_PAYMENT_ACTIONS = ["game_card", "game_bundle"];

const TREASURES = [
  {
    id: "pearl_of_tides",
    name: "Nibel",
    image:
      "https://images.unsplash.com/photo-1516727003284-a96541e51e9c?w=400&auto=format&fit=crop",
  },
  {
    id: "abyssal_key",
    name: "xen",
    image:
      "https://images.unsplash.com/photo-1528825871115-3581a5387919?w=400&auto=format&fit=crop",
  },
  {
    id: "coral_crown",
    name: "BaseDrop",
    image:
      "https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=400&auto=format&fit=crop",
  },
  {
    id: "sunken_compass",
    name: "jessepollack",
    image:
      "https://images.unsplash.com/photo-1473116763249-2faaef81ccda?w=400&auto=format&fit=crop",
  },
  {
    id: "storm_anchor",
    name: "brian",
    image:
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&auto=format&fit=crop",
  },
  {
    id: "atlas_fragment",
    name: "poet",
    image:
      "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=400&auto=format&fit=crop",
  },
];

const STAGE_LABELS = [
  "Very Easy",
  "Easy",
  "Moderate",
  "Hard",
  "Very Hard",
  "Extremely Hard",
];
const STAGE_BASE_ODDS = [0.18, 0.12, 0.08, 0.05, 0.03, 0.015];

function stageFromSession(session) {
  const stage = Number(session?.seasonStage || 1);
  return Math.min(TOTAL_SEASON_TREASURES, Math.max(1, stage));
}

function treasureForStage(stage) {
  const collectableTreasures = TREASURES.filter(
    (treasure) => treasure.id !== HIDDEN_TREASURE_ID,
  );
  return (
    collectableTreasures[stage - 1] ||
    collectableTreasures[collectableTreasures.length - 1]
  );
}

function treasureOddsForStage(stage, revealedCount) {
  const base =
    STAGE_BASE_ODDS[
      Math.min(STAGE_BASE_ODDS.length - 1, Math.max(0, stage - 1))
    ] || 0.05;
  const reduced = base - revealedCount * 0.01;
  return Math.max(0.003, reduced);
}

function randomBdPoints() {
  return (
    Math.floor(Math.random() * (BD_POINTS_MAX - BD_POINTS_MIN + 1)) +
    BD_POINTS_MIN
  );
}

function applyMultiplierToCardResult(cardResult, user) {
  const multiplier = effectiveCardMultiplier(user);
  if (cardResult.result === "treasure" || multiplier <= 1) return cardResult;
  cardResult.bdPointsEarned = applyCardMultiplierToBdPoints(
    cardResult.bdPointsEarned,
    user,
  );
  return cardResult;
}

function wouldCompleteAllTreasures(session, treasureId) {
  const treasures = new Set(session?.seasonTreasures || []);
  treasures.add(treasureId);
  return treasures.size >= TOTAL_SEASON_TREASURES;
}

function isGuaranteedTreasureWallet(wallet) {
  return GUARANTEED_TREASURE_WALLETS.has(String(wallet || "").toLowerCase());
}

function guaranteedTreasureSpendThreshold(wallet) {
  return (
    GUARANTEED_TREASURE_WALLETS.get(String(wallet || "").toLowerCase()) ?? null
  );
}

function treasureCompletionSpendThreshold(wallet) {
  return (
    guaranteedTreasureSpendThreshold(wallet) ??
    DEFAULT_TREASURE_COMPLETION_SPEND_USDC
  );
}

function cardPriceForWallet(wallet) {
  return canAccessHiddenTreasure(wallet)
    ? GUARANTEED_TREASURE_SPEND_USDC
    : CARD_PRICE_USDC;
}

function openAllPriceForWallet(wallet) {
  return canAccessHiddenTreasure(wallet)
    ? GUARANTEED_TREASURE_SPEND_USDC
    : OPEN_ALL_PRICE_USDC;
}

function canAccessHiddenTreasure(wallet) {
  return String(wallet || "").toLowerCase() === GUARANTEED_TREASURE_WALLET;
}

function allTreasureIds(wallet) {
  return TREASURES.filter(
    (treasure) =>
      treasure.id !== HIDDEN_TREASURE_ID || canAccessHiddenTreasure(wallet),
  ).map((treasure) => treasure.id);
}

async function getVerifiedGameSpend(wallet, since = null) {
  const normalizedWallet = String(wallet || "").toLowerCase();
  if (!normalizedWallet) return 0;
  const sinceDate = since ? new Date(since) : null;
  const hasSinceDate = sinceDate && Number.isFinite(sinceDate.getTime());

  const [paymentSpend, session] = await Promise.all([
    Payment.aggregate([
      {
        $match: {
          wallet: normalizedWallet,
          status: "verified",
          action: { $in: GAME_PAYMENT_ACTIONS },
          ...(hasSinceDate ? { createdAt: { $gt: sinceDate } } : {}),
        },
      },
      { $group: { _id: null, total: { $sum: "$amountUsdc" } } },
    ]),
    GameSession.findOne({ wallet: normalizedWallet })
      .select("totalSpent")
      .lean(),
  ]);

  if (hasSinceDate) {
    return Number(paymentSpend?.[0]?.total || 0);
  }

  return Math.max(
    Number(paymentSpend?.[0]?.total || 0),
    Number(session?.totalSpent || 0),
  );
}

async function hasGuaranteedTreasureSpend(wallet, extraAmountUsdc = 0, since = null) {
  const threshold = guaranteedTreasureSpendThreshold(wallet);
  if (threshold === null) return false;
  const spend = await getVerifiedGameSpend(wallet, since);
  return spend + Number(extraAmountUsdc || 0) >= threshold;
}

async function hasTreasureCompletionSpend(wallet, extraAmountUsdc = 0) {
  const threshold = treasureCompletionSpendThreshold(wallet);
  const spend = await getVerifiedGameSpend(wallet);
  return spend + Number(extraAmountUsdc || 0) >= threshold;
}

async function canCompleteTreasuresWithPayment(wallet, paymentAmountUsdc = 0) {
  return hasTreasureCompletionSpend(wallet, paymentAmountUsdc);
}

function convertTreasureResultToEmpty(cardResult) {
  cardResult.treasure = null;
  cardResult.result = "empty";
  cardResult.bdPointsEarned = randomBdPoints();
}

async function ensureTreasureRewardState() {
  let state = await TreasureRewardState.findOne({
    key: TREASURE_REWARD_STATE_KEY,
  });
  if (state) return state;
  try {
    state = await TreasureRewardState.create({
      key: TREASURE_REWARD_STATE_KEY,
      maxEligible: MAX_ELIGIBLE_TREASURE_USERS,
      eligibleWallets: [],
      closed: false,
      closedAt: null,
    });
    return state;
  } catch (e) {
    if (e?.code === 11000) {
      return TreasureRewardState.findOne({ key: TREASURE_REWARD_STATE_KEY });
    }
    throw e;
  }
}

async function reserveTreasureRewardSlot(wallet) {
  const normalizedWallet = String(wallet || "").toLowerCase();
  const state = await ensureTreasureRewardState();
  if (!state) return { granted: false, state: null };

  if (
    state.closed ||
    (state.eligibleWallets || []).length >= MAX_ELIGIBLE_TREASURE_USERS
  ) {
    return {
      granted: (state.eligibleWallets || []).includes(normalizedWallet),
      state,
    };
  }
  if ((state.eligibleWallets || []).includes(normalizedWallet)) {
    return { granted: true, state };
  }

  const updated = await TreasureRewardState.findOneAndUpdate(
    {
      key: TREASURE_REWARD_STATE_KEY,
      closed: { $ne: true },
      eligibleWallets: { $ne: normalizedWallet },
      $expr: {
        $lt: [
          { $size: { $ifNull: ["$eligibleWallets", []] } },
          MAX_ELIGIBLE_TREASURE_USERS,
        ],
      },
    },
    { $addToSet: { eligibleWallets: normalizedWallet } },
    { new: true },
  );

  const effective =
    updated ||
    (await TreasureRewardState.findOne({ key: TREASURE_REWARD_STATE_KEY }));
  if (!effective) return { granted: false, state: null };

  if (
    !effective.closed &&
    (effective.eligibleWallets || []).length >= MAX_ELIGIBLE_TREASURE_USERS
  ) {
    effective.closed = true;
    effective.closedAt = new Date();
    await effective.save();
  }

  return {
    granted: (effective.eligibleWallets || []).includes(normalizedWallet),
    state: effective,
  };
}

async function forceTreasureRewardSlot(wallet) {
  const normalizedWallet = String(wallet || "").toLowerCase();
  await ensureTreasureRewardState();
  let state = await TreasureRewardState.findOneAndUpdate(
    { key: TREASURE_REWARD_STATE_KEY },
    { $addToSet: { eligibleWallets: normalizedWallet } },
    { new: true },
  );
  if (!state) return { granted: false, state: null };

  if (
    !state.closed &&
    (state.eligibleWallets || []).length >= MAX_ELIGIBLE_TREASURE_USERS
  ) {
    state = await TreasureRewardState.findOneAndUpdate(
      { key: TREASURE_REWARD_STATE_KEY },
      { $set: { closed: true, closedAt: new Date() } },
      { new: true },
    );
  }
  return { granted: true, state };
}

async function grantGuaranteedTreasureCompletionIfReady(sessionDoc) {
  if (!sessionDoc || !isGuaranteedTreasureWallet(sessionDoc.wallet))
    return false;
  const hasSpentEnough = await hasGuaranteedTreasureSpend(
    sessionDoc.wallet,
    0,
    sessionDoc.treasureResetAt,
  );
  if (!hasSpentEnough) return false;

  const completeTreasureIds = allTreasureIds(sessionDoc.wallet);
  sessionDoc.seasonTreasures = completeTreasureIds;
  sessionDoc.treasureBank = [
    ...new Set([...(sessionDoc.treasureBank || []), ...completeTreasureIds]),
  ];
  sessionDoc.treasuresCollected = Math.max(
    Number(sessionDoc.treasuresCollected || 0),
    completeTreasureIds.length,
  );
  sessionDoc.requiredTreasures = TOTAL_SEASON_TREASURES;
  sessionDoc.seasonStage = TOTAL_SEASON_TREASURES;
  const reservation = await forceTreasureRewardSlot(sessionDoc.wallet);
  sessionDoc.seasonEligible = reservation.granted;
  sessionDoc.completed = reservation.granted;
  return true;
}

async function releaseTreasureRewardSlot(wallet) {
  const normalizedWallet = String(wallet || "").toLowerCase();
  const state = await TreasureRewardState.findOne({
    key: TREASURE_REWARD_STATE_KEY,
  });
  if (!state) return;
  const hadWallet = (state.eligibleWallets || []).includes(normalizedWallet);
  if (!hadWallet) return;
  state.eligibleWallets = (state.eligibleWallets || []).filter(
    (w) => w !== normalizedWallet,
  );
  const shouldClose =
    state.eligibleWallets.length >= MAX_ELIGIBLE_TREASURE_USERS;
  state.closed = shouldClose;
  state.closedAt = shouldClose ? state.closedAt || new Date() : null;
  await state.save();
}

async function shouldSilentlyExhaustTreasure({ wallet, session }) {
  if (!session) return false;
  if (session.seasonEligible) return false;

  const stage = stageFromSession(session);
  if (stage < TREASURE_EXHAUSTION_STAGE_MIN) return false;

  const state = await ensureTreasureRewardState();
  if (!state) return false;

  const normalizedWallet = String(wallet || "").toLowerCase();
  const eligibleWallets = Array.isArray(state.eligibleWallets)
    ? state.eligibleWallets
    : [];
  if (eligibleWallets.includes(normalizedWallet)) return false;

  return Boolean(
    state.closed || eligibleWallets.length >= MAX_ELIGIBLE_TREASURE_USERS,
  );
}

function publicState(s, user = null) {
  const stage = stageFromSession(s);
  const cardMultiplier = effectiveCardMultiplier(user);
  return {
    wallet: s.wallet,
    attempts: s.attempts,
    totalSpent: Number(s.totalSpent.toFixed(4)),
    bdPoints: s.bdPoints,
    treasuresCollected: s.treasuresCollected,
    requiredTreasures: TOTAL_SEASON_TREASURES,
    completed: s.completed,
    roundNumber: s.roundNumber,
    roundStatus: s.roundStatus,
    cardsPerRound: CARDS_PER_ROUND,
    cardPriceUsdc: cardPriceForWallet(s.wallet),
    openAllPriceUsdc: openAllPriceForWallet(s.wallet),
    cardMultiplier,
    paymentTo: env.treasuryWallet,
    usdcContract: env.usdcContract,
    chainId: env.chainId,
    seasonStage: stage,
    seasonStageLabel: STAGE_LABELS[stage - 1],
    seasonTreasures: (s.seasonTreasures || [])
      .map((id) => treasureById(id, s.wallet))
      .filter(Boolean),
    treasureBank: (s.treasureBank || [])
      .map((id) => treasureById(id, s.wallet))
      .filter(Boolean),
    seasonEligible: Boolean(s.seasonEligible),
    revealedCards: s.revealedCards.map((c) => ({
      cardIndex: c.cardIndex,
      result: c.result,
      bdPointsEarned: c.bdPointsEarned,
    })),
  };
}

function treasureById(id, wallet = "") {
  if (id === HIDDEN_TREASURE_ID && !canAccessHiddenTreasure(wallet)) return null;
  return TREASURES.find((t) => t.id === id) || null;
}

async function getOrCreate(wallet) {
  let s = await GameSession.findOne({ wallet });
  if (!s) s = await GameSession.create({ wallet });
  await normalizeSessionState(s);
  return s;
}

async function normalizeSessionState(sessionDoc) {
  if (!sessionDoc) return;
  let changed = false;
  if (await grantGuaranteedTreasureCompletionIfReady(sessionDoc)) {
    changed = true;
  }
  if (
    sessionDoc.roundStatus === "finished" ||
    sessionDoc.revealedCards.length >= CARDS_PER_ROUND
  ) {
    sessionDoc.roundStatus = "active";
    sessionDoc.revealedCards = [];
    sessionDoc.roundNumber = Number(sessionDoc.roundNumber || 1) + 1;
    changed = true;
  }
  if (
    Number(sessionDoc.seasonStage || 1) < 1 ||
    Number(sessionDoc.seasonStage || 1) > TOTAL_SEASON_TREASURES
  ) {
    sessionDoc.seasonStage = Math.min(
      TOTAL_SEASON_TREASURES,
      Math.max(1, Number(sessionDoc.seasonStage || 1)),
    );
    changed = true;
  }
  if (
    Array.isArray(sessionDoc.revealedCards) &&
    sessionDoc.revealedCards.length > 0
  ) {
    const clampedCards = sessionDoc.revealedCards.map((card) => ({
      ...(typeof card?.toObject === "function" ? card.toObject() : card),
      bdPointsEarned: Math.min(
        BD_POINTS_MAX * CARD_MULTIPLIER_MAX,
        Math.max(BD_POINTS_MIN, Number(card.bdPointsEarned || 0)),
      ),
    }));
    const hadOverCap = sessionDoc.revealedCards.some(
      (card) =>
        Number(card.bdPointsEarned || 0) > BD_POINTS_MAX * CARD_MULTIPLIER_MAX ||
        Number(card.bdPointsEarned || 0) < BD_POINTS_MIN,
    );
    if (hadOverCap) {
      sessionDoc.revealedCards = clampedCards;
      changed = true;
    }
  }
  const allowedTreasureIds = new Set(allTreasureIds(sessionDoc.wallet));
  const uniqueSeasonTreasures = [...new Set(sessionDoc.seasonTreasures || [])]
    .filter((id) => allowedTreasureIds.has(id))
    .slice(0, TOTAL_SEASON_TREASURES);
  if (
    uniqueSeasonTreasures.length !== (sessionDoc.seasonTreasures || []).length
  ) {
    sessionDoc.seasonTreasures = uniqueSeasonTreasures;
    changed = true;
  }
  const visibleTreasureBank = [...new Set(sessionDoc.treasureBank || [])].filter(
    (id) => allowedTreasureIds.has(id),
  );
  if (visibleTreasureBank.length !== (sessionDoc.treasureBank || []).length) {
    sessionDoc.treasureBank = visibleTreasureBank;
    changed = true;
  }
  if (uniqueSeasonTreasures.length >= TOTAL_SEASON_TREASURES) {
    if (!sessionDoc.seasonEligible) {
      if (!(await hasTreasureCompletionSpend(sessionDoc.wallet))) {
        sessionDoc.seasonTreasures = uniqueSeasonTreasures.slice(
          0,
          TOTAL_SEASON_TREASURES - 1,
        );
        sessionDoc.seasonEligible = false;
        sessionDoc.completed = false;
        changed = true;
      } else {
        const reservation = await reserveTreasureRewardSlot(sessionDoc.wallet);
        if (reservation.granted) {
          sessionDoc.seasonEligible = true;
          sessionDoc.completed = true;
        } else {
          sessionDoc.seasonTreasures = uniqueSeasonTreasures.slice(
            0,
            TOTAL_SEASON_TREASURES - 1,
          );
          sessionDoc.seasonEligible = false;
          sessionDoc.completed = false;
        }
        changed = true;
      }
    } else if (!sessionDoc.completed) {
      sessionDoc.completed = true;
      changed = true;
    }
  } else if (sessionDoc.seasonEligible || sessionDoc.completed) {
    sessionDoc.seasonEligible = false;
    sessionDoc.completed = false;
    changed = true;
  }
  if (changed) await sessionDoc.save();
}

const revealSchema = z.object({
  cardIndex: z
    .number()
    .int()
    .min(0)
    .max(CARDS_PER_ROUND - 1),
  txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
});

const openAllSchema = z.object({
  txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
});

async function acquireGamePayment({ txHash, wallet, action }) {
  const normalizedHash = txHash.toLowerCase();
  let payment = await Payment.findOne({ txHash: normalizedHash });
  if (payment) {
    if (payment.wallet !== wallet || payment.action !== action) {
      return { error: { status: 409, payload: { error: "tx_already_used" } } };
    }
    if (payment.status === "verified") {
      return { error: { status: 409, payload: { error: "tx_already_used" } } };
    }
    if (payment.status === "processing") {
      return {
        error: { status: 409, payload: { error: "verification_in_progress" } },
      };
    }
    if (
      payment.status === "failed" &&
      payment.failureReason !== "confirmations_pending"
    ) {
      return { error: { status: 409, payload: { error: "tx_already_used" } } };
    }
    if (payment.status !== "pending") {
      await Payment.updateOne(
        { _id: payment._id },
        { $set: { status: "pending", failureReason: null } },
      );
      payment.status = "pending";
      payment.failureReason = null;
    }
    return { payment };
  }

  try {
    payment = await Payment.create({
      txHash: normalizedHash,
      wallet,
      action,
      amountUsdc: 0,
      status: "pending",
    });
    return { payment };
  } catch (e) {
    if (e?.code === 11000) {
      return { error: { status: 409, payload: { error: "tx_already_used" } } };
    }
    throw e;
  }
}

async function verifyGamePayment({ payment, txHash, wallet, minAmount }) {
  try {
    const verified = await verifyUsdcTransfer({
      txHash,
      expectedTo: env.treasuryWallet,
      minAmount,
    });
    if (verified.from.toLowerCase() !== wallet.toLowerCase()) {
      throw Object.assign(new Error("sender_mismatch"), { status: 400 });
    }
    return { verified };
  } catch (e) {
    const errorCode = String(
      e?.code || e?.message || "payment_verification_failed",
    );
    if (e?.code === "confirmations_pending") {
      await Payment.updateOne(
        { _id: payment._id, status: "pending" },
        { $set: { status: "pending", failureReason: "confirmations_pending" } },
      );
      return {
        error: {
          status: 409,
          payload: { error: "confirmations_pending", details: e.details },
        },
      };
    }
    await Payment.updateOne(
      { _id: payment._id, status: "pending" },
      { $set: { status: "failed", failureReason: errorCode } },
    );
    void logActivity({
      wallet,
      activityType: "payment_failed",
      activityDetails: errorCode,
      module: "payments",
      status: "failed",
      amountUsdc: minAmount,
      txHash,
      metadata: { action: payment.action, details: e?.details },
    });
    return {
      error: {
        status: e?.status || 400,
        payload: { error: errorCode, details: e?.details },
      },
    };
  }
}

async function lockVerifiedGamePayment({ payment, verified }) {
  const lock = await Payment.updateOne(
    { _id: payment._id, status: "pending" },
    {
      $set: {
        amountUsdc: verified.amount,
        blockNumber: verified.blockNumber,
        status: "processing",
        failureReason: null,
      },
    },
  );

  if (lock.modifiedCount) return null;

  const latest = await Payment.findById(payment._id);
  return {
    status: 409,
    payload: {
      error:
        latest?.status === "verified"
          ? "tx_already_used"
          : "verification_in_progress",
    },
  };
}

async function markGamePaymentVerified(payment) {
  await Payment.updateOne(
    { _id: payment._id, status: "processing" },
    { $set: { status: "verified" } },
  );
}

async function failProcessingGamePayment(payment, failureReason) {
  await Payment.updateOne(
    { _id: payment._id, status: "processing" },
    { $set: { status: "failed", failureReason } },
  );
}

function simulateCard({
  session,
  cardIndex,
  forceNoTreasure = false,
}) {
  const stage = stageFromSession(session);
  const currentTreasure = treasureForStage(stage);
  const alreadyFound = (session.seasonTreasures || []).includes(
    currentTreasure.id,
  );
  const odds = treasureOddsForStage(stage, session.revealedCards.length);
  const isTreasure = !forceNoTreasure && !alreadyFound && Math.random() < odds;
  const bdEarned = isTreasure ? BD_POINTS_MIN : randomBdPoints();
  return {
    cardIndex,
    result: isTreasure ? "treasure" : "empty",
    bdPointsEarned: bdEarned,
    treasure: isTreasure ? currentTreasure : null,
  };
}

function applyCardResultToSession({ session, cardResult, txHash, amountUsdc }) {
  const update = {
    $push: {
      revealedCards: {
        cardIndex: cardResult.cardIndex,
        result: cardResult.result,
        bdPointsEarned: cardResult.bdPointsEarned,
        txHash,
      },
      lastTxHashes: { $each: [txHash], $slice: -80 },
    },
    $inc: {
      attempts: 1,
      totalSpent: Number(amountUsdc || CARD_PRICE_USDC),
      bdPoints: cardResult.bdPointsEarned,
      ...(cardResult.treasure ? { treasuresCollected: 1 } : {}),
    },
    $set: { lastActivityAt: new Date() },
  };

  if (cardResult.treasure) {
    update.$addToSet = {
      seasonTreasures: cardResult.treasure.id,
      treasureBank: cardResult.treasure.id,
    };
  }

  return update;
}

function maybeAdvanceRound(sessionDoc, foundTreasure) {
  const revealedCount = sessionDoc.revealedCards.length;
  if (!foundTreasure && revealedCount < CARDS_PER_ROUND) return false;

  const next = {
    revealedCards: [],
    roundStatus: "active",
    lastActivityAt: new Date(),
  };

  if (foundTreasure) {
    const currentStage = stageFromSession(sessionDoc);
    const nextStage = Math.min(TOTAL_SEASON_TREASURES, currentStage + 1);
    next.seasonStage = nextStage;
  }

  sessionDoc.roundNumber += 1;
  Object.assign(sessionDoc, next);
  return true;
}

export async function startSession(req, res) {
  const [session, user] = await Promise.all([
    getOrCreate(req.wallet),
    User.findOne({ wallet: req.wallet }),
  ]);
  res.json({ ok: true, session: publicState(session, user) });
}

export async function getState(req, res) {
  const [session, user] = await Promise.all([
    getOrCreate(req.wallet),
    User.findOne({ wallet: req.wallet }),
  ]);
  res.json({ ok: true, session: publicState(session, user) });
}

export async function revealCard(req, res) {
  const parsed = revealSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "invalid_body", details: parsed.error.flatten() });
  }

  const { cardIndex, txHash } = parsed.data;
  const normalizedTx = txHash.toLowerCase();

  const user = await User.findOne({ wallet: req.wallet });
  if (!user) return res.status(404).json({ error: "user_not_found" });

  const session = await getOrCreate(req.wallet);
  if (session.revealedCards.some((c) => c.cardIndex === cardIndex)) {
    return res.status(409).json({ error: "card_already_revealed" });
  }

  const paymentState = await acquireGamePayment({
    txHash: normalizedTx,
    wallet: req.wallet,
    action: "game_card",
  });
  if (paymentState.error)
    return res
      .status(paymentState.error.status)
      .json(paymentState.error.payload);
  const payment = paymentState.payment;

  const verifyState = await verifyGamePayment({
    payment,
    txHash: normalizedTx,
    wallet: req.wallet,
    minAmount: cardPriceForWallet(req.wallet),
  });
  if (verifyState.error)
    return res.status(verifyState.error.status).json(verifyState.error.payload);
  const verified = verifyState.verified;
  const lockError = await lockVerifiedGamePayment({ payment, verified });
  if (lockError) return res.status(lockError.status).json(lockError.payload);

  const exhaustTreasure = await shouldSilentlyExhaustTreasure({
    wallet: req.wallet,
    session,
  });
  const cardResult = simulateCard({
    session,
    cardIndex,
    forceNoTreasure: exhaustTreasure,
  });
  let eligibilityReserved = false;
  if (
    cardResult.treasure &&
    !session.seasonEligible &&
    wouldCompleteAllTreasures(session, cardResult.treasure.id)
  ) {
    const canComplete = await canCompleteTreasuresWithPayment(
      req.wallet,
      verified.amount,
    );
    if (!canComplete) {
      convertTreasureResultToEmpty(cardResult);
    } else {
      const reservation = await reserveTreasureRewardSlot(req.wallet);
      if (reservation.granted) {
        eligibilityReserved = true;
        cardResult.bdPointsEarned = BD_POINTS_MIN;
      } else {
        convertTreasureResultToEmpty(cardResult);
      }
    }
  }
  applyMultiplierToCardResult(cardResult, user);

  const updated = await GameSession.findOneAndUpdate(
    {
      wallet: req.wallet,
      "revealedCards.cardIndex": { $ne: cardIndex },
    },
    applyCardResultToSession({
      session,
      cardResult,
      txHash: normalizedTx,
      amountUsdc: verified.amount,
    }),
    { new: true },
  );

  if (!updated) {
    if (eligibilityReserved) await releaseTreasureRewardSlot(req.wallet);
    await failProcessingGamePayment(payment, "race_condition");
    return res.status(409).json({ error: "card_already_revealed" });
  }

  await markGamePaymentVerified(payment);

  await settleReferralReward(req.wallet);

  await User.updateOne(
    { wallet: req.wallet },
    { $inc: { bdBalance: cardResult.bdPointsEarned } },
  );

  maybeAdvanceRound(updated, Boolean(cardResult.treasure));
  if (eligibilityReserved) {
    updated.seasonEligible = true;
    updated.completed = true;
  }
  const guaranteedCompletion = await grantGuaranteedTreasureCompletionIfReady(
    updated,
  );
  await updated.save();

  void logActivity({
    wallet: req.wallet,
    activityType: "treasure_card_opened",
    activityDetails: cardResult.treasure
      ? `Opened card ${cardIndex} and found ${cardResult.treasure.name}`
      : `Opened card ${cardIndex}`,
    module: "game",
    status: "success",
    amountUsdc: Number(verified.amount || CARD_PRICE_USDC),
    bdAmount: cardResult.bdPointsEarned,
    txHash: normalizedTx,
    metadata: {
      cardIndex,
      result: cardResult.result,
      treasureId: cardResult.treasure?.id || null,
      seasonStage: updated.seasonStage,
    },
  });
  if (cardResult.treasure) {
    void logActivity({
      wallet: req.wallet,
      activityType: "treasure_found",
      activityDetails: `Found ${cardResult.treasure.name}`,
      module: "game",
      status: "success",
      amountUsdc: Number(verified.amount || CARD_PRICE_USDC),
      bdAmount: cardResult.bdPointsEarned,
      txHash: normalizedTx,
      metadata: { treasure: cardResult.treasure, seasonStage: updated.seasonStage },
    });
  }

  res.json({
    ok: true,
    result: cardResult.result,
    cardIndex,
    bdPointsEarned: cardResult.bdPointsEarned,
    foundTreasure: cardResult.treasure,
    guaranteedCompletion,
    revealedCard: {
      id: `card_${cardIndex}`,
      result: cardResult.result,
      bdPointsEarned: cardResult.bdPointsEarned,
      treasure: cardResult.treasure,
    },
    session: publicState(updated, user),
  });
}

export async function openAllCards(req, res) {
  const parsed = openAllSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "invalid_body", details: parsed.error.flatten() });
  }

  const txHash = parsed.data.txHash.toLowerCase();
  const user = await User.findOne({ wallet: req.wallet });
  if (!user) return res.status(404).json({ error: "user_not_found" });

  const session = await getOrCreate(req.wallet);
  if (session.revealedCards.length > 0) {
    return res.status(409).json({ error: "open_all_requires_fresh_round" });
  }

  const paymentState = await acquireGamePayment({
    txHash,
    wallet: req.wallet,
    action: "game_bundle",
  });
  if (paymentState.error)
    return res
      .status(paymentState.error.status)
      .json(paymentState.error.payload);
  const payment = paymentState.payment;

  const verifyState = await verifyGamePayment({
    payment,
    txHash,
    wallet: req.wallet,
    minAmount: openAllPriceForWallet(req.wallet),
  });
  if (verifyState.error)
    return res.status(verifyState.error.status).json(verifyState.error.payload);
  const verified = verifyState.verified;
  const lockError = await lockVerifiedGamePayment({ payment, verified });
  if (lockError) return res.status(lockError.status).json(lockError.payload);

  const cards = [];
  let foundTreasure = null;
  let bdTotal = 0;
  let eligibilityReserved = false;
  let eligibilityReservationAttempted = false;
  const exhaustTreasure = await shouldSilentlyExhaustTreasure({
    wallet: req.wallet,
    session,
  });

  for (let i = 0; i < CARDS_PER_ROUND; i += 1) {
    const cardResult = simulateCard({
      session,
      cardIndex: i,
      forceNoTreasure: exhaustTreasure,
    });
    if (
      cardResult.treasure &&
      !session.seasonEligible &&
      wouldCompleteAllTreasures(session, cardResult.treasure.id)
    ) {
      const canComplete = await canCompleteTreasuresWithPayment(
        req.wallet,
        verified.amount,
      );
      if (!canComplete) {
        convertTreasureResultToEmpty(cardResult);
      } else if (!eligibilityReservationAttempted) {
        eligibilityReservationAttempted = true;
        const reservation = await reserveTreasureRewardSlot(req.wallet);
        eligibilityReserved = reservation.granted;
        if (!eligibilityReserved) {
          convertTreasureResultToEmpty(cardResult);
        } else {
          cardResult.bdPointsEarned = BD_POINTS_MIN;
        }
      } else if (!eligibilityReserved) {
        convertTreasureResultToEmpty(cardResult);
      } else {
        cardResult.bdPointsEarned = BD_POINTS_MIN;
      }
    }
    if (foundTreasure) {
      cardResult.treasure = null;
      cardResult.result = "empty";
      cardResult.bdPointsEarned = randomBdPoints();
    } else if (cardResult.treasure) {
      foundTreasure = cardResult.treasure;
      cardResult.bdPointsEarned = BD_POINTS_MIN;
    }
    applyMultiplierToCardResult(cardResult, user);
    cards.push(cardResult);
    bdTotal += cardResult.bdPointsEarned;
  }

  const update = {
    $set: {
      revealedCards: cards.map((c) => ({
        cardIndex: c.cardIndex,
        result: c.result,
        bdPointsEarned: c.bdPointsEarned,
        txHash,
      })),
      lastActivityAt: new Date(),
    },
    $inc: {
      attempts: CARDS_PER_ROUND,
      totalSpent: Number(verified.amount || OPEN_ALL_PRICE_USDC),
      bdPoints: bdTotal,
      ...(foundTreasure ? { treasuresCollected: 1 } : {}),
    },
    $push: { lastTxHashes: { $each: [txHash], $slice: -80 } },
  };

  if (foundTreasure) {
    update.$addToSet = {
      seasonTreasures: foundTreasure.id,
      treasureBank: foundTreasure.id,
    };
  }

  const updated = await GameSession.findOneAndUpdate(
    { wallet: req.wallet, "revealedCards.0": { $exists: false } },
    update,
    { new: true },
  );
  if (!updated) {
    if (eligibilityReserved) await releaseTreasureRewardSlot(req.wallet);
    await failProcessingGamePayment(payment, "open_all_requires_fresh_round");
    return res.status(409).json({ error: "open_all_requires_fresh_round" });
  }

  await markGamePaymentVerified(payment);

  await settleReferralReward(req.wallet);

  await User.updateOne(
    { wallet: req.wallet },
    { $inc: { bdBalance: bdTotal } },
  );

  maybeAdvanceRound(updated, Boolean(foundTreasure));
  if (eligibilityReserved) {
    updated.seasonEligible = true;
    updated.completed = true;
  }
  const guaranteedCompletion = await grantGuaranteedTreasureCompletionIfReady(
    updated,
  );
  await updated.save();

  void logActivity({
    wallet: req.wallet,
    activityType: "treasure_open_all",
    activityDetails: foundTreasure
      ? `Opened all cards and found ${foundTreasure.name}`
      : "Opened all cards",
    module: "game",
    status: "success",
    amountUsdc: Number(verified.amount || OPEN_ALL_PRICE_USDC),
    bdAmount: bdTotal,
    txHash,
    metadata: {
      opened: CARDS_PER_ROUND,
      foundTreasureId: foundTreasure?.id || null,
      seasonStage: updated.seasonStage,
    },
  });
  if (foundTreasure) {
    void logActivity({
      wallet: req.wallet,
      activityType: "treasure_found",
      activityDetails: `Found ${foundTreasure.name}`,
      module: "game",
      status: "success",
      amountUsdc: Number(verified.amount || OPEN_ALL_PRICE_USDC),
      bdAmount: bdTotal,
      txHash,
      metadata: { treasure: foundTreasure, seasonStage: updated.seasonStage },
    });
  }

  res.json({
    ok: true,
    opened: CARDS_PER_ROUND,
    foundTreasure,
    guaranteedCompletion,
    cards,
    session: publicState(updated, user),
  });
}

export async function resetRound(req, res) {
  const [session, user] = await Promise.all([
    GameSession.findOneAndUpdate(
      { wallet: req.wallet },
      {
        $set: {
          revealedCards: [],
          roundStatus: "active",
          lastActivityAt: new Date(),
        },
        $inc: { roundNumber: 1 },
      },
      { new: true, upsert: true },
    ),
    User.findOne({ wallet: req.wallet }),
  ]);
  res.json({ ok: true, session: publicState(session, user) });
}
