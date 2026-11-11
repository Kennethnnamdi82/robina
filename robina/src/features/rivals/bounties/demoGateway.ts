import { DEMO_TASKS, emptyDemoState } from './demoData';
import { demoStateSchema, MIN_WITHDRAWAL, safeWebUrl, submissionError, validBaseAddress, validPostUrl, type BountyGateway, type BountySnapshot, type DemoState } from './model';

export const demoStorageKey = (identity: string) => `rivals_bounties_demo_v1:${encodeURIComponent(identity)}`;
/** Device-only simulation. No fetch, wallet SDK, payment or chain calls. */
export function createDemoGateway(identity: string, storage?: Pick<Storage, 'getItem' | 'setItem'>): BountyGateway {
  let memory = emptyDemoState(), persistence: BountySnapshot['persistence'] = 'device';
  try { storage ??= window.localStorage; } catch { persistence = 'session'; }
  const key = demoStorageKey(identity);
  function read(): DemoState {
    if (persistence === 'session') return memory;
    try {
      const raw = storage?.getItem(key);
      if (raw) memory = demoStateSchema.parse(JSON.parse(raw));
    } catch { persistence = 'session'; }
    return memory;
  }
  function snapshot(): BountySnapshot {
    return structuredClone({ ...memory, tasks: DEMO_TASKS, mode: 'demo' as const, persistence });
  }
  function save(next: DemoState) {
    memory = next;
    try { if (persistence === 'device') storage?.setItem(key, JSON.stringify(next)); }
    catch { persistence = 'session'; }
    return snapshot();
  }
  return {
    async load(signal) {
      if (signal?.aborted) throw new DOMException('Bounty loading cancelled.', 'AbortError');
      read(); return snapshot();
    },
    async submit(input) {
      const state = read(), task = DEMO_TASKS.find(t => t.id === input.taskId);
      if (!task) throw new Error('This bounty is no longer available. Refresh the board.');
      if (state.submissions.some(s => s.taskId === task.id)) throw new Error('You have already submitted this bounty. Each player may submit once.');
      const error = submissionError(task, input);
      if (error) throw new Error(error);
      const createdAt = new Date().toISOString(), id = crypto.randomUUID();
      return save({ ...state,
        submissions: [{ id, taskId: task.id, taskTitle: task.title, platform: task.platform,
          postUrl: validPostUrl(task.platform, input.postUrl)!, evidenceUrl: input.evidenceUrl ? safeWebUrl(input.evidenceUrl)! : '',
          evidenceNotes: input.evidenceNotes.trim(), rewardMicros: task.rewardMicros, status: 'pending_review', submittedAt: createdAt }, ...state.submissions],
        notifications: [{ id: `received-${id}`, kind: 'received', title: 'Submission received',
          message: `${task.title} is Pending Review in this demo. No reward has been credited.`, createdAt, read: false }, ...state.notifications],
      });
    },
    async saveAddress(address) {
      if (!validBaseAddress(address)) throw new Error('Enter a non-zero 0x address with 40 hexadecimal characters.');
      const state = read();
      return save({ ...state, wallet: { ...state.wallet, address: address.trim() } });
    },
    async requestWithdrawal(input) {
      const state = read();
      if (!input.confirmed) throw new Error('Confirm the demo withdrawal details.');
      if (!validBaseAddress(input.address)) throw new Error('Enter a valid Base wallet address.');
      if (!Number.isSafeInteger(input.amountMicros) || input.amountMicros < MIN_WITHDRAWAL) throw new Error('The minimum withdrawal is 5 USDC.');
      if (input.amountMicros > state.wallet.availableMicros) throw new Error('Your available balance is insufficient.');
      if (state.withdrawals.some(w => w.status === 'requested' || w.status === 'processing')) throw new Error('A withdrawal is already pending.');
      const id = crypto.randomUUID(), requestedAt = new Date().toISOString();
      return save({ ...state,
        wallet: { ...state.wallet, address: input.address.trim(), availableMicros: state.wallet.availableMicros - input.amountMicros },
        withdrawals: [{ id, address: input.address.trim(), amountMicros: input.amountMicros, requestedAt, status: 'requested' }, ...state.withdrawals],
        notifications: [{ id: `withdrawal-${id}`, kind: 'withdrawal', title: 'Withdrawal status updated',
          message: 'Demo request recorded. No USDC will be transferred.', createdAt: requestedAt, read: false }, ...state.notifications],
      });
    },
    async markNotificationsRead() {
      const state = read(); return save({ ...state, notifications: state.notifications.map(n => ({ ...n, read: true })) });
    },
  };
}
