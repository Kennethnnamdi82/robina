import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    txHash: { type: String, required: true, unique: true, lowercase: true, index: true },
    wallet: { type: String, required: true, lowercase: true, index: true },
    action: { type: String, enum: ['upgrade', 'instant_claim', 'auto_claim', 'game_card', 'game_bundle', 'multiplier'], required: true },
    targetLevel: { type: String, default: null },
    targetMultiplier: { type: Number, default: null },
    amountUsdc: { type: Number, required: true, default: 0 },
    blockNumber: { type: Number },
    status: { type: String, enum: ['pending', 'processing', 'verified', 'failed'], default: 'pending', index: true },
    failureReason: { type: String, default: null },
  },
  { timestamps: true }
);

export const Payment = mongoose.model('Payment', paymentSchema);
