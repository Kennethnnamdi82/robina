// Only these authenticated, non-financial mission lifecycle calls may cross
// the first-party web/Android transport. This is not an arbitrary API proxy.
export function allowedMissionMethods(path) {
  const route = path.split('?')[0];
  if (route === '/api/missions/eligibility' || route === '/api/missions/leaderboard' || route === '/api/missions/results' || route === '/api/missions/sessions/current' || route === '/api/missions/sessions') return route === '/api/missions/sessions' ? ['GET', 'POST'] : ['GET'];
  if (/^\/api\/missions\/sessions\/[a-fA-F0-9]{24}$/.test(route)) return ['GET'];
  if (/^\/api\/missions\/sessions\/[a-fA-F0-9]{24}\/(heartbeat|abandon|report|connect)$/.test(route)) return ['POST'];
  return [];
}
