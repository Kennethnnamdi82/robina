import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { GameProvider, useGame } from './GameContext';

const fixtures = vi.hoisted(() => ({
  auth: { isLoggedIn: true, isAdmin: false, baseUser: { wallet: '0x1111' } },
  me: vi.fn(), mining: vi.fn(), leaderboard: vi.fn(), claim: vi.fn(),
}));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => fixtures.auth }));
vi.mock('@/lib/backend', () => ({ HAS_BACKEND: true }));
vi.mock('@/services/api', () => ({
  authApi: { me: fixtures.me }, miningApi: { status: fixtures.mining, claim: fixtures.claim },
  leaderboardApi: { top: fixtures.leaderboard }, tasksApi: {}, paymentsApi: {},
}));
const user = { wallet: '0x1111', bdBalance: 42, level: 'Beginner', autoClaimActive: false, referralCount: 0, referralCode: '', completedTasks: [] };
let context: ReturnType<typeof useGame>;
let host: HTMLDivElement;
let root: Root;
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const renderProbe = () => act(async () => { root.render(<GameProvider><Probe /></GameProvider>); });
function Probe() { context = useGame(); return <div>{context.loading ? 'loading' : 'ready'} / {context.user.wallet} / {context.user.bd}</div>; }
beforeEach(() => {
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
  fixtures.auth.isLoggedIn = true;
  fixtures.me.mockReset().mockResolvedValue({ user });
  fixtures.mining.mockReset().mockResolvedValue({ bdBalance: 42 });
  fixtures.leaderboard.mockReset().mockResolvedValue({ leaderboard: [] });
  fixtures.claim.mockReset().mockResolvedValue({ bdBalance: 84, lastClaimTime: new Date().toISOString() });
  localStorage.clear();
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.clearAllMocks(); });
it('finishes profile loading while optional mining and leaderboard calls are stalled', async () => {
  fixtures.mining.mockImplementation(() => new Promise(() => {}));
  fixtures.leaderboard.mockImplementation(() => new Promise(() => {}));
  await renderProbe();
  expect(host.textContent).toBe('ready / 0x1111 / 42');
});
it('ignores an old profile response after sign-out', async () => {
  let resolveProfile!: (value: { user: typeof user }) => void;
  fixtures.me.mockImplementation(() => new Promise(resolve => { resolveProfile = resolve; }));
  await renderProbe();
  fixtures.auth.isLoggedIn = false;
  await renderProbe();
  await act(async () => { resolveProfile({ user }); });
  expect(host.textContent).toBe('ready / 0x000 / 0');
});
it('a completed claim does not wait for the leaderboard', async () => {
  await renderProbe();
  expect(host.textContent).toBe('ready / 0x1111 / 42');
  fixtures.leaderboard.mockImplementation(() => new Promise(() => {}));
  let claimed = false;
  await act(async () => { claimed = await context.claimBD(); });
  expect(claimed).toBe(true);
  expect(host.textContent).toBe('ready / 0x1111 / 84');
});
