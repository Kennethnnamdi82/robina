import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    wallet: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true,
    },
    walletAddress: { type: String, default: null },
    authMethod: {
      type: String,
      enum: ["wallet_evm", "wallet_solana", "privy_google"],
      default: "wallet_evm",
    },
    chainType: { type: String, enum: ["evm", "solana", "none"], default: "evm" },
    privyUserId: { type: String, unique: true, sparse: true, index: true },
    email: { type: String, lowercase: true, trim: true, default: null },
    role: {
      type: String,
      default: "user",
      enum: ["user", "admin"],
    },
    bdBalance: { type: Number, default: 0 },
    level: { type: String, default: "Beginner" },
    cardMultiplier: { type: Number, default: 1, min: 1, max: 100 },
    lastClaimTime: { type: Date, default: () => new Date(0) },
    autoClaimActive: { type: Boolean, default: false },
    autoClaimExpiry: { type: Date, default: null },
    referralCode: { type: String, unique: true, index: true },
    referredBy: { type: String, default: null, lowercase: true },
    referralCount: { type: Number, default: 0 },
    referralRewardEligible: { type: Boolean, default: false }, // becomes true after first task + first paid USDC action
    completedTasks: { type: [String], default: [] },
    lastDailyTaskDate: { type: String, default: "" },
    boostUsesToday: { type: Number, default: 0 },
    lastBoostDate: { type: String, default: "" },
    nonce: { type: String, default: null }, // current SIWE nonce
    nonceIssuedAt: { type: Date, default: null },
    sessionVersion: { type: Number, default: 0 },
    accountStatus: {
      type: String,
      enum: ["active", "suspended"],
      default: "active",
      index: true,
    },
    suspendedUntil: { type: Date, default: null },
  },
  { timestamps: true },
);

export const User = mongoose.model("User", userSchema);
