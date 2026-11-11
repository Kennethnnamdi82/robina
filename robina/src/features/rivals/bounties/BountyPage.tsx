import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, Bell, CircleAlert, ClipboardList, Radio, ShieldCheck, Wallet } from 'lucide-react';
import { createApiGateway } from './apiGateway';
import type { BountyGateway, BountySnapshot, BountyTask } from './model';
import TaskCard from './TaskCard';
import SubmissionDialog from './SubmissionDialog';
import MyBounties from './MyBounties';
import BountyWallet from './BountyWallet';
import Notifications from './Notifications';
import './bounties.css';

export default function BountyPage({ identity, gateway }: { identity: string; gateway?: BountyGateway }) {
  const navigate = useNavigate();
  const api = useMemo(() => gateway ?? createApiGateway(identity), [identity, gateway]);
  const [data, setData] = useState<BountySnapshot | null>(null), [loading, setLoading] = useState(true);
  const [error, setError] = useState(''), [announcement, setAnnouncement] = useState(''), [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<{ task: BountyTask; trigger: HTMLElement } | null>(null);
  const active = useRef(false), locked = useRef(false), request = useRef<AbortController>();
  const load = useCallback(async (quiet = false) => {
    if (locked.current) return;
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    if (!quiet) setLoading(true); setError('');
    try { const next = await api.load(controller.signal); if (!controller.signal.aborted && active.current) setData(next); }
    catch { if (!controller.signal.aborted && active.current) setError('The bounty board could not be loaded. Please try again.'); }
    finally { if (!controller.signal.aborted && active.current) setLoading(false); }
  }, [api]);
  useEffect(() => { active.current = true; void load(); return () => { active.current = false; request.current?.abort(); }; }, [load]);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState !== 'hidden') void load(true); };
    const timer = window.setInterval(refresh, 15000); window.addEventListener('focus', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [load]);
  async function mutate(action: () => Promise<BountySnapshot>, message: string): Promise<string | null> {
    if (locked.current) return 'Another action is in progress. Please wait.';
    locked.current = true; request.current?.abort(); setBusy(true); setError(''); setAnnouncement('');
    try { const next = await action(); if (active.current) { setData(next); setAnnouncement(message); } return null; }
    catch (cause) { return cause instanceof Error ? cause.message : 'This action could not be saved. Please try again.'; }
    finally { locked.current = false; if (active.current) setBusy(false); }
  }
  const unread = data?.notifications.filter(n => !n.read).length ?? 0;
  const demo = data?.mode === 'demo';
  const more = (kind: 'submissions' | 'withdrawals' | 'notifications' | 'ledger') => data?.more?.[kind] && api.more ? <button className="rh-secondary rb-wide" disabled={busy} onClick={() => void mutate(() => api.more!(kind), 'More history loaded.').then(failure => { if (failure) setError(failure); })}>{busy ? 'LOADING…' : 'LOAD MORE ' + kind.toUpperCase()}</button> : null;
  return <div className="rb-page">
    <header className="rb-hero rb-hero-refined"><div className="rb-hero-copy">
      <Link className="rh-back" to="/"><ArrowLeft size={15}/>BACK TO LOBBY</Link>
      <span className="rh-eyebrow">RIVALS / CREATOR NETWORK</span>
      <h1 tabIndex={-1}>BOUNTY <span>&</span> EARN</h1>
      <span className="rb-hero-description">Create something original. Choose your next contract.</span>
    </div><span className="rb-preview-label"><ShieldCheck size={14}/>{demo ? 'PHASE 1 / INTERACTIVE DEMO' : 'VERIFIED CREATOR REWARDS'}</span></header>
    <nav className="rb-screen-nav" aria-label="Bounty sections">
      <NavLink end to="/bounties"><Radio size={16}/>CONTRACTS</NavLink>
      <NavLink to="/bounties/mine"><ClipboardList size={16}/>MY BOUNTIES</NavLink>
      <NavLink to="/bounties/wallet"><Wallet size={16}/>WALLET</NavLink>
      <NavLink to="/bounties/notifications"><Bell size={16}/>NOTIFICATIONS{unread>0&&<span className="rb-unread" aria-label={`${unread} unread notifications`}>{unread}</span>}</NavLink>
    </nav>
    {demo && <p className="rb-preview-footnote">Demo contracts and simulated USDC. No real earnings, reviews or payments. Progress is device-local.</p>}
    <p role="status" className="rb-announcement" aria-live="polite">{announcement}</p>
    {loading ? <div className="rb-loading" role="status" aria-label="Loading bounty board"><span className="rh-eyebrow">CONNECTING TO CREATOR COMMAND</span><div/><div/><div/></div> : !data ? <div className="rb-empty rb-load-error" role="alert"><CircleAlert size={28}/><h2>TRANSMISSION INTERRUPTED</h2><p>{error}</p><button className="rh-secondary" onClick={() => void load()}>RETRY BOUNTY BOARD</button></div> : <>
      {data.persistence === 'session' && <p className="rb-error" role="alert">Device storage is unavailable or unreadable. This demo is session-only; submissions may disappear when you leave or reload.</p>}
      {error && <p role="alert" className="rb-error">{error}</p>}
      <div className="rb-screen"><Routes><Route index element={<section id="active-bounties" className="rb-section" aria-labelledby="rb-active-title">
        <div className="rb-section-heading"><div><span className="rh-eyebrow">MAKE YOUR NEXT MOVE</span><h2 id="rb-active-title">AVAILABLE CONTRACTS</h2></div><span>{data.tasks.filter(t => t.status === 'active').length.toString().padStart(2, '0')} OPEN CONTRACTS</span></div>
        {!data.tasks.length ? <div className="rb-empty"><Radio size={27}/><h3>NEW CONTRACTS INBOUND</h3><p>No bounties are available right now. Check back for your next creator assignment.</p></div> : <div className="rb-task-grid">{data.tasks.map(task => <TaskCard key={task.id} task={task} submission={data.submissions.find(s => s.taskId === task.id)} onOpen={(task, trigger) => setSelected({ task, trigger })}/>)}</div>}
        <div className="rb-review-note"><ShieldCheck size={18}/><p><strong>REACH IS NOT AN AUTOMATIC REWARD.</strong> Every submission requires review for originality, disclosure and authentic engagement. Never buy views or impressions.</p></div>
        <Link className="rb-record-link" to="/bounties/mine">TRACK YOUR SUBMISSIONS <ArrowUpRight size={16}/></Link>
      </section>}/><Route path="mine" element={<><MyBounties submissions={data.submissions}/>{more('submissions')}</>}/>
        <Route path="notifications" element={<><Notifications notifications={data.notifications} busy={busy} onRead={() => { void mutate(() => api.markNotificationsRead(), 'Notifications marked as read.').then(failure => { if (failure && active.current) setError(failure); }); }}/>{more('notifications')}</>}/>
        <Route path="wallet" element={<div className="rb-wallet-screen"><BountyWallet data={data} busy={busy} onSaveAddress={address => mutate(() => api.saveAddress(address), demo ? 'Demo Base address saved.' : 'Base address saved securely.')} onWithdraw={input => mutate(() => api.requestWithdrawal(input), demo ? 'Demo withdrawal requested. No USDC has been sent.' : 'Withdrawal requested. Funds reserved pending admin review; not yet paid.')}/>{more('withdrawals')}{more('ledger')}</div>}/>
        <Route path="*" element={<p>Choose a creator screen above.</p>}/>
      </Routes></div>
      {selected && <SubmissionDialog key={selected.task.id} task={selected.task} trigger={selected.trigger} demo={demo} busy={busy} onClose={() => setSelected(null)} onSubmit={async input => {
        const failure = await mutate(() => api.submit(input), 'Submission received — Pending Review. No reward has been credited.');
        if (!failure && active.current) { setSelected(null); navigate('/bounties/mine'); } return failure;
      }}/>}
    </>}
  </div>;
}
