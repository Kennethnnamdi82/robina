import { useRef, useState } from 'react';
import { adminBounties, bountyError, type AdminSubmission } from '@/services/bounties';
import { ExternalLink } from '../bounties/BountyUI';
import { AdminDialog, Badge, PlayerLabel, Risks } from './AdminUI';
import { amountInput, formatUSDC, parseAmount, timestamp } from './adminHelpers';

export default function SubmissionReview({ row, close, done, trigger }: { row: AdminSubmission; close: () => void; done: (message: string) => void; trigger?: HTMLElement }) {
  const [decision, setDecision] = useState<'approve' | 'reject'>('approve'), [observed, setObserved] = useState(''), [notes, setNotes] = useState(''), [reason, setReason] = useState('');
  const [checks, setChecks] = useState([false, false, false, false]), [risk, setRisk] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const locked = useRef(false);
  const [amount, setAmount] = useState(row.terms.rewardMode === 'manual' ? '' : amountInput(row.terms.rewardMicros));
  const rewardMicros = parseAmount(amount);
  const valid = decision === 'reject' ? reason.trim().length >= 3 : Boolean(rewardMicros) && checks.every(Boolean) && Number.isSafeInteger(Number(observed)) && Number(observed) >= row.terms.minimumEngagement && notes.trim().length >= 10 && (!row.riskFlags?.length || risk);
  return <AdminDialog title="REVIEW SUBMISSION" description="Verify independently before crediting a reward. A URL or screenshot alone does not prove ownership or genuine engagement." busy={busy} close={close} trigger={trigger}>
    <div className="ab-review-head"><PlayerLabel player={row.player} id={row.playerId}/><Badge status={row.status}/></div>
    <h3>{row.terms.title}</h3><div className="ab-reward-callout"><span>{row.status === 'approved' ? 'AMOUNT CREDITED' : 'MANUAL REWARD REVIEW'}</span><strong>{row.status === 'approved' ? `${formatUSDC(row.awardedMicros ?? row.terms.rewardMicros)} USDC` : row.terms.rewardMode === 'manual' ? 'You choose the reward' : `Legacy minimum: ${formatUSDC(row.terms.rewardMicros)} USDC`}</strong><small>Terms revision {row.terms.revision} · Submitted {timestamp(row.createdAt)}</small></div>
    <div className="ab-links"><ExternalLink href={row.postUrl}>Open original post</ExternalLink>{row.evidenceUrl && <ExternalLink href={row.evidenceUrl}>Open supporting evidence</ExternalLink>}</div>
    {row.evidenceNotes && <div className="ab-evidence"><strong>PLAYER-SUPPLIED NOTES · NOT VERIFIED</strong><p>{row.evidenceNotes}</p></div>}
    <details className="ab-instructions"><summary>Promised requirements & disclosure</summary><p>{row.terms.minimumEngagement.toLocaleString()} genuine {row.terms.platform === 'x' ? 'impressions' : 'views'}</p><ol>{row.terms.instructions.map((line, index) => <li key={index}>{line}</li>)}</ol><p><strong>Disclosure:</strong> {row.terms.disclosure}</p></details>
    <Risks flags={row.riskFlags}/>
    {row.status !== 'pending' ? <p className="ab-notice">{row.status === 'approved' ? 'This submission is approved and its reward has already been credited. It cannot be credited again.' : `Rejected: ${row.review?.reason || 'See the administrative audit record.'}`}</p> : <form onSubmit={async event => {
      event.preventDefault(); if (!valid || locked.current) return;
      locked.current = true; setBusy(true); setError('');
      try {
        await adminBounties.reviewSubmission(row._id, decision === 'reject' ? { decision, reason: reason.trim() } : {
          decision, verificationMethod: 'manual', ownershipVerified: true, engagementVerified: true, complianceVerified: true, disclosureVerified: true,
          observedEngagement: Number(observed), notes: notes.trim(), acknowledgeRisk: risk, rewardMicros: rewardMicros!,
        });
        done(decision === 'approve' ? `${formatUSDC(rewardMicros!)} USDC credited exactly once. Submission completed.` : 'Submission rejected. The reason is visible to the player.');
      } catch (cause) { setError(bountyError(cause)); } finally { locked.current = false; setBusy(false); }
    }}><fieldset disabled={busy} className="ab-form"><legend>REVIEW DECISION</legend>
      <div className="ab-decision"><label><input type="radio" name="review-decision" checked={decision === 'approve'} onChange={() => setDecision('approve')}/>Approve & credit reward</label><label><input type="radio" name="review-decision" checked={decision === 'reject'} onChange={() => setDecision('reject')}/>Reject submission</label></div>
      {decision === 'approve' ? <>
        <label>Amount to credit (USDC)<input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} required placeholder="Enter this player's reward"/></label>
        <p className="ab-help">This exact amount is added to this player's bounty balance only after you confirm approval. You cannot credit the same submission twice.</p>
        <label>Independently verified impressions / views<input inputMode="numeric" type="number" min={row.terms.minimumEngagement} max={1000000000} step={1} value={observed} onChange={e => setObserved(e.target.value)} required/></label>
        <p className="ab-help">Minimum {row.terms.minimumEngagement.toLocaleString()}. Use an authorized independent check; do not copy unverified player metrics.</p>
        {['I verified this player owns the original content and account.', 'I verified the required genuine engagement; no purchased or automated reach.', 'I verified the campaign instructions and originality requirements.', 'I verified clear paid-promotion disclosures, including applicable platform tools.'].map((label, index) => <label className="ab-check" key={label}><input type="checkbox" checked={checks[index]} onChange={e => setChecks(checks.map((value, i) => i === index ? e.target.checked : value))}/>{label}</label>)}
        <label>Independent verification record<textarea required minLength={10} maxLength={2000} rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Record how you independently verified ownership, analytics, originality and disclosure."/></label>
        <label className="ab-check"><input type="checkbox" checked={risk} onChange={e => setRisk(e.target.checked)}/>I reviewed suspicious-activity indicators and explicitly acknowledge any flagged risk.</label>
      </> : <label>Player-visible rejection reason<textarea required minLength={3} maxLength={1500} rows={4} value={reason} onChange={e => setReason(e.target.value)}/></label>}
      {error && <p role="alert" className="ab-error">{error}</p>}<button type="submit" className={decision === 'approve' ? 'ab-primary' : 'ab-danger'} disabled={!valid || busy}>{busy ? 'SAVING REVIEW…' : decision === 'approve' ? rewardMicros ? `CONFIRM & CREDIT ${formatUSDC(rewardMicros)} USDC` : 'ENTER REWARD TO APPROVE' : 'CONFIRM REJECTION'}</button>
    </fieldset></form>}
  </AdminDialog>;
}
