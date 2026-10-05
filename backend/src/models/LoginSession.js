import mongoose from "mongoose";

const loginSessionSchema = new mongoose.Schema(
  {
    wallet: { type: String, lowercase: true, index: true, required: true },
    ipAddress: { type: String, default: "Unknown" },
    country: { type: String, default: "Unknown", index: true },
    city: { type: String, default: "Unknown" },
    browser: { type: String, default: "Unknown" },
    deviceType: { type: String, default: "Unknown", index: true },
    operatingSystem: { type: String, default: "Unknown" },
    loginSource: { type: String, default: "Unknown", index: true },
    userAgent: { type: String, default: "Unknown" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

loginSessionSchema.index({ createdAt: -1 });
loginSessionSchema.index({ wallet: 1, createdAt: -1 });

export const LoginSession = mongoose.model("LoginSession", loginSessionSchema);
