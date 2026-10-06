import mongoose from "mongoose";

// Nonces live separately from User so they remain one-time credentials even when
// a user changes wallets or has not yet been created.
const authNonceSchema = new mongoose.Schema(
  {
    nonce: { type: String, required: true, unique: true, index: true },
    address: { type: String, required: true, index: true },
    chainType: { type: String, enum: ["evm", "solana"], required: true },
    chainId: { type: String, required: true },
    domain: { type: String, required: true },
    uri: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// MongoDB removes expired challenges automatically. Verification still checks the
// timestamp because TTL cleanup is asynchronous.
authNonceSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const AuthNonce = mongoose.model("AuthNonce", authNonceSchema);
