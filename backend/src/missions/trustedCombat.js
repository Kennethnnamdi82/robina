import mongoose from 'mongoose';
import { MissionCombatEvent, MissionLife, MissionSession } from './models.js';

/**
 * Internal settlement boundary for an independently verified combat event.
 * Never call this from a route with browser-supplied hit/pickup information:
 * liveAuthority calls it after the shared server simulation resolves a hit.
 */
export async function applyVerifiedCombatEvent(sessionId, event,owner) {
  if (!mongoose.isValidObjectId(sessionId) || !event ||
      !/^[\w:-]{1,120}$/.test(event.id) ||
      !['damage', 'firstAid'].includes(event.kind) ||
      (event.kind === 'damage' && (!Number.isInteger(event.amount) || event.amount < 1 || event.amount > 200)) ||
      (event.kind === 'firstAid' && event.amount !== 25)) {
    throw new Error('invalid_trusted_combat_event');
  }
  const transaction = await mongoose.startSession();
  try {
    let result;
    await transaction.withTransaction(async () => {
      const mission = await MissionSession.findById(sessionId).session(transaction);
      if (!mission) throw new Error('mission_not_found');
      if(owner&&(mission.authorityOwner!==owner||mission.authorityLeaseUntil<=new Date()))throw new Error('mission_ownership_lost');
      const duplicate = await MissionCombatEvent.exists({ sessionId, eventId: event.id }).session(transaction);
      if (duplicate) { result = { applied: false, health: mission.health, status: mission.status }; return; }
      if (mission.status !== 'active' || mission.health <= 0) throw new Error('mission_not_active');
      const before = mission.health;
      const next = event.kind === 'damage'
        ? Math.max(0, before - event.amount)
        : Math.min(mission.maxHealth, before + 25);
      // A full-health kit is not consumed: the game can leave it available.
      if (event.kind === 'firstAid' && next === before) {
        result = { applied: false, health: before, status: mission.status };
        return;
      }
      await MissionCombatEvent.create([{ sessionId, eventId: event.id, kind: event.kind, amount: event.amount }], { session: transaction });
      mission.health = next;
      if (next === 0) {
        const now = new Date();
        mission.status = 'failed';
        mission.localOutcome = 'failure';
        mission.endedAt = now;
        await MissionLife.updateOne({ playerId: mission.playerId }, {
          $inc: { deaths: 1 },
          $set: { recoveryUntil: null },
          $setOnInsert: { playerId: mission.playerId },
        }, { upsert: true, session: transaction });
      }
      await mission.save({ session: transaction });
      result = { applied: true, health: next, status: mission.status, damageOrHeal: Math.abs(next - before) };
    });
    return result;
  } catch (error) {
    // Two identical trusted events can race on the unique ledger index. The
    // loser observes the committed state instead of turning a retry into 500.
    if (error?.code === 11000 && await MissionCombatEvent.exists({ sessionId, eventId: event.id })) {
      const mission = await MissionSession.findById(sessionId).select('health status').lean();
      return { applied: false, health: mission?.health, status: mission?.status };
    }
    throw error;
  } finally {
    await transaction.endSession();
  }
}
