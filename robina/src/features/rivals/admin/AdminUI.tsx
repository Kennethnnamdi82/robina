import type { ReactNode } from 'react';
import { AlertTriangle, ArrowUpRight, Inbox, LoaderCircle } from 'lucide-react';
import { BountyDialog } from '../bounties/BountyUI';
import type { AdminAccount, AdminPlayer } from '@/services/bounties';
import { formatUSDC, playerName } from './adminHelpers';
const labels: Record<string, string> = { active: 'Published', draft: 'Draft', paused: 'Paused', closed: 'Closed', pending: 'Pending review', approved: 'Approved', rejected: 'Rejected',
  prepared: 'Prepared / reserved', broadcast: 'Awaiting finality', paid: 'Paid / verified', failed: 'Reverted / returned' };
export function Badge({ status }: { status: string }) { return <span className="ab-badge" data-status={status}>{labels[status] || status}</span>; }
export function PlayerLabel({ player, id }: { player?: AdminPlayer; id?: string }) { return <span className="ab-player"><strong>{playerName(player)}</strong><small>{player?.walletAddress || player?.wallet || id}</small></span>; }
export function Risks({ flags }: { flags?: string[] }) {
  return flags?.length ? <aside className="ab-risk"><AlertTriangle size={17}/><div><strong>ACTIVITY REQUIRES REVIEW</strong>{flags.map(flag => <p key={flag}>{flag.replaceAll('_', ' ')}</p>)}<small>Indicators are not proof of fraud. Independently verify the account and content.</small></div></aside> : null;
}
export function AdminDialog({ title, description, busy, close, children, trigger }: { title: string; description: string; busy: boolean; close: () => void; children: ReactNode; trigger?: HTMLElement }) {
  return <BountyDialog className="ab-dialog" title={title} description={description} onClose={() => { if (!busy) close(); }} returnFocus={trigger}>{children}</BountyDialog>;
}
export function StatePanel({ loading, error, retry, empty = 'Nothing here yet', description = 'New records will appear here when activity begins.' }: { loading?: boolean; error?: string; retry?: () => void; empty?: string; description?: string }) {
  return <div className="ab-state" role={error ? 'alert' : 'status'}>{loading ? <LoaderCircle className="ab-spin" size={26}/> : error ? <AlertTriangle size={26}/> : <Inbox size={28}/>}<h3>{loading ? 'Connecting to bounty operations' : error ? 'Unable to load records' : empty}</h3><p>{error || (loading ? 'Retrieving authoritative server data…' : description)}</p>{error && retry && <button onClick={retry}>TRY AGAIN</button>}</div>;
}
export function Pager({ next, previous, busy, hasPrevious, page }: { next?: () => void; previous: () => void; busy: boolean; hasPrevious: boolean; page: number }) {
  return <div className="ab-pagination"><span>PAGE {page} · 20 RECORDS PER PAGE</span><div><button disabled={!hasPrevious || busy} onClick={previous}>PREVIOUS</button><button disabled={!next || busy} onClick={next}>NEXT <ArrowUpRight size={14}/></button></div></div>;
}
export function AccountStats({ wallet }: { wallet: Pick<AdminAccount, 'availableMicros' | 'reservedMicros' | 'earnedMicros' | 'withdrawnMicros'> }) {
  return <dl className="ab-detail-stats">{[['Available', wallet.availableMicros], ['Reserved', wallet.reservedMicros], ['Lifetime earned', wallet.earnedMicros], ['Verified withdrawals', wallet.withdrawnMicros]].map(([label, amount]) => <div key={label}><dt>{label}</dt><dd>{formatUSDC(amount)} <small>USDC</small></dd></div>)}</dl>;
}
