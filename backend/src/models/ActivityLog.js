import mongoose from "mongoose";

const activityLogSchema = new mongoose.Schema(
  {
    wallet: { type: String, lowercase: true, index: true, default: "" },
    username: { type: String, default: "Unknown" },
    activityType: { type: String, required: true, index: true },
    activityDetails: { type: String, default: "" },
    module: {
      type: String,
      enum: ["auth", "mining", "game", "payments", "tasks", "referrals", "admin", "system"],
      default: "system",
      index: true,
    },
    status: {
      type: String,
      enum: ["success", "failed", "pending", "info"],
      default: "success",
      index: true,
    },
    amountUsdc: { type: Number, default: 0 },
    bdAmount: { type: Number, default: 0 },
    txHash: { type: String, lowercase: true, default: null, index: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ wallet: 1, createdAt: -1 });

export const ActivityLog = mongoose.model("ActivityLog", activityLogSchema);
