import mongoose from 'mongoose';

/**
 * GameSession — Card Treasure Game
 * One document per wallet. Tracks lifetime stats AND the current 8-card round.
 *
 * Round model (per user answers):
 *   - Each round = 8 cards
 *   - Required treasures per season = 6
 *   - Round resets the GRID ONLY when all 8 cards are revealed
 *     (BD points, treasures collected, attempts, totalSpent are LIFETIME)
 */
const revealedCardSchema = new mongoose.Schema(
  {
    cardIndex: { type: Number, required: true, min: 0, max: 7 },
    result: { type: String, enum: ['treasure', 'empty'], required: true },
    bdPointsEarned: { type: Number, required: true, min: 1, max: 500 },
    txHash: { type: String, required: true },
    revealedAt: { type: Date, default: () => new Date() },
  },
  { _id: false }
);

const gameSessionSchema = new mongoose.Schema(
  {
    wallet: { type: String, required: true, unique: true, lowercase: true, index: true },

    // Lifetime stats
    attempts: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 }, // USDC
    bdPoints: { type: Number, default: 0 },
    treasuresCollected: { type: Number, default: 0 },
    requiredTreasures: { type: Number, default: 6 },
    completed: { type: Boolean, default: false },

    // Current round
    roundNumber: { type: Number, default: 1 },
    roundStatus: { type: String, enum: ['active', 'finished'], default: 'active' },
    revealedCards: { type: [revealedCardSchema], default: [] }, // for current round only
    seasonStage: { type: Number, default: 1, min: 1, max: 6 },
    seasonTreasures: { type: [String], default: [] }, // this season only
    treasureBank: { type: [String], default: [] }, // permanent unlocks
    seasonEligible: { type: Boolean, default: false },
    treasureResetAt: { type: Date, default: null },

    // Anti-replay (last 50 hashes is enough; Payment table is the strict guard)
    lastTxHashes: { type: [String], default: [] },

    lastActivityAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
);

gameSessionSchema.index({ lastActivityAt: -1 });

export const GameSession = mongoose.model('GameSession', gameSessionSchema);
