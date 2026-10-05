import { z } from "zod";
import { User } from "../models/User.js";
import { Task } from "../models/Task.js";
import { TaskDefinition } from "../models/TaskDefinition.js";
import { settleReferralReward } from "../services/referrals.js";
import { logActivity } from "../services/activityLogger.js";

const submitSchema = z.object({
  taskId: z.string().min(1).max(64),
  proof: z.string().max(500).optional(),
});

const autoFlowSchema = z.object({
  taskId: z.string().min(1).max(64),
});
const TASK_LIFETIME_MS = 24 * 60 * 60 * 1000;

function toTaskKey(wallet, taskId) {
  const w = String(wallet || "").toLowerCase().trim();
  const t = String(taskId || "").toLowerCase().trim();
  return w && t ? `${w}:${t}` : null;
}

function normalizeProofLink(raw, { require = false, requireX = false } = {}) {
  const value = String(raw || "").trim();
  if (!value) {
    if (require) return { error: "proof_required" };
    return { value: "" };
  }
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  let parsed;
  try {
    parsed = new URL(withScheme);
  } catch {
    return { error: "invalid_proof_url" };
  }
  if (!/^https?:$/i.test(parsed.protocol)) return { error: "invalid_proof_url" };
  if (requireX) {
    const host = parsed.hostname.toLowerCase();
    const isX = host === "x.com" || host.endsWith(".x.com");
    const isTwitter = host === "twitter.com" || host.endsWith(".twitter.com");
    if (!isX && !isTwitter) return { error: "invalid_x_post_link" };
  }
  return { value: parsed.toString() };
}

function isDefinitionActive(def, now = new Date()) {
  if (!def) return false;
  if (def.status && def.status !== "active") return false;
  if (def.published === false) return false;
  const createdAtMs = def.createdAt ? new Date(def.createdAt).getTime() : 0;
  const expiresAtMs = createdAtMs ? createdAtMs + TASK_LIFETIME_MS : 0;
  if (!expiresAtMs) return false;
  return expiresAtMs > now.getTime();
}

function serializeDefinition(def) {
  const rewardPoints = Number(def.rewardPoints ?? def.reward ?? 0);
  const taskType = def.taskType || "temporary_engagement";
  const status = def.status || (def.published === false ? "inactive" : "active");
  const createdAtMs = def.createdAt ? new Date(def.createdAt).getTime() : 0;
  const expiresAt = createdAtMs ? new Date(createdAtMs + TASK_LIFETIME_MS) : null;
  const createdAt = def.createdAt || null;
  return {
    id: def.id,
    title: def.title,
    description: def.description || "",
    category: def.category || "custom",
    actionUrl: def.actionUrl || "",
    taskType,
    task_type: taskType,
    reward: rewardPoints,
    rewardPoints,
    reward_points: rewardPoints,
    createdAt,
    created_at: createdAt,
    expiresAt,
    expires_at: expiresAt,
    status,
  };
}

async function resolveTaskDefinition(taskId) {
  const normalizedTaskId = String(taskId || "").toLowerCase();
  const def = await TaskDefinition.findOne({ id: normalizedTaskId }).select(
    "id title description reward rewardPoints category actionUrl taskType expiresAt status published createdAt",
  );
  if (!def) return null;
  if (!isDefinitionActive(def)) return null;
  return serializeDefinition(def);
}

function isDailyPostTask(definition) {
  return definition?.category === "x_post";
}

export async function getCatalogue(_req, res) {
  const defs = await TaskDefinition.find({})
    .sort({ createdAt: -1 })
    .select(
      "id title description reward rewardPoints category actionUrl taskType expiresAt status published createdAt",
    );
  const activeDefs = defs.filter((def) => isDefinitionActive(def));
  res.json({
    tasks: activeDefs.map((def) => serializeDefinition(def)),
  });
}

export async function getMine(req, res) {
  const tasks = await Task.find({ wallet: req.wallet }).sort({ updatedAt: -1 });
  res.json({ tasks });
}

export async function submitTask(req, res) {
  const parsed = submitSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_body" });

  const def = await resolveTaskDefinition(parsed.data.taskId);
  if (!def) return res.status(404).json({ error: "unknown_task" });
  if (!isDailyPostTask(def)) return res.status(409).json({ error: "use_instant_claim_flow" });

  const normalizedProof = normalizeProofLink(parsed.data.proof, {
    require: def.category === "x_post",
    requireX: def.category === "x_post",
  });
  if (normalizedProof.error) return res.status(400).json({ error: normalizedProof.error });

  const existing = await Task.findOne({ wallet: req.wallet, taskId: def.id });
  if (existing?.status === "complete") return res.status(409).json({ error: "already_completed" });
  if (existing?.status === "pending") return res.status(409).json({ error: "already_pending" });

  const task = existing
    ? await Task.findOneAndUpdate(
        { _id: existing._id },
        {
          $set: {
            taskKey: toTaskKey(req.wallet, def.id),
            status: "pending",
            reward: def.rewardPoints,
            proof: normalizedProof.value || "",
            reviewRequired: true,
            claimReadyAt: null,
            verificationMethod: "manual_review",
          },
        },
        { new: true },
      )
    : await Task.create({
        wallet: req.wallet,
        taskId: def.id,
        taskKey: toTaskKey(req.wallet, def.id),
        status: "pending",
        reward: def.rewardPoints,
        proof: normalizedProof.value || "",
        reviewRequired: true,
        claimReadyAt: null,
        verificationMethod: "manual_review",
      });

  res.json({ ok: true, task, notifyAdmin: true });
}

export async function startTask(req, res) {
  const parsed = autoFlowSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: "invalid_body" });

  const def = await resolveTaskDefinition(parsed.data.taskId);
  if (!def) return res.status(404).json({ error: "unknown_task" });
  if (isDailyPostTask(def)) return res.status(409).json({ error: "use_daily_post_flow" });

  const existing = await Task.findOne({ wallet: req.wallet, taskId: def.id });
  if (existing?.status === "complete") return res.status(409).json({ error: "already_completed" });

  const claimReadyAt = new Date();
  const task = existing
    ? await Task.findOneAndUpdate(
        { _id: existing._id },
        {
          $set: {
            taskKey: toTaskKey(req.wallet, def.id),
            status: "pending",
            reward: def.rewardPoints,
            reviewRequired: false,
            claimReadyAt: null,
            verificationMethod: "instant_claim",
            proof: "",
          },
        },
        { new: true },
      )
    : await Task.create({
        wallet: req.wallet,
        taskId: def.id,
        taskKey: toTaskKey(req.wallet, def.id),
        status: "pending",
        reward: def.rewardPoints,
        reviewRequired: false,
        claimReadyAt: null,
        verificationMethod: "instant_claim",
        proof: "",
      });

  return res.json({ ok: true, task, claimAvailableAt: task?.claimReadyAt || null });
}

export async function claimTask(req, res) {
  const parsed = autoFlowSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: "invalid_body" });

  const normalizedTaskId = String(parsed.data.taskId || "").toLowerCase();
  const def = await resolveTaskDefinition(normalizedTaskId);
  if (!def) return res.status(404).json({ error: "unknown_task" });
  if (isDailyPostTask(def)) return res.status(409).json({ error: "manual_review_required" });

  let task = await Task.findOne({ wallet: req.wallet, taskId: normalizedTaskId });
  if (!task) {
    const claimReadyAt = new Date();
    task = await Task.create({
      wallet: req.wallet,
      taskId: normalizedTaskId,
      taskKey: toTaskKey(req.wallet, normalizedTaskId),
      status: "pending",
      reward: def.rewardPoints,
      reviewRequired: false,
      claimReadyAt,
      verificationMethod: "instant_claim",
      proof: "",
    });
  }
  if (task.status === "complete") return res.status(409).json({ error: "already_completed" });
  if (task.reviewRequired) {
    task = await Task.findOneAndUpdate(
      { _id: task._id, taskId: normalizedTaskId },
      { $set: { taskKey: toTaskKey(req.wallet, normalizedTaskId), reviewRequired: false, verificationMethod: "instant_claim", claimReadyAt: null } },
      { new: true },
    ) || task;
  }

  const updatedTask = await Task.findOneAndUpdate(
    { _id: task._id, status: "pending" },
    { $set: { status: "complete" } },
    { new: true },
  );
  if (!updatedTask) return res.status(409).json({ error: "already_completed" });

  const reward = Number(task.reward || 0);
  const userUpdate = await User.updateOne(
    { wallet: req.wallet, completedTasks: { $ne: normalizedTaskId } },
    { $inc: { bdBalance: reward }, $addToSet: { completedTasks: normalizedTaskId } },
  );
  if (userUpdate.modifiedCount > 0) {
    await settleReferralReward(req.wallet);
  }

  void logActivity({
    wallet: req.wallet,
    activityType: "social_task_completed",
    activityDetails: `${normalizedTaskId} completed for ${reward} BD`,
    module: "tasks",
    status: "success",
    bdAmount: reward,
    metadata: { taskId: normalizedTaskId, verificationMethod: updatedTask.verificationMethod },
  });

  return res.json({ ok: true, task: updatedTask, reward });
}

export async function startAutoTask(req, res) {
  const parsed = autoFlowSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: "invalid_body" });

  const def = await resolveTaskDefinition(parsed.data.taskId);
  if (!def) return res.status(404).json({ error: "unknown_task" });
  if (isDailyPostTask(def)) return res.status(409).json({ error: "use_daily_post_flow" });

  const existing = await Task.findOne({ wallet: req.wallet, taskId: def.id });
  if (existing?.status === "complete") return res.status(409).json({ error: "already_completed" });

  const claimReadyAt = new Date();
  const task = existing
    ? await Task.findOneAndUpdate(
        { _id: existing._id },
        {
          $set: {
            taskKey: toTaskKey(req.wallet, def.id),
            status: "pending",
            reward: def.rewardPoints,
            reviewRequired: false,
            claimReadyAt: null,
            verificationMethod: "instant_claim",
            proof: "",
          },
        },
        { new: true },
      )
    : await Task.create({
        wallet: req.wallet,
        taskId: def.id,
        taskKey: toTaskKey(req.wallet, def.id),
        status: "pending",
        reward: def.rewardPoints,
        reviewRequired: false,
        claimReadyAt: null,
        verificationMethod: "instant_claim",
        proof: "",
      });

  return res.json({ ok: true, task, claimAvailableAt: task?.claimReadyAt || null });
}

export async function claimAutoTask(req, res) {
  const parsed = autoFlowSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: "invalid_body" });

  const normalizedTaskId = String(parsed.data.taskId || "").toLowerCase();
  const def = await resolveTaskDefinition(normalizedTaskId);
  if (!def) return res.status(404).json({ error: "unknown_task" });
  if (isDailyPostTask(def)) return res.status(409).json({ error: "manual_review_required" });

  let task = await Task.findOne({ wallet: req.wallet, taskId: normalizedTaskId });
  if (!task) {
    task = await Task.create({
      wallet: req.wallet,
      taskId: normalizedTaskId,
      taskKey: toTaskKey(req.wallet, normalizedTaskId),
      status: "pending",
      reward: def.rewardPoints,
      reviewRequired: false,
      claimReadyAt: null,
      verificationMethod: "instant_claim",
      proof: "",
    });
  }
  if (task.status === "complete") return res.status(409).json({ error: "already_completed" });
  if (task.reviewRequired) {
    task = await Task.findOneAndUpdate(
      { _id: task._id, taskId: normalizedTaskId },
      { $set: { taskKey: toTaskKey(req.wallet, normalizedTaskId), reviewRequired: false, verificationMethod: "instant_claim", claimReadyAt: null } },
      { new: true },
    ) || task;
  }

  const updatedTask = await Task.findOneAndUpdate(
    { _id: task._id, status: "pending" },
    { $set: { status: "complete" } },
    { new: true },
  );
  if (!updatedTask) return res.status(409).json({ error: "already_completed" });

  const reward = Number(task.reward || 0);
  await User.updateOne(
    { wallet: req.wallet, completedTasks: { $ne: normalizedTaskId } },
    { $inc: { bdBalance: reward }, $addToSet: { completedTasks: normalizedTaskId } },
  );
  await settleReferralReward(req.wallet);

  void logActivity({
    wallet: req.wallet,
    activityType: "social_task_completed",
    activityDetails: `${normalizedTaskId} completed for ${reward} BD`,
    module: "tasks",
    status: "success",
    bdAmount: reward,
    metadata: { taskId: normalizedTaskId, verificationMethod: updatedTask.verificationMethod },
  });

  return res.json({ ok: true, task: updatedTask, reward });
}
