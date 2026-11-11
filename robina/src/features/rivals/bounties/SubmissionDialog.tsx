import { useState } from 'react';
import { ArrowUpRight, Info, ShieldCheck } from 'lucide-react';
import { BountyDialog } from './BountyUI';
import { money, submissionError, type BountyTask, type SubmitBountyInput } from './model';

export default function SubmissionDialog({ task, trigger, busy, onClose, onSubmit, demo = false }: {
  task: BountyTask; trigger?: HTMLElement; busy: boolean; onClose: () => void;
  onSubmit: (input: SubmitBountyInput) => Promise<string | null>;
  demo?: boolean;
}) {
  const [postUrl, setPostUrl] = useState(''), [evidenceUrl, setEvidenceUrl] = useState(''), [evidenceNotes, setEvidenceNotes] = useState('');
  const [confirmed, setConfirmed] = useState(false), [error, setError] = useState('');
  return <BountyDialog title={task.title} description={`${task.requirement} · ${money(task.rewardMicros)} USDC ${demo ? 'demo reward' : 'reward after verified approval'}`} onClose={() => { if (!busy) onClose(); }} returnFocus={trigger}>
    <section className="rb-brief"><h3>YOUR BRIEF</h3><ol>{task.instructions.map(instruction => <li key={instruction}>{instruction}</li>)}</ol></section>
    <aside className="rb-disclosure"><ShieldCheck size={20}/><div><strong>PROMOTIONAL DISCLOSURE REQUIRED</strong><p>{task.disclosure}</p></div></aside>
    <form noValidate onSubmit={async event => {
      event.preventDefault(); if (busy) return;
      const input = { taskId: task.id, postUrl, evidenceUrl, evidenceNotes, confirmed, termsRevision: task.revision };
      const invalid = submissionError(task, input);
      if (invalid) { setError(invalid); return; }
      setError(''); const failure = await onSubmit(input); if (failure) setError(failure);
    }}>
      <fieldset disabled={busy} className="rb-fields"><legend>SUBMIT YOUR CONTENT</legend>
        <label className="rb-label">{task.platform === 'x' ? 'X post URL' : 'TikTok video URL'}<input type="url" inputMode="url" autoCapitalize="none" autoCorrect="off" maxLength={2048} required value={postUrl} onChange={event => setPostUrl(event.target.value)} placeholder={task.platform === 'x' ? 'https://x.com/yourname/status/123456789' : 'https://www.tiktok.com/@yourname/video/123456789'} aria-describedby="rb-post-hint"/></label>
        <small id="rb-post-hint">Full public post URL only. No profile links or shortened URLs. An administrator must independently verify ownership and genuine engagement.</small>
        <label className="rb-label">Engagement evidence link {task.evidenceRequired ? '(required)' : '(optional)'}<input type="url" inputMode="url" autoCapitalize="none" autoCorrect="off" maxLength={2048} required={task.evidenceRequired} value={evidenceUrl} onChange={event => setEvidenceUrl(event.target.value)} placeholder="https://…" aria-describedby="rb-evidence-hint"/></label>
        <small id="rb-evidence-hint">Link to a viewable analytics screenshot in your preferred file host. Include the post and engagement count, not sensitive account information. No files are uploaded by this frontend.</small>
        <label className="rb-label">Supporting notes (optional)<textarea maxLength={1500} rows={3} value={evidenceNotes} onChange={event => setEvidenceNotes(event.target.value)} placeholder="Engagement count, date captured and context for the reviewer"/></label>
        <label className="rb-check"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)}/><span>I created this content, used genuine engagement and included the required promotional disclosure. I understand each bounty allows one submission, including rejected or completed submissions.</span></label>
        {error && <p className="rb-error" role="alert">{error}</p>}
        <button className="rh-primary rb-wide" type="submit">{busy ? 'SUBMITTING…' : 'CONFIRM SUBMISSION'}<ArrowUpRight size={17}/></button>
      </fieldset>
    </form>
    <p className="rb-demo-note"><Info size={16}/>{demo ? 'Phase 1 demo: saved on this device as Pending Review. No real review, payment or reward credit occurs.' : 'Submitting does not credit a reward. Your original content, ownership, paid-promotion disclosures and genuine engagement must pass manual review.'}</p>
  </BountyDialog>;
}
