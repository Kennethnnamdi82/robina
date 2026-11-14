import mongoose from 'mongoose';
import { MissionSession, VerifiedMissionResult } from './models.js';
import { SCORE_VERSION, scoreVerifiedRun } from './score.js';

/** Internal-only settlement for a server-owned simulation, never an HTTP body. */
export async function settleVerifiedResult(sessionId, proof,owner) {
  if (!mongoose.isValidObjectId(sessionId) || !proof || !['success', 'failure'].includes(proof.outcome) ||
      proof.objectivesSatisfied !== (proof.outcome === 'success')) throw new Error('invalid_verified_result');
  const metrics = proof.metrics;
  if (!metrics || typeof metrics !== 'object') throw new Error('invalid_verified_stats');
  const transaction = await mongoose.startSession();
  try {
    let result;
    await transaction.withTransaction(async () => {
      const existing = await VerifiedMissionResult.findOne({ sessionId }).session(transaction);
      if (existing) { result = existing; return; }
      const mission = await MissionSession.findById(sessionId).session(transaction);
      if(owner&&mission&&(mission.authorityOwner!==owner||mission.authorityLeaseUntil<=new Date()))throw new Error('mission_ownership_lost');
      if (!mission || !['active', ...(proof.outcome === 'failure' ? ['failed'] : [])].includes(mission.status) ||
          proof.outcome === 'success' && mission.health <= 0) throw new Error('mission_not_active');
      const now = new Date();
      const wallSeconds = Math.max(1, Math.ceil((now.getTime() - (mission.startedAt??mission.createdAt).getTime()) / 1000));
      const durationSeconds = wallSeconds;
      if (proof.elapsedSeconds!==undefined&&proof.elapsedSeconds > wallSeconds + 2) throw new Error('impossible_mission_duration');
      const expected = { ...metrics, durationSeconds, remainingHealth: mission.health, maxHealth: mission.maxHealth };
      const rawScore = scoreVerifiedRun(expected);
      const firstCompletion = proof.outcome === 'success' && !await VerifiedMissionResult.exists({
        playerId: mission.playerId, missionId: mission.missionId, outcome: 'success', firstCompletion: true,
      }).session(transaction);
      const [created] = await VerifiedMissionResult.create([{
        playerId: mission.playerId, sessionId: mission._id, missionId: mission.missionId,
        outcome: proof.outcome, score: proof.outcome === 'success' ? rawScore : 0,
        scoreVersion: SCORE_VERSION, durationSeconds,
        enemiesDefeated: metrics.enemiesDefeated, shotsFired: metrics.shotsFired,
        successfulHits: metrics.successfulHits, remainingHealth: mission.health,
        optionalCompleted: metrics.optionalCompleted, firstCompletion: Boolean(firstCompletion),
        rewardEligible: Boolean(firstCompletion), verifiedAt: now,
      }], { session: transaction });
      mission.status = proof.outcome === 'success' ? 'verified_success' : 'verified_failure';
      mission.verifiedOutcome = proof.outcome;
      mission.integrity = 'verified';
      mission.endedAt = now;
      await mission.save({ session: transaction });
      result = created;
    });
    return result;
  } catch (error) {
    if (error?.code === 11000) {
      const existing = await VerifiedMissionResult.findOne({ sessionId });
      if (existing) return existing;
    }
    throw error;
  } finally {
    await transaction.endSession();
  }
}
