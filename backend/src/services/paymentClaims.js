import { PaymentClaim } from "../models/PaymentClaim.js";

export async function claimPaymentTransaction({
  chainId,
  transactionHash,
  wallet,
  paymentId,
}) {
  try {
    const claim = await PaymentClaim.findOneAndUpdate(
      { chainId: String(chainId), transactionHash },
      {
        $setOnInsert: {
          chainId: String(chainId),
          transactionHash,
          wallet: String(wallet).toLowerCase(),
          paymentId: String(paymentId),
        },
      },
      { upsert: true, new: true },
    );
    return claim?.paymentId === String(paymentId) &&
      claim.wallet === String(wallet).toLowerCase();
  } catch (error) {
    if (error?.code === 11000) return false;
    throw error;
  }
}
