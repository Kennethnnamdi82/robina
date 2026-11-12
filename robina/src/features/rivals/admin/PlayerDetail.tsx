import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminBounties, bountyError, type BountySubmission, type BountyWithdrawal, type LedgerEntry } from '@/services/bounties';
import { AccountStats, AdminDialog, Badge, Pager, PlayerLabel, Risks, StatePanel } from './AdminUI';
import { formatUSDC, timestamp } from './adminHelpers';
import { ExternalLink } from '../bounties/BountyUI';

type Row = BountySubmission | BountyWithdrawal | LedgerEntry;
export default function PlayerDetail({ id, close, trigger }: { id: string; close: () => void; trigger?: HTMLElement }) {
  const [kind, setKind] = useState<'ledger' | 'withdrawals' | 'submissions'>('ledger'), [cursors, setCursors] = useState<string[]>([]);
  const player = useQuery({ queryKey: ['admin-bounties', 'player', id], queryFn: ({ signal }) => adminBounties.player(id, signal), refetchInterval: 15000 });
  const history = useQuery({ queryKey: ['admin-bounties', 'player-history', id, kind, cursors.at(-1)], queryFn: ({ signal }) => adminBounties.list<Row>(`players/${id}/${kind}`, { before: cursors.at(-1) }, signal), refetchInterval: 15000 });
  return <AdminDialog title="PLAYER EARNINGS" description="Read-only account records. Bounty USDC is separate from the store, game cash and revive coins." busy={false} close={close} trigger={trigger}>
    {player.isPending || player.isError ? <StatePanel loading={player.isPending} error={player.isError ? bountyError(player.error) : undefined} retry={() => void player.refetch()}/> : <><PlayerLabel player={player.data.player}/><p className="ab-help">Account {id} · {player.data.approvedTasks} approved contracts</p><AccountStats wallet={player.data.wallet}/><Risks flags={player.data.riskFlags}/></>}
    <div className="ab-detail-tabs" role="group" aria-label="Player record types">{(['ledger', 'withdrawals', 'submissions'] as const).map(tab => <button key={tab} aria-pressed={kind === tab} onClick={() => { setKind(tab); setCursors([]); }}>{tab === 'ledger' ? 'Reward & transaction history' : tab}</button>)}</div>
    {history.isPending || history.isError ? <StatePanel loading={history.isPending} error={history.isError ? bountyError(history.error) : undefined} retry={() => void history.refetch()}/> : !history.data.items.length ? <StatePanel empty="No records for this player"/> : <ol className="ab-history">{history.data.items.map(row => <li key={row._id}>
      {'kind' in row ? <><strong>{row.kind.replaceAll('_', ' ')}</strong><span>{formatUSDC(row.amountMicros)} USDC</span><small>Available after: {formatUSDC(row.availableAfterMicros)} · Reserved after: {formatUSDC(row.reservedAfterMicros)}</small></>
        : 'terms' in row ? <><strong>{row.terms.title}</strong><Badge status={row.status}/><span>{row.status === 'approved' ? `${formatUSDC(row.awardedMicros ?? row.terms.rewardMicros)} USDC credited` : row.terms.rewardMode === 'manual' ? 'Amount set during review' : `${formatUSDC(row.terms.rewardMicros)} USDC promised`}</span><ExternalLink href={row.postUrl}>Original submission</ExternalLink>{row.review?.reason && <p>{row.review.reason}</p>}</>
          : <><strong>{formatUSDC(row.amountMicros)} USDC</strong><Badge status={row.status}/><code>{row.address}</code>{row.txHash && /^0x[a-f\d]{64}$/i.test(row.txHash) && <ExternalLink href={`https://basescan.org/tx/${row.txHash}`}>Base transaction</ExternalLink>}</>}
      <time>{timestamp(row.createdAt)}</time><small>Reference: {row._id}</small>
    </li>)}</ol>}
    <Pager busy={history.isFetching} page={cursors.length + 1} hasPrevious={cursors.length > 0} previous={() => setCursors(cursors.slice(0, -1))} next={history.data?.nextBefore ? () => setCursors([...cursors, history.data.nextBefore!]) : undefined}/>
  </AdminDialog>;
}
