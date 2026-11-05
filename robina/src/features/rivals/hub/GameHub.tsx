import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, Check, ChevronRight, Clock3, Crosshair, Flag, LogOut, Medal, Shield, ShoppingBag, SlidersHorizontal, Swords, Target, Trophy, UserRound } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { HubSettings } from './HubSettings';
import { addRecord, dossierStats, formatTime, OPERATIONS, PREVIEW_STANDINGS, RANKS, readDossier, readPreferences, runScore, saveDossier, savePreferences,isAssignmentUnlocked, type Dossier, type HeistRecord, type HubPreferences } from './model';
import type { MissionSnapshot } from '../missions/types';
import { trapFocus } from '../ui/trapFocus';
import './hub.css';
import './command-theme.css';

const PlayPage = lazy(() => import('./PlayPage'));
const StorePage = lazy(() => import('../store/StorePage'));
const RecoveryPage = lazy(() => import('../store/RecoveryPage'));
const NAV = [
  { to: '/', label: 'LOBBY', icon: Swords }, { to: '/missions', label: 'MISSIONS', icon: Crosshair },
  { to: '/customization', label: 'CUSTOMIZATION', icon: Shield }, { to: '/profile', label: 'PLAYER PROFILE', icon: UserRound },
  { to: '/leaderboards', label: 'LEADERBOARDS', icon: Trophy }, { to: '/rank', label: 'RANK', icon: Medal },
  { to: '/store', label: 'STORE', icon: ShoppingBag },
  { to: '/settings', label: 'SETTINGS', icon: SlidersHorizontal },
];
const ART = '/assets/rivals/hub/menu-keyart-v1.webp';

export default function GameHub() {
  const { baseUser } = useAuth();
  const identity = baseUser?.wallet || 'local-device';
  // Keying by identity prevents one signed-in player's browser dossier leaking
  // into another account. Nothing in this module posts to any API.
  return <Hub key={identity} identity={identity}/>;
}
function Hub({ identity }: { identity: string }) {
  const { signOut } = useAuth();
  const [dossier, setDossier] = useState(() => readDossier(identity));
  const [preferences, setPreferences] = useState(readPreferences);
  const [saved, setSaved] = useState(true), [error, setError] = useState(''), [signingOut, setSigningOut] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const latest = useRef(dossier);
  const { pathname } = useLocation();
  const title = useRef<HTMLDivElement>(null);
  useEffect(() => { title.current?.querySelector<HTMLElement>('h1')?.focus(); window.scrollTo?.(0,0); }, [pathname]);
  const updateDossier = useCallback((update: (old: Dossier) => Dossier) => {
    const next = update(latest.current); latest.current = next;
    setSaved(saveDossier(identity, next)); setDossier(next);
  }, [identity]);
  const record = useCallback((mission: MissionSnapshot, venue: number) => updateDossier(old => addRecord(old, mission, venue)), [updateDossier]);
  const updateSettings = (patch: Partial<HubPreferences>) => setPreferences(old => { const next = { ...old, ...patch }; setSaved(savePreferences(next)); return next; });
  const stats = dossierStats(dossier);
  const settings = (back?: () => void) => <HubSettings value={preferences} onChange={updateSettings} saved={saved} onBack={back}/>;
  if (pathname === '/play') return <Suspense fallback={<main className="rh-loading" role="status">PREPARING INSERTION…</main>}><PlayPage dossier={dossier} preferences={preferences} onResult={record} renderSettings={settings}/></Suspense>;
  return <div className="rh-app" data-emblem={dossier.emblem} data-reduced={preferences.motion === 'reduce'}>
    <a className="rh-skip" href="#rh-content">Skip to content</a>
    <header className="rh-topbar"><Link to="/" className="rh-brand" aria-label="RIVALS lobby"><span className="rh-crest"><Swords size={24}/></span><span><strong>RIVALS</strong><small>RIVAL HEIST</small></span></Link><span className="rh-status"><i/> SOLO OPERATIONS <b>/</b> FRONTEND BUILD</span><Link to="/profile" className="rh-header-profile"><span className="rh-mini-emblem"><Shield size={18}/></span><span><strong>{dossier.callsign}</strong><small>{stats.rank.name} · DEVICE PROFILE</small></span></Link><button className="rh-icon-button" aria-label="Exit game menu" onClick={() => setExitOpen(true)}><LogOut size={18}/></button></header>
    {pathname !== '/' && <nav className="rh-subnav" aria-label="Game navigation">{NAV.map(({to,label,icon:Icon}) => <NavLink key={to} end={to==='/'} to={to}><Icon size={14}/>{label}</NavLink>)}</nav>}
    <main id="rh-content" ref={title} className={pathname === '/' ? 'rh-main rh-main-lobby' : 'rh-main'}>
      <Routes>
        <Route index element={<Lobby dossier={dossier} onExit={() => setExitOpen(true)}/>}/>
        <Route path="missions" element={<Missions dossier={dossier}/>}/>
        <Route path="profile" element={<Profile dossier={dossier}/>}/>
        <Route path="leaderboards" element={<Leaderboards dossier={dossier}/>}/>
        <Route path="rank" element={<Ranks dossier={dossier}/>}/>
        <Route path="settings" element={settings()}/>
        <Route path="store/*" element={<Suspense fallback={<p role="status">OPENING THE EXCHANGE…</p>}><StorePage reduced={preferences.motion==='reduce'}/></Suspense>}/>
        <Route path="inventory" element={<Suspense fallback={<p role="status">OPENING FIELD LOCKER…</p>}><StorePage reduced={preferences.motion==='reduce'}/></Suspense>}/>
        <Route path="purchase-history" element={<Suspense fallback={<p role="status">OPENING PURCHASE HISTORY…</p>}><StorePage reduced={preferences.motion==='reduce'}/></Suspense>}/>
        <Route path="recovery" element={<Suspense fallback={<p role="status">OPENING RECOVERY PREVIEW…</p>}><RecoveryPage/></Suspense>}/>
        <Route path="customization" element={<Customization dossier={dossier} onSave={(callsign,emblem) => updateDossier(old => ({...old,callsign,emblem}))} saved={saved}/>}/>
        <Route path="leaderboard" element={<Navigate to="/leaderboards" replace/>}/>
        <Route path="*" element={<Navigate to="/" replace/>}/>
      </Routes>
    </main>
    <footer className="rh-footer"><span><i/> RIVALS / RIVAL HEIST</span><span>LOCAL PROGRESS · NO ONLINE SYNC</span><span>MAKE YOUR OWN WAY OUT.</span></footer>
    {exitOpen && <div className="rh-modal-backdrop"><section className="rh-panel rh-exit-modal" role="dialog" aria-modal="true" aria-labelledby="rh-exit-title" onKeyDown={e => { if(e.key==='Escape')setExitOpen(false); else trapFocus(e); }}><span className="rh-eyebrow">END OF TRANSMISSION</span><h2 id="rh-exit-title">LEAVING SO SOON?</h2><p>Your saved device history and preferences stay here. Sign out to return to the login screen.</p>{error && <p role="alert">{error}</p>}<button className="rh-primary" autoFocus onClick={() => setExitOpen(false)}>STAY IN THE CITY <ChevronRight size={18}/></button><button className="rh-quiet" disabled={signingOut} onClick={async () => { setSigningOut(true); setError(''); try { await signOut(); } catch { setError('Sign-out did not finish. Check your connection and retry.'); } finally { setSigningOut(false); } }}>{signingOut ? 'SIGNING OUT…' : 'SIGN OUT'}</button></section></div>}
  </div>;
}
function PageHeading({ code, title, description }: { code: string; title: string; description: string }) {
  return <header className="rh-page-heading"><Link className="rh-back" to="/"><ArrowLeft size={15}/> BACK TO LOBBY</Link><span className="rh-eyebrow">OPERATIVE COMMAND / {code}</span><h1 tabIndex={-1}>{title}<span>.</span></h1><p>{description}</p></header>;
}
function Lobby({ dossier, onExit }: { dossier: Dossier; onExit: () => void }) {
  const stats = dossierStats(dossier), next = OPERATIONS.find(op => isAssignmentUnlocked(dossier,op.venue)&&!dossier.records.some(r => r.venue===op.venue && r.state==='SUCCESS')) || OPERATIONS[0];
  return <><section className="rh-lobby" aria-label="RIVALS main menu"><div className="rh-lobby-art" style={{backgroundImage:`url(${ART})`}} aria-hidden="true"/><div className="rh-lobby-grid" aria-hidden="true"/>
    <div className="rh-lobby-copy"><span className="rh-eyebrow">THE CITY KEEPS ITS SECRETS.</span><h1 tabIndex={-1}>RIVAL<br/><em>HEIST.</em></h1><p>Get in. Find your edge.<br/>Leave your rivals behind.</p><nav className="rh-main-actions" aria-label="Main menu"><Link className="rh-primary" to={'/play?operation='+next.id}><Swords size={20}/><span>PLAY</span><ArrowUpRight size={21}/></Link>{NAV.slice(1).map(({to,label,icon:Icon}) => <Link to={to} key={to}><Icon size={18}/><span>{label === 'CUSTOMIZATION' ? 'CHARACTER CUSTOMIZATION' : label}</span>{to==='/missions' && <small>7 ASSIGNMENTS</small>}{to==='/leaderboards' && <small>PREVIEW</small>}<ChevronRight size={14}/></Link>)}<button className="rh-menu-exit" onClick={onExit}><ArrowLeft size={17}/><span>EXIT / BACK</span></button></nav></div>
    <div className="rh-lobby-caption"><span>FINANCIAL DISTRICT / 18:42</span><b>NO CLEAN GETAWAYS.</b><small>MENU KEY ART · NOT IN-GAME FOOTAGE</small></div>
    <aside className="rh-insertion"><span className="rh-eyebrow">NEXT INSERTION / {next.code}</span><h2>{next.name}</h2><p>{next.location}</p><div className="rh-insertion-meta"><span><Target size={13}/> {next.type}</span><span><Clock3 size={13}/> NO DEADLINE</span></div><Link to="/missions">OPERATION BRIEF <ArrowUpRight size={16}/></Link></aside>
  </section><section className="rh-lobby-bottom"><div><Shield size={28}/><span><small>YOUR STANDING</small><strong>{stats.rank.name}</strong></span><Link to="/rank">VIEW RANK <ChevronRight size={14}/></Link></div><div><Crosshair size={25}/><span><small>SUCCESSFUL EXTRACTIONS</small><strong>{String(stats.wins).padStart(2,'0')}</strong></span><span className="rh-muted">LOCAL RECORD</span></div><div><Clock3 size={25}/><span><small>PERSONAL BEST</small><strong>{formatTime(stats.best)}</strong></span><Link to="/profile">DOSSIER <ChevronRight size={14}/></Link></div></section></>;
}
function Stat({ label, value, children }: { label: string; value: ReactNode; children?: ReactNode }) {
  return <div className="rh-stat"><span>{label}</span><strong>{value}</strong>{children && <small>{children}</small>}</div>;
}
function Empty({ title, children }: { title: string; children: ReactNode }) {
  return <div className="rh-empty"><Flag size={27}/><h3>{title}</h3><p>{children}</p><Link className="rh-text-link" to="/play">PLAN AN INSERTION <ArrowUpRight size={15}/></Link></div>;
}
function History({ records }: { records: HeistRecord[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  if (!records.length) return <Empty title="YOUR STORY STARTS OUT THERE.">Complete a heist to build your operation history. No completed missions have been recorded in this browser yet.</Empty>;
  return <div className="rh-history">{records.map(record => <article key={record.runId} className="rh-history-row"><button aria-expanded={expanded === record.runId} onClick={() => setExpanded(expanded===record.runId ? null : record.runId)}><span className={'rh-result-icon '+record.state.toLowerCase()}>{record.state==='SUCCESS' ? <Check size={18}/> : <Flag size={18}/>}</span><span><strong>{OPERATIONS[record.venue].name}</strong><small>{new Date(record.finishedAt).toLocaleDateString(undefined,{month:'short',day:'numeric'})} · {record.completed}/{record.mandatory??10} OBJECTIVES</small></span><b className={'rh-result '+record.state.toLowerCase()}>{record.state==='SUCCESS' ? 'COMPLETED' : record.state==='FAILED' ? 'FAILED' : 'ABANDONED'}</b><time>{formatTime(record.seconds)}</time><ChevronRight size={15}/></button>{expanded===record.runId && <div className="rh-run-details"><p>{record.kills} eliminations · {record.shots} shots · {record.hits} hits · {runScore(record).toLocaleString()} practice points</p><h4>COMPLETED OBJECTIVES</h4>{record.objectives.length ? <ul>{record.objectives.map((title,i) => <li key={i}><Check size={13}/>{title}</li>)}</ul> : <p>No objectives completed.</p>}</div>}</article>)}</div>;
}
function Missions({ dossier }: { dossier: Dossier }) {
  const [filter, setFilter] = useState('all');
  const records = dossier.records.filter(r => filter==='all' || (filter==='completed' ? r.state==='SUCCESS' : r.state!=='SUCCESS'));
  return <><PageHeading code="01" title="OPERATIONS" description="Choose your next job. Review every route you took and every extraction you earned."/><div className="rh-section-head"><h2>AVAILABLE CONTRACTS</h2><span>CONTINUOUS CAMPAIGN / REPLAYABLE</span></div><div className="rh-mission-grid">{OPERATIONS.map(op => { const wins=dossier.records.filter(r => r.venue===op.venue && r.state==='SUCCESS'),unlocked=isAssignmentUnlocked(dossier,op.venue); return <article className="rh-mission-card" key={op.id} data-locked={!unlocked} data-accent={op.accent}><div className="rh-mission-visual" style={{backgroundImage:`url(${ART})`}}><span>OP / {op.code}</span><span>{wins.length ? <><Check size={12}/> COMPLETED</> : unlocked?'AUTHORIZED':'CLASSIFIED'}</span><Crosshair className="rh-reticle-art" size={50}/></div><div className="rh-mission-body"><span className="rh-eyebrow">{op.type}</span><h2>{op.name}</h2><p>{op.description}</p><div className="rh-mission-data"><span>BEST EXTRACTION <b>{formatTime(wins.length ? Math.min(...wins.map(r=>r.seconds)) : null)}</b></span><span>COMPLETED <b>{String(wins.length).padStart(2,'0')}</b></span></div><Link className="rh-secondary" to={'/play?operation='+op.id}>{!unlocked?'REVIEW UNLOCK REQUIREMENT':wins.length?'REPLAY OPERATION':'VIEW BRIEFING'}<ArrowUpRight size={16}/></Link></div></article>; })}</div><div className="rh-section-head rh-history-heading"><h2>OPERATION HISTORY</h2><span>BROWSER RECORDS</span></div><div className="rh-tabs" role="group" aria-label="History filter">{[['all','ALL RUNS'],['completed','COMPLETED'],['other','OTHER OUTCOMES']].map(([id,label]) => <button key={id} aria-pressed={filter===id} onClick={()=>setFilter(id)}>{label}</button>)}</div><History records={records}/><p className="rh-local-notice">History is saved only in this browser for this profile. Clearing browser data removes it; it does not sync between devices.</p></>;
}
function Profile({ dossier }: { dossier: Dossier }) {
  const stats=dossierStats(dossier);
  return <><PageHeading code="03" title="PLAYER DOSSIER" description="Your operations. Your best times. Your story so far."/><section className="rh-dossier-banner"><div className={'rh-large-emblem '+dossier.emblem}><Shield size={56}/><span>{stats.rankIndex+1}</span></div><div><span className="rh-eyebrow">FIELD OPERATIVE / LOCAL PROFILE</span><h2>{dossier.callsign}</h2><p>{stats.rank.name} <span>·</span> {stats.score.toLocaleString()} PRACTICE POINTS</p></div><Link className="rh-secondary" to="/customization">EDIT DOSSIER <ArrowUpRight size={16}/></Link></section><div className="rh-stat-grid"><Stat label="HEISTS COMPLETED" value={String(stats.wins).padStart(2,'0')}/><Stat label="SUCCESS RATE" value={stats.successRate+'%'}>{stats.attempts} recorded runs</Stat><Stat label="BEST EXTRACTION" value={formatTime(stats.best)}/><Stat label="ELIMINATIONS" value={stats.kills}>{stats.shots} shots fired</Stat></div><div className="rh-section-head"><h2>RECENT DEPLOYMENTS</h2><Link to="/missions" className="rh-text-link">FULL HISTORY <ArrowUpRight size={14}/></Link></div><History records={dossier.records.slice(0,5)}/><p className="rh-local-notice">These are your actual browser-saved runs, not global or server-verified statistics.</p></>;
}
function Leaderboards({ dossier }: { dossier: Dossier }) {
  const [scope,setScope]=useState('preview'),[sort,setSort]=useState('score');
  const rows=[...PREVIEW_STANDINGS].sort((a,b)=>sort==='time'?a.best-b.best:sort==='missions'?b.wins-a.wins:b.score-a.score);
  const local=dossier.records.filter(r=>r.state==='SUCCESS').sort((a,b)=>sort==='time'?a.seconds-b.seconds:runScore(b)-runScore(a));
  return <><PageHeading code="04" title="THE RIVALS TO BEAT" description="Performance. Successful heists. Clean extraction times. Nothing else."/><div className="rh-board-toolbar"><div className="rh-tabs" role="group" aria-label="Leaderboard view"><button aria-pressed={scope==='preview'} onClick={()=>setScope('preview')}>PREVIEW STANDINGS</button><button aria-pressed={scope==='local'} onClick={()=>setScope('local')}>MY RECORDED RUNS</button></div><label className="rh-sort">RANK BY <select aria-label="Rank by" value={sort} onChange={e=>setSort(e.target.value)}><option value="score">Performance score</option><option value="missions">Missions completed</option><option value="time">Fastest extraction</option></select></label></div>{scope==='preview' && <><div className="rh-preview-notice"><span>FRONTEND PREVIEW</span><p>Fictional players show the leaderboard design. No online leaderboard or backend is connected.</p></div><div className="rh-podium">{rows.slice(0,3).map((row,i)=><article key={row.callsign} className={i===0?'rh-podium-first':''}><span className="rh-eyebrow">#{String(i+1).padStart(2,'0')} / {i===0?'TOP OPERATIVE':'CONTENDER'}</span><div className={'rh-large-emblem '+row.emblem}><Shield size={38}/></div><h2>{row.callsign}</h2><strong>{(sort==='time'?formatTime(row.best):sort==='missions'?row.wins:row.score.toLocaleString())}</strong><small>{sort==='time'?'BEST EXTRACTION':sort==='missions'?'HEISTS COMPLETED':'PERFORMANCE POINTS'}</small></article>)}</div></>}
    {scope==='local' && !local.length ? <Empty title="NO FINISHED HEISTS. YET.">Your completed runs will be ranked here by performance and extraction time. Preview players never enter your records.</Empty> : <div className="rh-table-wrap"><table className="rh-board"><caption>{scope==='preview'?'PREVIEW STANDINGS · FICTIONAL DATA':'PERSONAL RUN RANKINGS · THIS BROWSER'}</caption><thead><tr><th>RANK</th><th>{scope==='preview'?'OPERATIVE':'OPERATION'}</th><th>SCORE</th><th>{scope==='preview'?'HEISTS':'OBJECTIVES'}</th><th>{scope==='preview'?'BEST TIME':'TIME'}</th></tr></thead><tbody>{scope==='preview'?rows.map((row,i)=><tr key={row.callsign}><td>#{String(i+1).padStart(2,'0')}</td><td><span className={'rh-table-emblem '+row.emblem}><Shield size={17}/></span>{row.callsign}</td><td>{row.score.toLocaleString()}</td><td>{row.wins}</td><td>{formatTime(row.best)}</td></tr>):local.map((row,i)=><tr key={row.runId}><td>#{String(i+1).padStart(2,'0')}</td><td>{OPERATIONS[row.venue].name}</td><td>{runScore(row).toLocaleString()}</td><td>{row.completed}/{row.mandatory??10}</td><td>{formatTime(row.seconds)}</td></tr>)}</tbody></table></div>}<p className="rh-local-notice">Practice scoring: 1,000 per completed heist + up to 600 time-bonus points + 25 per elimination (up to 500). Failures and abandoned runs score zero. No currency or account rewards.</p></>;
}
function Ranks({ dossier }: { dossier: Dossier }) {
  const stats=dossierStats(dossier), progress=stats.next ? Math.min(100,(stats.score-stats.rank.points)/(stats.next.points-stats.rank.points)*100) : 100;
  return <><PageHeading code="05" title="EARN YOUR NAME" description="A local practice rank, built from completed heists—not purchases or mining balances."/><section className="rh-rank-hero"><div className={'rh-large-emblem '+dossier.emblem}><Shield size={70}/><span>{stats.rankIndex+1}</span></div><div><span className="rh-eyebrow">CURRENT PRACTICE RANK</span><h2>{stats.rank.name}</h2><p>{stats.score.toLocaleString()} POINTS {stats.next && <>/ {stats.next.points.toLocaleString()} TO {stats.next.name}</>}</p><progress aria-label="Progress to next rank" value={progress} max="100"/><small>{stats.next ? (stats.next.points-stats.score).toLocaleString()+' points to your next promotion.' : 'Highest local practice tier achieved.'}</small></div></section><div className="rh-section-head"><h2>THE RANK LADDER</h2><span>06 / TIERS</span></div><div className="rh-rank-ladder">{RANKS.map((rank,i)=><article className={i===stats.rankIndex?'current':''} key={rank.name}><span className="rh-eyebrow">TIER {String(i+1).padStart(2,'0')}</span><Shield size={35}/><h3>{rank.name}</h3><p>{rank.points.toLocaleString()} PTS</p><small>{i===stats.rankIndex?'CURRENT RANK':i<stats.rankIndex?'ACHIEVED':'NEXT OBJECTIVE'}</small></article>)}</div><p className="rh-local-notice">Rank is calculated from records saved in this browser. This is not a shared online competitive rank.</p></>;
}
function Customization({ dossier, onSave, saved }: { dossier: Dossier; onSave: (callsign: string,emblem: Dossier['emblem'])=>void; saved: boolean }) {
  const [callsign,setCallsign]=useState(dossier.callsign),[emblem,setEmblem]=useState(dossier.emblem),[message,setMessage]=useState('');
  return <><PageHeading code="02" title="MAKE IT YOURS" description="Your callsign. Your colors. A dossier that feels like you."/><div className="rh-custom-layout"><section className="rh-operative-preview" style={{backgroundImage:`url(${ART})`}}><div className="rh-operative-label"><span className="rh-eyebrow">FIELD OPERATIVE</span><h2>{callsign || 'VEX'}</h2><span className={'rh-calling-card '+emblem}><Shield size={22}/> {dossierStats(dossier).rank.name}</span></div><small>MENU KEY ART · IN-GAME MODEL UNCHANGED</small></section><form className="rh-panel rh-custom-form" onSubmit={e=>{e.preventDefault();if(!/^[a-zA-Z0-9 _-]{2,20}$/.test(callsign.trim())){setMessage('Use 2–20 letters, numbers, spaces, hyphens or underscores.');return;}onSave(callsign.trim().toUpperCase(),emblem);setMessage('Dossier updated.');}}><div className="rh-section-head"><h2>OPERATIVE IDENTITY</h2><span>PERSONALIZE</span></div><label className="rh-input-label">CALLSIGN<input aria-label="Callsign" value={callsign} maxLength={20} onChange={e=>setCallsign(e.target.value)}/><small>2–20 characters. This name is used on your local profile.</small></label><fieldset className="rh-emblem-picker"><legend>CALLING CARD FINISH</legend>{(['gold','ice','ember'] as const).map(color=><button type="button" key={color} className={color} aria-label={color+' calling card'} aria-pressed={emblem===color} onClick={()=>setEmblem(color)}><Shield size={28}/><span>{color.toUpperCase()}</span>{emblem===color && <Check size={14}/>}</button>)}</fieldset><p className="rh-muted">Calling cards style your menu, profile and rank insignia. They do not replace the player model, change weapons or grant gameplay advantages.</p><button className="rh-primary" type="submit">SAVE IDENTITY <Check size={17}/></button><p role="status" className="rh-save-note">{message}{!saved && ' Storage unavailable: changes last for this session only.'}</p></form></div></>;
}
