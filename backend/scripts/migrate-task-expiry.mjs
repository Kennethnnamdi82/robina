import mongoose from "mongoose";
import { connectMongo } from "../src/db/mongo.js";
import { TaskDefinition } from "../src/models/TaskDefinition.js";

function parseArgs(argv) {
  const apply = argv.includes("--apply");
  const hoursFlag = argv.find((arg) => arg.startsWith("--hours="));
  const parsedHours = hoursFlag ? Number(hoursFlag.split("=")[1]) : 24;
  const hours = Number.isFinite(parsedHours) && parsedHours > 0 ? parsedHours : 24;
  return { apply, hours };
}

function effectiveStatus(def) {
  if (def.status) return def.status;
  return def.published === false ? "inactive" : "active";
}

async function run() {
  const { apply, hours } = parseArgs(process.argv.slice(2));
  const now = Date.now();

  await connectMongo();

  const candidates = await TaskDefinition.find({
    category: { $ne: "x_post" },
    $or: [{ expiresAt: null }, { expiresAt: { $exists: false } }],
  }).select("id title category status published createdAt expiresAt");

  const eligible = [];
  for (const def of candidates) {
    const status = effectiveStatus(def);
    if (status !== "active") continue;
    const baseTime = def.createdAt ? new Date(def.createdAt).getTime() : now;
    eligible.push({
      _id: def._id,
      id: def.id,
      title: def.title,
      category: def.category || "custom",
      createdAt: def.createdAt || null,
      expiresAt: new Date(baseTime + hours * 60 * 60 * 1000),
    });
  }

  console.log(`[task-expiry-migration] candidates=${candidates.length}`);
  console.log(`[task-expiry-migration] eligible_for_update=${eligible.length}`);
  if (!eligible.length) {
    console.log("[task-expiry-migration] nothing to update");
    await mongoose.disconnect();
    return;
  }

  for (const item of eligible.slice(0, 20)) {
    console.log(
      `- ${item.id} | category=${item.category} | createdAt=${item.createdAt || "n/a"} | expiresAt=${item.expiresAt.toISOString()}`,
    );
  }
  if (eligible.length > 20) {
    console.log(`[task-expiry-migration] ...and ${eligible.length - 20} more`);
  }

  if (!apply) {
    console.log("[task-expiry-migration] dry-run only. Re-run with --apply to persist.");
    await mongoose.disconnect();
    return;
  }

  const ops = eligible.map((item) => ({
    updateOne: {
      filter: { _id: item._id },
      update: { $set: { expiresAt: item.expiresAt } },
    },
  }));
  const result = await TaskDefinition.bulkWrite(ops, { ordered: false });
  console.log(
    `[task-expiry-migration] applied. matched=${result.matchedCount || 0} modified=${result.modifiedCount || 0}`,
  );

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error("[task-expiry-migration] failed", err);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore disconnect failure
  }
  process.exit(1);
});
