import { Season } from "../models/Season.js";

const DEFAULT_RENEWAL_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

function resolveRenewalDurationMs(season) {
  const explicit = Number(season.renewalDurationMs || 0);
  if (explicit > 0) return explicit;

  const startMs = new Date(season.startDate || 0).getTime();
  const endMs = new Date(season.endDate || 0).getTime();
  const derived = endMs - startMs;
  if (derived > 0) return derived;

  return DEFAULT_RENEWAL_DURATION_MS;
}

function nextEndDate(endDate, now, renewalDurationMs) {
  const nowMs = now.getTime();
  let endMs = new Date(endDate || now).getTime();
  if (!Number.isFinite(endMs)) endMs = nowMs;

  if (endMs <= nowMs) {
    const jumps = Math.floor((nowMs - endMs) / renewalDurationMs) + 1;
    endMs += jumps * renewalDurationMs;
  }

  return new Date(endMs);
}

export async function syncSeasonStates() {
  const now = new Date();

  await Season.updateMany(
    { status: "upcoming", startDate: { $lte: now } },
    { $set: { status: "active", endedAt: null } },
  );

  const expiredActive = await Season.find({
    status: "active",
    endDate: { $lte: now },
  });

  if (!expiredActive.length) return;

  await Promise.all(
    expiredActive.map(async (season) => {
      const renewalDurationMs = resolveRenewalDurationMs(season);
      season.renewalDurationMs = renewalDurationMs;
      season.endDate = nextEndDate(season.endDate, now, renewalDurationMs);
      season.endedAt = null;
      await season.save();
    }),
  );
}

