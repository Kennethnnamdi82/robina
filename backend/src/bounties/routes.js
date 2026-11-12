import { Router } from 'express';
import { z } from 'zod';
import { web3Middleware } from '../middleware/auth.js';
import { tryAdminCookie } from '../controllers/adminAuthController.js';
import { RevokedToken } from '../models/RevokedToken.js';
import { User } from '../models/User.js';
import { env } from '../config/env.js';
import { BountyTask, BountyAccount, BountySubmission, BountyWithdrawal, BountyLedger, BountyNotice, BountyAudit } from './models.js';
import { parse, objectId, pageInput, wire, fail } from './validation.js';
import * as service from './service.js';
import { activeTaskFilter, adminList, adminSummary, adminPlayer, playerHistoryModels } from './adminQueries.js';

const asyncRoute = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const send = (res, data, status = 200) => res.status(status).json(wire(data));
const id = req => parse(objectId, req.params.id);
const page = req => parse(pageInput, req.query);
const mutationGuard = (req, _res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) &&
      (req.get('x-rivals-bounty') !== '1' || !req.is('application/json'))) {
    return next(Object.assign(new Error('bounty_csrf_protection'), { code: 'bounty_csrf_protection', status: 403 }));
  }
  next();
};
export async function requireBountyAdmin(req, res, next) {
  try {
    const admin = tryAdminCookie(req);
    if (!admin || admin.role !== 'admin' || admin.sub !== 'admin' ||
        !env.adminEmail || admin.email?.trim().toLowerCase() !== env.adminEmail) return res.status(401).json({ error: 'unauthenticated' });
    if (!admin.jti || await RevokedToken.exists({ jti: admin.jti })) return res.status(401).json({ error: 'invalid_admin_session' });
    req.bountyAdmin = admin.email.trim().toLowerCase();
    next();
  } catch (error) { next(error); }
}
const attachPlayer = asyncRoute(async (req, _res, next) => {
  const user = await User.findOne({ wallet: req.wallet }).select('_id');
  if (!user) fail('unauthenticated', 401);
  req.bountyPlayerId = user._id;
  next();
});
const limited = (kind, max) => asyncRoute(async (req, _res, next) => {
  await service.consumeRate(`${kind}:player:${req.bountyPlayerId}`, max);
  await service.consumeRate(`${kind}:ip:${service.hashIp(req.ip)}`, max * 5);
  next();
});
const emptyBody = req => parse(z.object({}).strict(), req.body);
const list = async (model, filter, req, projection) => {
  const pagination = page(req);
  const items = await service.paginate(model, filter, pagination, projection);
  return { items, nextBefore: items.length === pagination.limit ? String(items.at(-1)._id) : null };
};
async function taskParticipation(items, playerId) {
  const records = await BountySubmission.find({ playerId, taskId: { $in: items.map(task => task._id) } }).select('taskId status').lean();
  return items.map(task => ({ ...task, participation: records.find(row => String(row.taskId) === String(task._id)) || null }));
}
export function createBountyRoutes(chain) {
  const player = Router(), admin = Router();
  player.use(web3Middleware, attachPlayer, mutationGuard);
  admin.use(asyncRoute(requireBountyAdmin), mutationGuard);
  admin.use(asyncRoute(async (req, _res, next) => {
    if (req.method !== 'GET') await service.consumeRate(`admin:${req.bountyAdmin}`, 200);
    next();
  }));
  player.get('/tasks', asyncRoute(async (req, res) => {
    const result = await list(BountyTask, activeTaskFilter(), req);
    result.items = await taskParticipation(result.items, req.bountyPlayerId);
    send(res, result);
  }));
  player.get('/tasks/:id', asyncRoute(async (req, res) => {
    const task = await BountyTask.findOne({ _id: id(req), ...activeTaskFilter() }).setOptions({ useBigInt64: true }).lean();
    if (!task) fail('task_not_found', 404);
    send(res, (await taskParticipation([task], req.bountyPlayerId))[0]);
  }));
  player.post('/tasks/:id/submissions', limited('submission', 10), asyncRoute(async (req, res) => {
    const result = await service.submit(req.bountyPlayerId, id(req), req.body, service.hashIp(req.ip));
    send(res, await BountySubmission.findById(result._id).select(service.publicSubmissionFields).setOptions({ useBigInt64: true }).lean(), 201);
  }));
  player.get('/submissions', asyncRoute(async (req, res) => send(res,
    await list(BountySubmission, { playerId: req.bountyPlayerId }, req, service.publicSubmissionFields))));
  player.get('/wallet', asyncRoute(async (req, res) => send(res, {
    ...await service.wallet(req.bountyPlayerId), minimumWithdrawalMicros: '5000000', currency: 'USDC', chainId: 8453,
    payoutsEnabled: true, payoutMode: 'manual',
    pendingSubmissions: await BountySubmission.countDocuments({ playerId: req.bountyPlayerId, status: 'pending' }),
  })));
  player.put('/wallet/address', limited('address', 20), asyncRoute(async (req, res) => {
    const { address } = parse(z.object({ address: z.string().max(42) }).strict(), req.body);
    send(res, await service.saveAddress(req.bountyPlayerId, address));
  }));
  player.get('/ledger', asyncRoute(async (req, res) => send(res, await list(BountyLedger, { playerId: req.bountyPlayerId }, req))));
  player.get('/withdrawals', asyncRoute(async (req, res) => send(res,
    await list(BountyWithdrawal, { playerId: req.bountyPlayerId }, req, service.publicWithdrawalFields))));
  player.post('/withdrawals', limited('withdrawal', 10), asyncRoute(async (req, res) => {
    const result = await service.requestWithdrawal(req.bountyPlayerId, req.get('idempotency-key'), req.body);
    // Return only public projection, including on idempotent retries.
    send(res, await BountyWithdrawal.findById(result._id).select(service.publicWithdrawalFields).setOptions({ useBigInt64: true }).lean(), 201);
  }));
  player.get('/notifications', asyncRoute(async (req, res) => {
    const result = await list(BountyNotice, { $or: [{ playerId: req.bountyPlayerId }, { playerId: null }] }, req);
    const account = await service.wallet(req.bountyPlayerId);
    result.items = result.items.map(item => ({ ...item, read: item.createdAt <= account.notificationsReadAt }));
    send(res, result);
  }));
  player.post('/notifications/read', asyncRoute(async (req, res) => {
    emptyBody(req);
    await BountyAccount.updateOne({ playerId: req.bountyPlayerId },
      { $set: { notificationsReadAt: new Date() }, $setOnInsert: { playerId: req.bountyPlayerId } }, { upsert: true });
    send(res, { ok: true });
  }));
  admin.get('/summary', asyncRoute(async (_req, res) => send(res, { ...await adminSummary(true), payoutMode: 'manual' })));
  admin.get('/players', asyncRoute(async (req, res) => send(res, await adminList(BountyAccount, req.query))));
  admin.get('/players/:id', asyncRoute(async (req, res) => send(res, await adminPlayer(id(req)))));
  for (const [kind, model] of Object.entries(playerHistoryModels)) {
    admin.get(`/players/:id/${kind}`, asyncRoute(async (req, res) => send(res, await list(model, { playerId: id(req) }, req, '-ipHash'))));
  }
  admin.get('/tasks', asyncRoute(async (req, res) => send(res, await adminList(BountyTask, req.query))));
  admin.post('/tasks', asyncRoute(async (req, res) => send(res, await service.createTask(req.bountyAdmin, req.body), 201)));
  admin.put('/tasks/:id', asyncRoute(async (req, res) => send(res, await service.editTask(req.bountyAdmin, id(req), req.body))));
  admin.patch('/tasks/:id/status', asyncRoute(async (req, res) => send(res, await service.changeTaskStatus(req.bountyAdmin, id(req), req.body))));
  admin.get('/submissions', asyncRoute(async (req, res) => {
    send(res, await adminList(BountySubmission, { status: 'pending', ...req.query }));
  }));
  admin.get('/submissions/:id', asyncRoute(async (req, res) => {
    const submission = await BountySubmission.findById(id(req)).select('-ipHash').setOptions({ useBigInt64: true }).lean();
    if (!submission) fail('submission_not_found', 404);
    send(res, submission);
  }));
  admin.post('/submissions/:id/review', asyncRoute(async (req, res) => {
    const result = await service.reviewSubmission(req.bountyAdmin, id(req), req.body);
    send(res, await BountySubmission.findById(result._id).select('-ipHash').setOptions({ useBigInt64: true }).lean());
  }));
  admin.get('/withdrawals', asyncRoute(async (req, res) => {
    send(res, await adminList(BountyWithdrawal, req.query));
  }));
  admin.post('/withdrawals/:id/review', asyncRoute(async (req, res) => {
    const result = await service.reviewWithdrawal(req.bountyAdmin, id(req), req.body);
    send(res, await BountyWithdrawal.findById(result._id).setOptions({ useBigInt64: true }).lean());
  }));
  admin.post('/withdrawals/:id/paid', asyncRoute(async (req, res) => {
    const result = await service.markWithdrawalPaid(req.bountyAdmin, id(req), req.body);
    send(res, await BountyWithdrawal.findById(result._id).setOptions({ useBigInt64: true }).lean());
  }));
  // Retired even if old BOUNTY_PAYOUTS_ENABLED or private-key variables remain set.
  admin.post('/withdrawals/:id/execute', asyncRoute(async () => { fail('automatic_payouts_retired', 410); }));
  admin.post('/withdrawals/:id/reconcile', asyncRoute(async (req, res) => {
      emptyBody(req);
      const result = await service.reconcileWithdrawal(req.bountyAdmin, id(req), chain);
      // rawTransaction is intentionally excluded even for administrators.
      send(res, await BountyWithdrawal.findById(result._id).setOptions({ useBigInt64: true }).lean());
    }));
  admin.get('/audit', asyncRoute(async (req, res) => send(res, await list(BountyAudit, {}, req))));
  return { player, admin };
}
