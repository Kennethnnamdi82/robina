import type { AdminPlayer } from '@/services/bounties';
export function formatUSDC(value: string | undefined) {
  if (!value || !/^\d+$/.test(value)) return '—';
  const amount = BigInt(value), decimal = (amount % 1_000_000n).toString().padStart(6, '0').replace(/0+$/, '').padEnd(2, '0');
  return (amount / 1_000_000n).toLocaleString() + '.' + decimal;
}
export function parseAmount(value: string): string | null {
  if (!/^\d{1,10}(\.\d{1,6})?$/.test(value.trim())) return null;
  const [whole, fractional = ''] = value.trim().split('.'), amount = BigInt(whole) * 1_000_000n + BigInt(fractional.padEnd(6, '0'));
  return amount > 0n && amount <= 9_000_000_000_000_000n ? amount.toString() : null;
}
export const amountInput = (value: string) => `${BigInt(value) / 1_000_000n}.${(BigInt(value) % 1_000_000n).toString().padStart(6, '0')}`;
export function playerName(player?: AdminPlayer) {
  if (player?.email) return player.email.split('@')[0];
  const wallet = player?.walletAddress || player?.wallet;
  return wallet ? wallet.slice(0, 8) + '…' + wallet.slice(-5) : 'Unavailable account';
}
export const timestamp = (value?: string | null) => value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';
