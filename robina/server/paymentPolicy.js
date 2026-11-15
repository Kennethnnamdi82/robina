// Deliberately excludes provider webhooks, arbitrary charge APIs and manual-paid actions.
export function allowedPaymentMethods(path){
  if(path==='/api/payments/store')return ['GET'];
  if(path==='/api/payments/checkout')return ['POST'];
  if(path==='/api/payments/equipment')return ['PUT'];
  if(/^\/api\/payments\/orders\/[a-fA-F0-9]{24}$/.test(path))return ['GET'];
  if(/^\/api\/payments\/orders\/[a-fA-F0-9]{24}\/check$/.test(path))return ['POST'];
  if(path==='/api/admin/payments/orders')return ['GET'];
  if(/^\/api\/admin\/payments\/orders\/[a-fA-F0-9]{24}\/(reconcile|attach-checkout)$/.test(path))return ['POST'];
  return [];
}
