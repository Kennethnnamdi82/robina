import mongoose from "mongoose";

const paymentClaimSchema = new mongoose.Schema(
  {
    chainId: { type: String, required: true },
    transactionHash: { type: String, required: true },
    wallet: { type: String, required: true, lowercase: true },
    paymentId: { type: String, required: true },
  },
  { timestamps: true },
);

paymentClaimSchema.index({ chainId: 1, transactionHash: 1 }, { unique: true });

export const PaymentClaim = mongoose.model("PaymentClaim", paymentClaimSchema);
