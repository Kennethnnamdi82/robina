import { useRef, useState } from 'react';
import { adminBounties, bountyError, type BountyTask, type TaskInput } from '@/services/bounties';
import { AdminDialog } from './AdminUI';
import { amountInput, parseAmount } from './adminHelpers';
import { campaignTemplate } from './campaignTemplate';
function localDate(iso?: string | null) { if (!iso) return ''; const date = new Date(iso); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
export default function TaskEditor({ task, done, close, trigger }: { task?: BountyTask; done: (message: string) => void; close: () => void; trigger?: HTMLElement }) {
  const initial = task ? { ...task.terms, budgetMicros: task.budgetMicros, participationLimit: task.participationLimit, startsAt: task.startsAt, expiresAt: task.expiresAt } : campaignTemplate('x');
  const [form, setForm] = useState(initial), [instructions, setInstructions] = useState(initial.instructions.join('\n'));
  const [reward, setReward] = useState(amountInput(initial.rewardMicros)), [budget, setBudget] = useState(amountInput(initial.budgetMicros));
  const [start, setStart] = useState(localDate(initial.startsAt)), [end, setEnd] = useState(localDate(initial.expiresAt));
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const locked = useRef(false);
  function preset(platform: 'x' | 'tiktok') { const next = campaignTemplate(platform); setForm(next); setReward(amountInput(next.rewardMicros)); setBudget(amountInput(next.budgetMicros)); setInstructions(next.instructions.join('\n')); }
  return <AdminDialog title={task ? 'EDIT CAMPAIGN' : 'CREATE CAMPAIGN'} description={task ? 'New terms apply to future submissions only. Previously submitted rewards remain fixed.' : 'Create a draft, check its budget and disclosures, then publish it explicitly.'} busy={busy} close={close} trigger={trigger}>
    {!task && <div className="ab-presets" aria-label="Campaign templates"><button onClick={() => preset('x')}>X / 10 USDC TEMPLATE</button><button onClick={() => preset('tiktok')}>TIKTOK / 5 USDC TEMPLATE</button></div>}
    <form onSubmit={async event => {
      event.preventDefault(); if (busy || locked.current) return;
      const rewardMicros = parseAmount(reward), budgetMicros = parseAmount(budget), lines = instructions.split('\n').map(line => line.trim()).filter(Boolean);
      if (!rewardMicros || !budgetMicros || BigInt(budgetMicros) < BigInt(rewardMicros)) { setError('Use positive USDC amounts with at most 6 decimals and a budget at least as large as the reward.'); return; }
      if (!lines.length || lines.length > 20 || lines.some(line => line.length > 1000)) { setError('Supply 1–20 instructions, at most 1,000 characters per line.'); return; }
      if (start && end && new Date(start) >= new Date(end)) { setError('The expiration must be after the start.'); return; }
      const body: TaskInput = { title: form.title, platform: form.platform, description: form.description, instructions: lines, disclosure: form.disclosure,
        minimumEngagement: form.minimumEngagement, rewardMicros, budgetMicros, participationLimit: form.participationLimit, evidenceRequired: form.evidenceRequired,
        startsAt: start ? new Date(start).toISOString() : null, expiresAt: end ? new Date(end).toISOString() : null };
      locked.current = true; setBusy(true); setError('');
      try { if (task) await adminBounties.edit(task._id, body); else await adminBounties.create(body); done(task ? 'Campaign changes saved. Existing promised rewards are unchanged.' : 'Draft created. Review funding, then publish the campaign.'); }
      catch (cause) { setError(bountyError(cause)); } finally { locked.current = false; setBusy(false); }
    }}><fieldset disabled={busy} className="ab-form"><legend className="sr-only">Campaign configuration</legend>
      <label>Task title<input required maxLength={120} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}/></label>
      <label>Platform<select value={form.platform} onChange={e => setForm({ ...form, platform: e.target.value as 'x' | 'tiktok' })}><option value="x">X / Twitter</option><option value="tiktok">TikTok</option></select></label>
      <label>Description<textarea required maxLength={2000} rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}/></label>
      <label>Instructions · one per line<textarea required maxLength={20000} rows={5} value={instructions} onChange={e => setInstructions(e.target.value)}/></label>
      <div className="ab-form-grid"><label>Required impressions / views<input type="number" min={1} max={1000000000} step={1} required value={form.minimumEngagement} onChange={e => setForm({ ...form, minimumEngagement: Number(e.target.value) })}/></label>
        <label>Reward (USDC)<input inputMode="decimal" required value={reward} onChange={e => setReward(e.target.value)}/></label>
        <label>Campaign budget (USDC)<input inputMode="decimal" required value={budget} onChange={e => setBudget(e.target.value)}/></label>
        <label>Participation limit<input type="number" required min={1} max={1000000} step={1} value={form.participationLimit} onChange={e => setForm({ ...form, participationLimit: Number(e.target.value) })}/></label>
        <label>Start date (optional)<input type="datetime-local" value={start} onChange={e => setStart(e.target.value)}/></label>
        <label>Expiration date (optional)<input type="datetime-local" value={end} onChange={e => setEnd(e.target.value)}/></label></div>
      <p className="ab-help">Dates use your device timezone. Leave blank to start when published with no fixed expiration. Published schedules are enforced by the server.</p>
      <label>Paid-promotion disclosure requirements<textarea required maxLength={1000} rows={3} value={form.disclosure} onChange={e => setForm({ ...form, disclosure: e.target.value })}/></label>
      <label className="ab-check"><input type="checkbox" checked={form.evidenceRequired} onChange={e => setForm({ ...form, evidenceRequired: e.target.checked })}/>Require engagement evidence link</label>
      <p className="ab-help">A campaign budget caps reward commitments; it does not deposit USDC into the treasury. Only publish rewards your operation can fund.</p>
      {error && <p className="ab-error" role="alert">{error}</p>}<button className="ab-primary" type="submit">{busy ? 'SAVING…' : task ? 'SAVE CAMPAIGN CHANGES' : 'CREATE DRAFT'}</button>
    </fieldset></form>
  </AdminDialog>;
}
