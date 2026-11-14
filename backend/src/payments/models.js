import mongoose from 'mongoose';

// Receipt-only inbox. No orders, balances, entitlements or customer/payment data.
// MongoDB's built-in _id index is the cross-process/restart deduplication key.
const schema = new mongoose.Schema({
  _id: { type: String, required: true, maxlength: 256 },
  type: { type: String, required: true, immutable: true, maxlength: 128 },
  organizationId: { type: String, required: true, immutable: true, maxlength: 256 },
  outcome: { type: String, required: true, immutable: true,
    enum: ['payment_succeeded', 'payment_failed', 'checkout_expired', 'ignored'] },
  purpose: { type: String, enum: ['receipt_only'], default: 'receipt_only', immutable: true },
  payloadSha256: { type: String, required: true, immutable: true, match: /^[a-f0-9]{64}$/ },
  receivedAt: { type: Date, default: Date.now, immutable: true },
}, { versionKey: false, writeConcern: { w: 'majority', j: true, wtimeout: 5000 } });

export const BachsWebhookEvent = mongoose.model('BachsWebhookEvent', schema);
