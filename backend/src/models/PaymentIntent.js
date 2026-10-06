import mongoose from "mongoose";

const paymentIntentSchema = new mongoose.Schema(
  {
    intentId: { type: String, required: true, unique: true, index: true },
    wallet: { type: String, required: true, lowercase: true, index: true },
    senderAddress: { type: String, required: true },
    action: { type: String, required: true },
    targetLevel: { type: String, default: null },
    targetMultiplier: { type: Number, default: null },
    chainType: { type: String, enum: ["evm", "solana"], required: true },
    chainId: { type: String, required: true },
    assetType: { type: String, enum: ["native", "erc20", "spl"], required: true },
    assetAddress: { type: String, default: null },
    assetSymbol: { type: String, required: true },
    decimals: { type: Number, required: true },
    amount: { type: String, required: true },
    amountAtomic: { type: String, required: true },
    recipient: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    transactionHash: { type: String, default: null },
    status: {
      type: String,
      enum: ["pending", "verifying", "verified", "failed", "expired"],
      default: "pending",
      index: true,
    },
    verification: { type: mongoose.Schema.Types.Mixed, default: null },
    failureReason: { type: String, default: null },
  },
  { timestamps: true },
);

paymentIntentSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
paymentIntentSchema.index(
  { chainType: 1, chainId: 1, transactionHash: 1 },
  { unique: true, partialFilterExpression: { transactionHash: { $type: "string" } } },
);

export const PaymentIntent = mongoose.model("PaymentIntent", paymentIntentSchema);
