import { z } from 'zod';
import { getAddress, isAddress, zeroAddress } from 'viem';

export const MAX_MICROS = 9_000_000_000_000_000n;
export const MIN_WITHDRAWAL = 5_000_000n;
export const BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
export const micros = z.string().regex(/^(0|[1-9]\d{0,15})$/)
  .refine(value => BigInt(value) <= MAX_MICROS, 'Amount exceeds accounting limit');
const positiveMicros = micros.refine(value => BigInt(value) > 0n);
const text = (max) => z.string().trim().min(1).max(max);
export const objectId = z.string().regex(/^[a-f\d]{24}$/i);
export const taskInput = z.object({
  title: text(120), description: text(2000), platform: z.enum(['x', 'tiktok']),
  instructions: z.array(text(1000)).min(1).max(20), disclosure: text(1000),
  minimumEngagement: z.number().int().min(1).max(1_000_000_000),
  rewardMicros: positiveMicros, budgetMicros: positiveMicros,
  participationLimit: z.number().int().min(1).max(1_000_000),
  evidenceRequired: z.boolean(),
  startsAt: z.string().datetime().nullable().default(null),
  expiresAt: z.string().datetime().nullable().default(null),
}).strict().refine(v => BigInt(v.budgetMicros) >= BigInt(v.rewardMicros), 'Budget below reward')
  .refine(v => !v.startsAt || !v.expiresAt || new Date(v.startsAt) < new Date(v.expiresAt), 'Expiration must follow start');
export const taskStatusInput = z.object({ status: z.enum(['active', 'paused', 'closed']) }).strict();

export function fail(code, status = 409) {
  throw Object.assign(new Error(code), { code, status });
}
export function parse(schema, input) {
  const result = schema.safeParse(input);
  if (!result.success) fail('invalid_request', 400);
  return result.data;
}
export function normalizePost(platform, input) {
  let url;
  try { url = new URL(input); } catch { fail('invalid_post_url', 400); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) fail('invalid_post_url', 400);
  let match;
  if (platform === 'x' && ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'].includes(url.hostname)) {
    match = /^\/(?:[a-zA-Z0-9_]{1,15}\/status|i\/web\/status)\/([1-9]\d{0,24})\/?$/.exec(url.pathname);
    if (match) return { postKey: `x:${match[1]}`, postUrl: `https://x.com/i/web/status/${match[1]}` };
  }
  if (platform === 'tiktok' && ['tiktok.com', 'www.tiktok.com'].includes(url.hostname)) {
    match = /^\/@([a-zA-Z0-9_.]{1,24})\/video\/([1-9]\d{0,24})\/?$/.exec(url.pathname);
    if (match) return { postKey: `tiktok:${match[2]}`, postUrl: `https://www.tiktok.com/@${match[1].toLowerCase()}/video/${match[2]}` };
  }
  fail('invalid_post_url', 400);
}

// Links are retained as data only: never fetched, embedded or redirected by this service.
export function evidenceUrl(input) {
  if (!input) return '';
  let url;
  try { url = new URL(input); } catch { fail('invalid_evidence_url', 400); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port ||
      !/^(?:[a-z\d](?:[a-z\d-]*[a-z\d])?\.)+[a-z]{2,63}$/i.test(url.hostname) ||
      /(?:^|\.)(localhost|local|internal|test|invalid|example)$/i.test(url.hostname)) fail('invalid_evidence_url', 400);
  return url.href;
}
export function baseAddress(input) {
  if (!isAddress(input, { strict: true })) fail('invalid_base_address', 400);
  const address = getAddress(input);
  if ([zeroAddress.toLowerCase(), BASE_USDC.toLowerCase()].includes(address.toLowerCase())) fail('invalid_base_address', 400);
  return address;
}
export const submitInput = z.object({
  postUrl: text(2048), evidenceUrl: z.string().trim().max(2048).default(''),
  evidenceNotes: z.string().trim().max(1500).default(''), confirmed: z.literal(true),
  termsRevision: z.number().int().min(1).optional(),
}).strict();
export const reviewInput = z.discriminatedUnion('decision', [
  z.object({ decision: z.literal('approve'), verificationMethod: z.literal('manual'),
    ownershipVerified: z.literal(true), engagementVerified: z.literal(true),
    complianceVerified: z.literal(true), disclosureVerified: z.literal(true),
    observedEngagement: z.number().int().min(1).max(1_000_000_000),
    notes: text(2000), acknowledgeRisk: z.boolean().default(false),
  }).strict(),
  z.object({ decision: z.literal('reject'), reason: text(1500) }).strict(),
]);
export const withdrawalInput = z.object({
  amountMicros: positiveMicros.refine(v => BigInt(v) >= MIN_WITHDRAWAL),
  address: text(42), confirmed: z.literal(true),
}).strict();
export const withdrawalReviewInput = z.discriminatedUnion('decision', [
  z.object({ decision: z.literal('approve'), notes: text(2000), acknowledgeRisk: z.boolean().default(false) }).strict(),
  z.object({ decision: z.literal('reject'), reason: text(1500) }).strict(),
]);
export const idempotencyKey = z.string().regex(/^[a-zA-Z0-9_-]{16,100}$/);
export const pageInput = z.object({
  before: objectId.optional(), limit: z.coerce.number().int().min(1).max(100).default(30),
}).strict();
export function wire(value) {
  return JSON.parse(JSON.stringify(value, (_key, item) => typeof item === 'bigint' ? item.toString() : item));
}
