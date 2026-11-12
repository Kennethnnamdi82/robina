// Explicit first-party API allowlist; never turn the relay into an open proxy.
const id = '[a-fA-F0-9]{24}';
const rules = [
  ['GET', '^/api/bounties/(tasks|submissions|wallet|ledger|withdrawals|notifications)$'],
  ['GET', `^/api/bounties/tasks/${id}$`],
  ['POST', `^/api/bounties/tasks/${id}/submissions$`],
  ['PUT', '^/api/bounties/wallet/address$'],
  ['POST', '^/api/bounties/(withdrawals|notifications/read)$'],
  ['GET', '^/api/admin/bounties/(summary|tasks|submissions|players|withdrawals|audit)$'],
  ['GET', `^/api/admin/bounties/(submissions|players)/${id}$`],
  ['GET', `^/api/admin/bounties/players/${id}/(submissions|withdrawals|ledger)$`],
  ['POST', '^/api/admin/bounties/tasks$'],
  ['PUT', `^/api/admin/bounties/tasks/${id}$`],
  ['PATCH', `^/api/admin/bounties/tasks/${id}/status$`],
  ['POST', `^/api/admin/bounties/submissions/${id}/review$`],
  ['POST', `^/api/admin/bounties/withdrawals/${id}/(review|paid|execute|reconcile)$`],
].map(([method, pattern]) => [method, new RegExp(pattern)]);
export function allowedBountyMethods(path) { return rules.filter(([, pattern]) => pattern.test(path)).map(([method]) => method); }
