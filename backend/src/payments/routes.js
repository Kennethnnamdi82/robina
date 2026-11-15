import {Router} from 'express';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {web3Middleware} from '../middleware/auth.js';
import {requireBountyAdmin} from '../bounties/routes.js';
import {consumeRate} from '../bounties/service.js';
import {User} from '../models/User.js';
import {StoreOrder,StoreLedger} from './storeModels.js';
import {publicOrder} from './service.js';
const wrap=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
const parse=(schema,value)=>{const result=schema.safeParse(value);if(!result.success)throw Object.assign(new Error('invalid_request'),{status:400,code:'invalid_request'});return result.data;};
const id=z.string().regex(/^[a-f\d]{24}$/i),empty=z.object({}).strict();
const guard=(req,res,next)=>{
  if(req.method!=='GET'&&(req.get('x-rivals-payments')!=='1'||!req.is('application/json')))return res.status(403).json({error:'payment_csrf_protection'});
  next();
};
export function createPaymentRoutes(service){
  const player=Router(),admin=Router();
  player.use((req,_res,next)=>{
    const known=['/store','/checkout','/equipment'].includes(req.path)||/^\/orders\/[a-f\d]{24}(\/check)?$/i.test(req.path);
    next(known?undefined:'router');
  });
  player.use(web3Middleware,guard,wrap(async(req,res,next)=>{
    const user=await User.findOne({wallet:req.wallet}).select('_id');if(!user)return res.status(401).json({error:'unauthenticated'});
    req.paymentPlayer=user._id;
    await consumeRate(`store:${user._id}`,120);next();
  }));
  player.get('/store',wrap(async(req,res)=>res.json(await service.snapshot(req.paymentPlayer))));
  player.post('/checkout',wrap(async(req,res)=>{
    const input=parse(z.object({sku:z.string().min(1).max(80)}).strict(),req.body);
    const key=parse(z.string().regex(/^[a-zA-Z0-9_-]{16,100}$/),req.get('idempotency-key'));
    await consumeRate(`checkout:${req.paymentPlayer}`,15);
    res.json(await service.checkout(req.paymentPlayer,input.sku,key));
  }));
  player.get('/orders/:id',wrap(async(req,res)=>res.json(publicOrder(await service.ownedOrder(req.paymentPlayer,parse(id,req.params.id))))));
  player.post('/orders/:id/check',wrap(async(req,res)=>{
    parse(empty,req.body);await consumeRate(`payment-check:${req.paymentPlayer}`,30);
    res.json(await service.reconcile(req.paymentPlayer,parse(id,req.params.id)));
  }));
  player.put('/equipment',wrap(async(req,res)=>{
    const input=parse(z.object({sku:z.string().min(1).max(80).nullable()}).strict(),req.body);
    res.json(await service.equip(req.paymentPlayer,input.sku));
  }));
  admin.use((req,_res,next)=>next(req.path==='/orders'||/^\/orders\/[a-f\d]{24}\/(reconcile|attach-checkout)$/i.test(req.path)?undefined:'router'));
  admin.use(wrap(requireBountyAdmin),guard);
  admin.get('/orders',wrap(async(req,res)=>{
    const query=parse(z.object({before:id.optional(),status:z.enum(['initializing','pending','verification_pending','paid','fulfilled','failed','expired','cancelled','review','refund_review','refunded','disputed']).optional()}).strict(),req.query);
    const filter={...(query.before?{_id:{$lt:query.before}}:{}),...(query.status?{status:query.status}:{})};
    const rows=await StoreOrder.find(filter).sort({_id:-1}).limit(50).populate('playerId','wallet email').lean();
    const totals=await StoreOrder.aggregate([{$group:{_id:{environment:'$environment',status:'$status'},orders:{$sum:1},cents:{$sum:'$cents'}}}]);
    res.json({items:rows.map(row=>({...publicOrder(row),player:row.playerId,checkoutId:row.checkoutId,chargeId:row.chargeId})),totals,nextBefore:rows.length===50?String(rows.at(-1)._id):null});
  }));
  admin.post('/orders/:id/reconcile',wrap(async(req,res)=>{
    parse(empty,req.body);const order=await StoreOrder.findById(parse(id,req.params.id));if(!order)return res.status(404).json({error:'order_not_found'});
    await consumeRate(`admin-payment:${req.bountyAdmin}`,60);
    // Audit attempts separately from any financial grant; no manual-paid route.
    await StoreLedger.create({key:`audit:${order._id}:${randomUUID()}`,playerId:order.playerId,orderId:order._id,kind:'audit',actor:req.bountyAdmin,detail:'provider_reconciliation_requested'});
    res.json(await service.reconcile(order.playerId,order._id));
  }));
  admin.post('/orders/:id/attach-checkout',wrap(async(req,res)=>{
    const input=parse(z.object({checkoutId:z.string().regex(/^chk_[a-zA-Z0-9_-]{1,200}$/)}).strict(),req.body);
    const order=await StoreOrder.findById(parse(id,req.params.id));if(!order)return res.status(404).json({error:'order_not_found'});
    await consumeRate(`admin-payment:${req.bountyAdmin}`,60);
    await StoreLedger.create({key:`audit:${order._id}:${randomUUID()}`,playerId:order.playerId,orderId:order._id,kind:'audit',actor:req.bountyAdmin,detail:'original_checkout_reconciliation_requested'});
    // The supplied ID is just a lookup hint. Ownership, reference, amount and
    // environment are independently checked against Bachs before linking/granting.
    res.json(await service.attachCheckout(order.playerId,order._id,input.checkoutId));
  }));
  const errors=(error,_req,res,_next)=>{
    // Never forward SDK bodies, keys, customer details or stack traces to logs/clients.
    const code=error.code,status=Number.isInteger(error.status)?error.status:500;
    const safe=typeof code==='string'&&/^[a-z_]{3,80}$/.test(code);
    res.status(status>=400&&status<600?status:500).json({error:safe?code:'payment_service_unavailable'});
  };
  player.use(errors);admin.use(errors);return {player,admin};
}
