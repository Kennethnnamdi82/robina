import mongoose from 'mongoose';

const seasonSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    status: { type: String, enum: ['active', 'ended', 'upcoming'], required: true, default: 'active', index: true },
    startDate: { type: Date, required: true, default: () => new Date() },
    endDate: { type: Date, required: true },
    renewalDurationMs: { type: Number, min: 60 * 1000, default: 30 * 24 * 60 * 60 * 1000 },
    topN: { type: Number, required: true, min: 1, max: 10000 },
    totalPayout: { type: Number, required: true, min: 0 },
    endedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

seasonSchema.index({ status: 1, startDate: -1 });

export const Season = mongoose.model('Season', seasonSchema);
