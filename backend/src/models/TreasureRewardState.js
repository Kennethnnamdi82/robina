import mongoose from 'mongoose';

const treasureRewardStateSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    maxEligible: { type: Number, required: true, min: 1, default: 4 },
    eligibleWallets: { type: [String], default: [] },
    closed: { type: Boolean, default: false, index: true },
    closedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const TreasureRewardState = mongoose.model('TreasureRewardState', treasureRewardStateSchema);

