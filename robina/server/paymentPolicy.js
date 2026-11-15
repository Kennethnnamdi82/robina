// Deliberately excludes provider webhooks, arbitrary charge APIs and manual-paid actions.
export function allowedPaymentMethods(path){
  if(path==='/api/payments/store')return ['GET'];
  if(path==='/api/payments/checkout')return ['POST'];
  if(path==='/api/payments/equipment')return ['PUT'];
  if(path==='/api/payments/season/claim')return ['POST'];
  if(path==='/api/admin/payments/seasons')return ['GET','POST'];
  if(/^\/api\/admin\/payments\/seasons\/[a-zA-Z0-9_-]{1,80}\/close$/.test(path))return ['POST'];
  if(/^\/api\/payments\/orders\/[a-fA-F0-9]{24}$/.test(path))return ['GET'];
  if(/^\/api\/payments\/orders\/[a-fA-F0-9]{24}\/check$/.test(path))return ['POST'];
  if(path==='/api/admin/payments/orders')return ['GET'];
  if(/^\/api\/admin\/payments\/orders\/[a-fA-F0-9]{24}\/(reconcile|attach-checkout)$/.test(path))return ['POST'];
  return [];
}
