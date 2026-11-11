import { useRef, useState } from 'react';
import { adminBounties, bountyError, type AdminWithdrawal } from '@/services/bounties';
import { ExternalLink } from '../bounties/BountyUI';
import { AccountStats, AdminDialog, Badge, PlayerLabel, Risks } from './AdminUI';
import { formatUSDC, timestamp } from './adminHelpers';

export default function WithdrawalReview({ row, enabled, close, done, trigger }: { row: AdminWithdrawal; enabled: boolean; close: () => void; done: (message: string) => void; trigger?: HTMLElement }) {
  const [decision, setDecision] = useState<'approve' | 'reject'>(row.status === 'approved' ? 'reject' : 'approve'), [notes, setNotes] = useState(''), [risk, setRisk] = useState(false), [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''); const locked = useRef(false);
  async function run(action: () => Promise<{ status: string }>, message: string) {
    if (locked.current) return; locked.current = true; setBusy(true); setError('');
    try { const result = await action(); done(result.status === 'paid' ? 'Payout verified in a finalized Base block. USDC withdrawal is paid.' : result.status === 'failed' ? 'On-chain revert finalized. Reserved funds were returned exactly once.' : message); }
    catch (cause) { setError(bountyError(cause)); } finally { locked.current = false; setBusy(false); }
  }
  const signed = row.status === 'prepared' || row.status === 'broadcast';
  const reviewable = row.status === 'pending' || row.status === 'approved';
  return <AdminDialog title="WITHDRAWAL CONTROL" description="Authorization is not payment. Only the backend can mark Paid after verifying the finalized native-USDC transfer on Base." busy={busy} close={close} trigger={trigger}>
    <div className="ab-review-head"><PlayerLabel player={row.player} id={row.playerId}/><Badge status={row.status}/></div>
    <div className="ab-reward-callout"><span>NATIVE USDC / BASE MAINNET · 8453</span><strong>{formatUSDC(row.amountMicros)} USDC</strong><code>{row.address}</code><small>Requested {timestamp(row.createdAt)}</small></div>
    {row.wallet && <AccountStats wallet={row.wallet}/>}
    <Risks flags={row.riskFlags}/>
    {row.txHash && /^0x[a-f\d]{64}$/i.test(row.txHash) && <div className="ab-links"><ExternalLink href={`https://basescan.org/tx/${row.txHash}`}>Inspect Base transaction</ExternalLink><code>{row.txHash}</code></div>}
    {row.status === 'paid' && <p className="ab-notice">Verified payment · {timestamp(row.paidAt)} · Finalized block {row.receiptBlock}. This request cannot be paid again.</p>}
    {row.status === 'rejected' && <p className="ab-notice">Rejected: {row.review?.reason}. Reserved funds were released.</p>}
    {row.status === 'failed' && <p className="ab-notice">{row.failureReason}. Reserved funds were returned after a finalized revert, not an RPC timeout.</p>}
    {!enabled && <p className="ab-error" role="status">Treasury payouts are not configured. Do not interpret an authorization as a transfer. No signing or receipt check is available until backend settings are enabled.</p>}
    {reviewable && <form onSubmit={event => {
      event.preventDefault(); if (notes.trim().length < 3 || (decision === 'approve' && row.riskFlags?.length && !risk)) return;
      void run(() => adminBounties.reviewWithdrawal(row._id, decision === 'approve' ? { decision, notes: notes.trim(), acknowledgeRisk: risk } : { decision, reason: notes.trim() }),
        decision === 'approve' ? 'Withdrawal authorized. It is not paid; review and confirm the Base payout separately.' : 'Unsigned request rejected. Reserved funds returned.');
    }}><fieldset className="ab-form" disabled={busy}><legend>{row.status === 'pending' ? 'AUTHORIZE OR REJECT' : 'CANCEL ONLY WHILE UNSIGNED'}</legend>
      {row.status === 'pending' && <div className="ab-decision"><label><input type="radio" name="withdrawal-decision" checked={decision === 'approve'} onChange={() => setDecision('approve')}/>Authorize payout</label><label><input type="radio" name="withdrawal-decision" checked={decision === 'reject'} onChange={() => setDecision('reject')}/>Reject & release funds</label></div>}
      <label>{decision === 'approve' ? 'Authorization and destination verification record' : 'Player-visible cancellation reason'}<textarea rows={3} maxLength={decision === 'approve' ? 2000 : 1500} minLength={3} value={notes} onChange={e => setNotes(e.target.value)} required/></label>
      {decision === 'approve' && <label className="ab-check"><input type="checkbox" checked={risk} onChange={e => setRisk(e.target.checked)}/>I reviewed the source, destination, account and suspicious-activity indicators.</label>}
      <button type="submit" disabled={busy || notes.trim().length < 3 || (decision === 'approve' && Boolean(row.riskFlags?.length) && !risk)}>{busy ? 'SAVING…' : decision === 'approve' ? 'AUTHORIZE REQUEST · NOT YET PAID' : 'REJECT UNSIGNED REQUEST & RETURN FUNDS'}</button>
    </fieldset></form>}
    {(row.status === 'approved' || signed) && <div className="ab-payout-actions">
      <h3>{signed ? 'RECONCILE THE EXISTING PAYMENT' : 'CONFIRM REAL BASE TRANSFER'}</h3>
      <p>{signed ? 'An existing signed transaction is durable. Missing receipts, RPC outages and non-finalized blocks do not release the reservation. Reconciliation cannot create another payment.' : 'Sending signs a real treasury transaction for the fixed amount and destination above. Confirm the destination accepts native USDC on Base. Treasury ETH pays gas.'}</p>
      {signed && <button className="ab-primary" disabled={busy || !enabled} onClick={() => void run(() => adminBounties.payout(row._id, 'reconcile'), 'No finalized payment is confirmed yet. Funds remain reserved; check the transaction and reconcile again later.')}>{busy ? 'CHECKING…' : 'CHECK VERIFIED ON-CHAIN STATUS'}</button>}
      <label className="ab-check"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e => setConfirmed(e.target.checked)}/>{signed ? 'I intend to rebroadcast only the exact existing signed transaction; never a fresh payment.' : `I independently checked the destination and confirm sending ${formatUSDC(row.amountMicros)} native USDC from the treasury.`}</label>
      <button className={signed ? '' : 'ab-primary'} disabled={!confirmed || busy || !enabled} onClick={() => void run(() => adminBounties.payout(row._id, 'execute'), 'Payment remains unresolved. Funds stay reserved until the backend verifies finalized settlement.')}>{busy ? 'PROCESSING…' : signed ? 'REBROADCAST SAME TRANSACTION' : `SEND ${formatUSDC(row.amountMicros)} USDC ON BASE`}</button>
    </div>}
    {error && <p className="ab-error" role="alert">{error}</p>}
  </AdminDialog>;
}
