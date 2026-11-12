import { useRef, useState } from 'react';
import { adminBounties, bountyError, type AdminWithdrawal } from '@/services/bounties';
import { ExternalLink } from '../bounties/BountyUI';
import { AccountStats, AdminDialog, Badge, PlayerLabel, Risks } from './AdminUI';
import { formatUSDC, timestamp } from './adminHelpers';

export default function WithdrawalReview({ row, close, done, trigger }: { row: AdminWithdrawal; enabled?: boolean; close: () => void; done: (message: string) => void; trigger?: HTMLElement }) {
  const [decision, setDecision] = useState<'paid' | 'reject'>('paid');
  const [notes, setNotes] = useState(''), [hash, setHash] = useState(''), [confirmed, setConfirmed] = useState(false), [risk, setRisk] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [copied, setCopied] = useState(false);
  const locked = useRef(false);
  const legacy = row.status === 'prepared' || row.status === 'broadcast';
  const reviewable = row.status === 'pending' || row.status === 'approved';
  const valid = decision === 'reject' ? notes.trim().length >= 3 : confirmed && (!row.riskFlags?.length || risk) && (!hash.trim() || /^0x[a-f\d]{64}$/i.test(hash.trim()));
  async function run(action: () => Promise<unknown>, message: string) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError('');
    try { await action(); done(message); }
    catch (cause) { setError(bountyError(cause)); }
    finally { locked.current = false; setBusy(false); }
  }
  return <AdminDialog title="MANUAL WITHDRAWAL" description="Pay this player yourself from your Base wallet, then record payment here. This page cannot send USDC, access your wallet or verify receipt." busy={busy} close={close} trigger={trigger}>
    <div className="ab-review-head"><PlayerLabel player={row.player} id={row.playerId}/><Badge status={row.status}/></div>
    <div className="ab-reward-callout"><span>PAY MANUALLY / NATIVE USDC ON BASE</span><strong>{formatUSDC(row.amountMicros)} USDC</strong><code>{row.address}</code><small>Request {row._id} · {timestamp(row.createdAt)}</small></div>
    {row.wallet && <AccountStats wallet={row.wallet}/>}
    <p className="ab-help">The requested amount is already reserved, so it is not included in available balance. Pay the exact amount to the destination recorded on this request, not a different saved address.</p>
    <button type="button" disabled={busy} onClick={async () => { try { await navigator.clipboard.writeText(row.address); setCopied(true); } catch { setError('Copy is unavailable. Select and copy the full address above.'); } }}>{copied ? 'BASE ADDRESS COPIED' : 'COPY BASE ADDRESS'}</button>
    <Risks flags={row.riskFlags}/>
    {row.txHash && /^0x[a-f\d]{64}$/i.test(row.txHash) && <div className="ab-links"><ExternalLink href={`https://basescan.org/tx/${row.txHash}`}>View recorded transaction</ExternalLink><code>{row.txHash}</code></div>}
    {row.status === 'paid' && <p className="ab-notice">{row.paymentMethod === 'manual' ? 'Marked paid by the administrator' : 'Historical settled payout'} · {timestamp(row.paidAt)}. The player was notified. This request cannot be paid or debited again.</p>}
    {row.status === 'rejected' && <p className="ab-notice">Rejected: {row.review?.reason}. Reserved funds were returned.</p>}
    {row.status === 'failed' && <p className="ab-notice">Historical failed payout: {row.failureReason}. Check the recorded ledger.</p>}
    {legacy && <div className="ab-error" role="status"><strong>Existing signed payment: do not pay it manually.</strong><p>This older request may already be on chain. It cannot be marked paid or refunded manually. Reconcile the existing transaction to avoid a duplicate payment.</p><button disabled={busy} onClick={() => void run(() => adminBounties.payout(row._id, 'reconcile'), 'Existing transaction checked. Refresh the request to see its current status.')}>CHECK EXISTING PAYMENT</button></div>}
    {reviewable && <form onSubmit={event => {
      event.preventDefault(); if (!valid) return;
      void run(() => decision === 'paid' ? adminBounties.markPaid(row._id, { confirmed: true, ...(hash.trim() ? { txHash: hash.trim() } : {}), notes: notes.trim(), acknowledgeRisk: risk })
        : adminBounties.reviewWithdrawal(row._id, { decision: 'reject', reason: notes.trim() }),
      decision === 'paid' ? 'Withdrawal marked paid. The player was notified to check their Base wallet. No transfer was made by this app.' : 'Request rejected. Reserved funds returned to the player.');
    }}><fieldset className="ab-form" disabled={busy}><legend>RECORD YOUR DECISION</legend>
      <div className="ab-decision"><label><input type="radio" name="withdrawal-decision" checked={decision === 'paid'} onChange={() => setDecision('paid')}/>I have paid this player</label><label><input type="radio" name="withdrawal-decision" checked={decision === 'reject'} onChange={() => setDecision('reject')}/>Reject & return balance</label></div>
      {decision === 'paid' && <>
        <ol className="ab-help"><li>Open your Base wallet and send {formatUSDC(row.amountMicros)} native USDC to the full address above.</li><li>Wait for your wallet to confirm success. If payment is pending or uncertain, leave this request pending. Do not send again.</li><li>Return here and mark this request paid only after checking the payment.</li></ol>
        <label>Base transaction hash (recommended)<input value={hash} maxLength={66} autoCapitalize="none" spellCheck={false} placeholder="0x…" onChange={e => setHash(e.target.value)}/></label>
        <p className="ab-help">Optional reference from your wallet. A hash is not verified by this app. The same hash cannot be recorded against another request.</p>
      </>}
      <label>{decision === 'paid' ? 'Payment note (optional)' : 'Player-visible rejection reason'}<textarea rows={3} maxLength={decision === 'paid' ? 2000 : 1500} required={decision === 'reject'} minLength={decision === 'reject' ? 3 : undefined} value={notes} onChange={e => setNotes(e.target.value)}/></label>
      {decision === 'paid' && <>
        <label className="ab-check"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}/>I personally sent {formatUSDC(row.amountMicros)} USDC on Base to {row.address}, confirmed success in my wallet, and checked this request has not already been paid. Marking paid does not send money.</label>
        {Boolean(row.riskFlags?.length) && <label className="ab-check"><input type="checkbox" checked={risk} onChange={e => setRisk(e.target.checked)}/>I reviewed the suspicious-activity indicators before paying.</label>}
      </>}
      {error && <p role="alert" className="ab-error">{error}</p>}
      <button className={decision === 'paid' ? 'ab-primary' : 'ab-danger'} type="submit" disabled={busy || !valid}>{busy ? 'SAVING…' : decision === 'paid' ? 'MARK PAID & NOTIFY PLAYER' : 'REJECT & RETURN RESERVED FUNDS'}</button>
    </fieldset></form>}
    {!reviewable && error && <p role="alert" className="ab-error">{error}</p>}
  </AdminDialog>;
}
