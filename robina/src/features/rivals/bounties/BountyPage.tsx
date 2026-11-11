import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, Bell, CircleAlert, Radio, ShieldCheck } from 'lucide-react';
import { createDemoGateway } from './demoGateway';
import type { BountyGateway, BountySnapshot, BountyTask } from './model';
import TaskCard from './TaskCard';
import SubmissionDialog from './SubmissionDialog';
import MyBounties from './MyBounties';
import BountyWallet from './BountyWallet';
import Notifications from './Notifications';
import './bounties.css';

export default function BountyPage({ identity, gateway }: { identity: string; gateway?: BountyGateway }) {
  const api = useMemo(() => gateway ?? createDemoGateway(identity), [identity, gateway]);
  const [data, setData] = useState<BountySnapshot | null>(null), [loading, setLoading] = useState(true);
  const [error, setError] = useState(''), [announcement, setAnnouncement] = useState(''), [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<{ task: BountyTask; trigger: HTMLElement } | null>(null);
  const active = useRef(false), locked = useRef(false), request = useRef<AbortController>();
  const load = useCallback(async () => {
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    setLoading(true); setError('');
    try { const next = await api.load(controller.signal); if (!controller.signal.aborted && active.current) setData(next); }
    catch { if (!controller.signal.aborted && active.current) setError('The bounty board could not be loaded. Please try again.'); }
    finally { if (!controller.signal.aborted && active.current) setLoading(false); }
  }, [api]);
  useEffect(() => { active.current = true; void load(); return () => { active.current = false; request.current?.abort(); }; }, [load]);
  async function mutate(action: () => Promise<BountySnapshot>, message: string): Promise<string | null> {
    if (locked.current) return 'Another action is in progress. Please wait.';
    locked.current = true; setBusy(true); setError(''); setAnnouncement('');
    try { const next = await action(); if (active.current) { setData(next); setAnnouncement(message); } return null; }
    catch (cause) { return cause instanceof Error ? cause.message : 'This action could not be saved. Please try again.'; }
    finally { locked.current = false; if (active.current) setBusy(false); }
  }
  const unread = data?.notifications.filter(n => !n.read).length ?? 0;
  return <div className="rb-page">
    <header className="rb-hero"><div className="rb-hero-grid" aria-hidden="true"/><div className="rb-hero-copy">
      <Link className="rh-back" to="/"><ArrowLeft size={15}/>BACK TO LOBBY</Link>
      <span className="rh-eyebrow"><Radio size={14}/>CREATOR OPERATIONS / PHASE 01</span>
      <h1 tabIndex={-1}>BOUNTY <span>&</span> EARN</h1><p>MAKE SOME NOISE.<br/><strong>PUT RIVALS ON THE MAP.</strong></p>
      <span className="rb-hero-description">Original content. Genuine reach. A new kind of contract.</span>
    </div><div className="rb-hero-mark" aria-hidden="true"><span>R</span><small>CREATOR<br/>NETWORK</small></div></header>
    <aside className="rb-phase-notice"><ShieldCheck size={21}/><div><strong>PHASE 1 / INTERACTIVE DEMO</strong><p>Example contracts and simulated USDC only. Submissions stay on this device for your signed-in profile. No live review, real earnings or transfers. Data does not sync to other devices.</p></div></aside>
    <nav className="rb-local-nav" aria-label="Bounty sections"><a href="#active-bounties">ACTIVE BOUNTIES <ArrowUpRight size={14}/></a><a href="#my-bounties">MY BOUNTIES</a><a href="#bounty-wallet">WALLET</a><a href="#bounty-notifications"><Bell size={15}/>INTEL <span>{unread}<span className="sr-only"> unread notifications</span></span></a></nav>
    <p role="status" className="rb-announcement" aria-live="polite">{announcement}</p>
    {loading ? <div className="rb-loading" role="status" aria-label="Loading bounty board"><span className="rh-eyebrow">CONNECTING TO CREATOR COMMAND</span><div/><div/><div/></div> : !data ? <div className="rb-empty rb-load-error" role="alert"><CircleAlert size={28}/><h2>TRANSMISSION INTERRUPTED</h2><p>{error}</p><button className="rh-secondary" onClick={() => void load()}>RETRY BOUNTY BOARD</button></div> : <>
      {data.persistence === 'session' && <p className="rb-error" role="alert">Device storage is unavailable or unreadable. This demo is session-only; submissions may disappear when you leave or reload.</p>}
      {error && <p role="alert" className="rb-error">{error}</p>}
      <div className="rb-layout"><div className="rb-main-column"><section id="active-bounties" className="rb-section" aria-labelledby="rb-active-title">
        <div className="rb-section-heading"><div><span className="rh-eyebrow">THE CREATOR CONTRACT BOARD</span><h2 id="rb-active-title">ACTIVE BOUNTIES</h2></div><span>{data.tasks.filter(t => t.status === 'active').length.toString().padStart(2, '0')} OPEN CONTRACTS</span></div>
        {!data.tasks.length ? <div className="rb-empty"><Radio size={27}/><h3>NEW CONTRACTS INBOUND</h3><p>No bounties are available right now. Check back for your next creator assignment.</p></div> : <div className="rb-task-grid">{data.tasks.map(task => <TaskCard key={task.id} task={task} submission={data.submissions.find(s => s.taskId === task.id)} onOpen={(task, trigger) => setSelected({ task, trigger })}/>)}</div>}
        <div className="rb-review-note"><ShieldCheck size={18}/><p><strong>REACH IS NOT AN AUTOMATIC REWARD.</strong> Every submission requires review for originality, disclosure and authentic engagement. Never buy views or impressions.</p></div>
      </section><MyBounties submissions={data.submissions}/><div id="bounty-notifications"><Notifications notifications={data.notifications} busy={busy} onRead={() => { void mutate(() => api.markNotificationsRead(), 'Notifications marked as read.').then(failure => { if (failure && active.current) setError(failure); }); }}/></div></div>
        <BountyWallet data={data} busy={busy} onSaveAddress={address => mutate(() => api.saveAddress(address), 'Demo Base address saved.')} onWithdraw={input => mutate(() => api.requestWithdrawal(input), 'Demo withdrawal requested. No USDC has been sent.')}/>
      </div>
      {selected && <SubmissionDialog key={selected.task.id} task={selected.task} trigger={selected.trigger} busy={busy} onClose={() => setSelected(null)} onSubmit={async input => {
        const failure = await mutate(() => api.submit(input), 'Submission received — Pending Review. No reward has been credited.');
        if (!failure && active.current) setSelected(null); return failure;
      }}/>}
    </>}
  </div>;
}
