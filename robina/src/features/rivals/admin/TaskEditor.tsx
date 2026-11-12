import { useRef, useState } from 'react';
import { adminBounties, bountyError, type BountyTask, type TaskInput } from '@/services/bounties';
import { AdminDialog } from './AdminUI';
import { campaignTemplate } from './campaignTemplate';
function localDate(iso?: string | null) { if (!iso) return ''; const date = new Date(iso); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
export default function TaskEditor({ task, done, close, trigger }: { task?: BountyTask; done: (message: string) => void; close: () => void; trigger?: HTMLElement }) {
  const initial = task ? { ...task.terms, startsAt: task.startsAt, expiresAt: task.expiresAt } : campaignTemplate('x');
  const [form, setForm] = useState(initial), [instructions, setInstructions] = useState(initial.instructions.join('\n'));
  const [start, setStart] = useState(localDate(initial.startsAt)), [end, setEnd] = useState(localDate(initial.expiresAt));
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const locked = useRef(false);
  function preset(platform: 'x' | 'tiktok') { const next = campaignTemplate(platform); setForm(next); setInstructions(next.instructions.join('\n')); }
  return <AdminDialog title={task ? 'EDIT BOUNTY' : 'CREATE BOUNTY'} description="Publish a brief for every RIVALS player. You choose each player's USDC reward during manual review. No campaign budget or participant limit." busy={busy} close={close} trigger={trigger}>
    {!task && <div className="ab-presets" aria-label="Bounty templates"><button onClick={() => preset('x')}>X POST TEMPLATE</button><button onClick={() => preset('tiktok')}>TIKTOK VIDEO TEMPLATE</button></div>}
    <form onSubmit={async event => {
      event.preventDefault(); if (busy || locked.current) return;
      const lines = instructions.split('\n').map(line => line.trim()).filter(Boolean);
      if (!lines.length || lines.length > 20 || lines.some(line => line.length > 1000)) { setError('Supply 1–20 instructions, at most 1,000 characters per line.'); return; }
      if (start && end && new Date(start) >= new Date(end)) { setError('The expiration must be after the start.'); return; }
      const body: TaskInput = { title: form.title, platform: form.platform, description: form.description, instructions: lines, disclosure: form.disclosure,
        minimumEngagement: form.minimumEngagement, evidenceRequired: form.evidenceRequired,
        startsAt: start ? new Date(start).toISOString() : null, expiresAt: end ? new Date(end).toISOString() : null };
      locked.current = true; setBusy(true); setError('');
      try { if (task) await adminBounties.edit(task._id, body); else await adminBounties.create(body); done(task ? 'Bounty changes saved. Existing submission records are unchanged.' : 'Draft created. Publish it to make it visible to every player.'); }
      catch (cause) { setError(bountyError(cause)); } finally { locked.current = false; setBusy(false); }
    }}><fieldset disabled={busy} className="ab-form"><legend className="sr-only">Campaign configuration</legend>
      <label>Task title<input required maxLength={120} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}/></label>
      <label>Platform<select value={form.platform} onChange={e => setForm({ ...form, platform: e.target.value as 'x' | 'tiktok' })}><option value="x">X / Twitter</option><option value="tiktok">TikTok</option></select></label>
      <label>Description<textarea required maxLength={2000} rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}/></label>
      <label>Instructions · one per line<textarea required maxLength={20000} rows={5} value={instructions} onChange={e => setInstructions(e.target.value)}/></label>
      <div className="ab-form-grid"><label>Required impressions / views<input type="number" min={1} max={1000000000} step={1} required value={form.minimumEngagement} onChange={e => setForm({ ...form, minimumEngagement: Number(e.target.value) })}/></label>
        <label>Start date (optional)<input type="datetime-local" value={start} onChange={e => setStart(e.target.value)}/></label>
        <label>Expiration date (optional)<input type="datetime-local" value={end} onChange={e => setEnd(e.target.value)}/></label></div>
      <p className="ab-help">Dates use your device timezone. Leave blank to start when published with no fixed expiration. Published schedules are enforced by the server.</p>
      <label>Paid-promotion disclosure requirements<textarea required maxLength={1000} rows={3} value={form.disclosure} onChange={e => setForm({ ...form, disclosure: e.target.value })}/></label>
      <label className="ab-check"><input type="checkbox" checked={form.evidenceRequired} onChange={e => setForm({ ...form, evidenceRequired: e.target.checked })}/>Require engagement evidence link</label>
      <p className="ab-help">Every player can submit once. Review their content and enter the USDC amount to credit when you approve. This page never sends money.</p>
      {error && <p className="ab-error" role="alert">{error}</p>}<button className="ab-primary" type="submit">{busy ? 'SAVING…' : task ? 'SAVE CAMPAIGN CHANGES' : 'CREATE DRAFT'}</button>
    </fieldset></form>
  </AdminDialog>;
}
