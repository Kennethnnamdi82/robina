import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, Award, BadgeCheck, Check, ChevronRight, Clock3, Crosshair, Flag, LockKeyhole, LogOut, Medal, Radio, Shield, ShoppingBag, SlidersHorizontal, Sparkles, Swords, Target, Trophy, UserRound } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { HubSettings } from './HubSettings';
import LeaderboardPage from './LeaderboardPage';
import { MissionDifficulty, OperationArt } from './OperationArt';
import { addRecord, dossierStats, formatTime, OPERATIONS, RANKS, readDossier, readPreferences, runScore, saveDossier, savePreferences,isAssignmentUnlocked, type Dossier, type HeistRecord, type HubPreferences } from './model';
import type { MissionSnapshot } from '../missions/types';
import { trapFocus } from '../ui/trapFocus';
import './hub.css';
import './command-theme.css';
import './readability.css';
import './cinematic.css';
import '../three/social.css';
import { createPlayerEconomy, gameMoney } from '../progression/PlayerEconomy';
import { usePlayerEconomy } from '../progression/usePlayerEconomy';

const PlayPage = lazy(() => import('./PlayPage'));
const StorePage = lazy(() => import('../store/StorePage'));
const RecoveryPage = lazy(() => import('../store/RecoveryPage'));
const BountyPage = lazy(() => import('../bounties/BountyPage'));
const NAV = [
  { to: '/', label: 'LOBBY', icon: Swords }, { to: '/missions', label: 'MISSIONS', icon: Crosshair },
  { to: '/customization', label: 'CUSTOMIZATION', icon: Shield }, { to: '/inventory', label: 'LOADOUT', icon: Target }, { to: '/profile', label: 'PLAYER PROFILE', icon: UserRound },
  { to: '/leaderboards', label: 'LEADERBOARDS', icon: Trophy }, { to: '/rank', label: 'RANK', icon: Medal },
  { to: '/store', label: 'STORE', icon: ShoppingBag },
  { to: '/bounties', label: 'BOUNTY & EARN', icon: Radio },
  { to: '/settings', label: 'SETTINGS', icon: SlidersHorizontal },
];
const ART = '/assets/rivals/hub/command-keyart-v2.webp';

export default function GameHub() {
  const { baseUser } = useAuth();
  const identity = baseUser?.wallet || 'local-device';
  // Keying by identity prevents one signed-in player's browser dossier leaking
  // into another account — Nothing in this module posts to any API.
  return <Hub key={identity} identity={identity}/>;
}
function Hub({ identity }: { identity: string }) {
  const economy=useMemo(()=>createPlayerEconomy(identity),[identity]);
  const balances=usePlayerEconomy(economy);
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
  if (pathname === '/play') return <Suspense fallback={<main className="rh-loading" role="status">PREPARING INSERTION…</main>}><PlayPage dossier={dossier} preferences={preferences} economy={economy} onResult={record} renderSettings={settings}/></Suspense>;
  return <div className="rh-app" data-emblem={dossier.emblem} data-contrast={preferences.highContrast} data-reduced={preferences.motion === 'reduce'}>
    <a className="rh-skip" href="#rh-content">Skip to content</a>
    <header className="rh-topbar"><Link to="/" className="rh-brand" aria-label="RIVALS lobby"><span className="rh-crest"><Swords size={24}/></span><span><strong>RIVALS</strong><small>RIVAL HEIST</small></span></Link><span className="rh-status"><i/> SOLO OPERATIONS</span><div className="rh-campaign-wallet" aria-label="Campaign balances"><span>REVIVE COINS<strong>{balances.coins.toLocaleString()}</strong></span><span>MISSION CASH<strong>{gameMoney(balances.cash)}</strong></span></div><Link to="/profile" className="rh-header-profile"><span className="rh-mini-emblem"><Shield size={18}/></span><span><strong>{dossier.callsign}</strong><small>{stats.rank.name} · DEVICE PROFILE</small></span></Link><button className="rh-icon-button" aria-label="Exit game menu" onClick={() => setExitOpen(true)}><LogOut size={18}/></button></header>
    {pathname !== '/' && <nav className="rh-subnav" aria-label="Game navigation">{NAV.map(({to,label,icon:Icon}) => <NavLink key={to} end={to==='/'} to={to}><Icon size={14}/>{label}</NavLink>)}</nav>}
    <main id="rh-content" ref={title} className={pathname === '/' ? 'rh-main rh-main-lobby' : 'rh-main'}>
      <Routes>
        <Route index element={<Lobby dossier={dossier} cash={balances.cash} coins={balances.coins} awards={Object.keys(balances.rewards).length} onExit={() => setExitOpen(true)}/>}/>
        <Route path="missions" element={<Missions dossier={dossier}/>}/>
        <Route path="profile" element={<Profile dossier={dossier}/>}/>
        <Route path="leaderboards" element={<LeaderboardPage dossier={dossier}/>}/>
        <Route path="rank" element={<Ranks dossier={dossier}/>}/>
        <Route path="settings" element={settings()}/>
        <Route path="bounties/*" element={<Suspense fallback={<p role="status">OPENING CREATOR COMMAND…</p>}><BountyPage identity={identity}/></Suspense>}/>
        <Route path="store/*" element={<Suspense fallback={<p role="status">OPENING THE EXCHANGE…</p>}><StorePage reduced={preferences.motion==='reduce'}/></Suspense>}/>
        <Route path="inventory" element={<Suspense fallback={<p role="status">OPENING FIELD LOCKER…</p>}><StorePage reduced={preferences.motion==='reduce'}/></Suspense>}/>
        <Route path="purchase-history" element={<Suspense fallback={<p role="status">OPENING PURCHASE HISTORY…</p>}><StorePage reduced={preferences.motion==='reduce'}/></Suspense>}/>
        <Route path="recovery" element={<Suspense fallback={<p role="status">OPENING RECOVERY PREVIEW…</p>}><RecoveryPage/></Suspense>}/>
        <Route path="customization" element={<Customization dossier={dossier} onSave={(callsign,emblem) => updateDossier(old => ({...old,callsign,emblem}))} saved={saved}/>}/>
        <Route path="leaderboard" element={<Navigate to="/leaderboards" replace/>}/>
        <Route path="*" element={<Navigate to="/" replace/>}/>
      </Routes>
    </main>
    <footer className="rh-footer"><span><i/> RIVALS / RIVAL HEIST</span><span>PROGRESS SAVED ON THIS DEVICE</span><span>MAKE YOUR OWN WAY OUT</span></footer>
    {exitOpen && <div className="rh-modal-backdrop"><section className="rh-panel rh-exit-modal" role="dialog" aria-modal="true" aria-labelledby="rh-exit-title" onKeyDown={e => { if(e.key==='Escape')setExitOpen(false); else trapFocus(e); }}><span className="rh-eyebrow">END OF TRANSMISSION</span><h2 id="rh-exit-title">LEAVING SO SOON?</h2><p>Your saved device history and preferences stay here — Sign out to return to the login screen</p>{error && <p role="alert">{error}</p>}<button className="rh-primary" autoFocus onClick={() => setExitOpen(false)}>STAY IN THE CITY <ChevronRight size={18}/></button><button className="rh-quiet" disabled={signingOut} onClick={async () => { setSigningOut(true); setError(''); try { await signOut(); } catch { setError('Sign-out did not finish — Check your connection and retry'); } finally { setSigningOut(false); } }}>{signingOut ? 'SIGNING OUT…' : 'SIGN OUT'}</button></section></div>}
  </div>;
}
function PageHeading({ code, title, description }: { code: string; title: string; description: string }) {
  return <header className="rh-page-heading"><Link className="rh-back" to="/"><ArrowLeft size={15}/> BACK TO LOBBY</Link><span className="rh-eyebrow">OPERATIVE COMMAND / {code}</span><h1 tabIndex={-1}>{title}</h1><p>{description}</p></header>;
}
function Lobby({ dossier, onExit,cash,coins,awards }: { dossier: Dossier; onExit: () => void;cash:number;coins:number;awards:number }) {
  const stats = dossierStats(dossier), next = OPERATIONS.find(op => !dossier.records.some(r => r.venue===op.venue && r.state==='SUCCESS')) || OPERATIONS[((dossier.records.find(r=>r.state==='SUCCESS')?.venue??-1)+1)%OPERATIONS.length];
  return <><section className="rh-lobby rh-command-lobby" aria-label="RIVALS main menu">
    <div className="rh-lobby-art" style={{backgroundImage:`url(${ART})`}} aria-hidden="true"/>
    <div className="rh-lobby-copy"><span className="rh-eyebrow"><i/> SOLO CAMPAIGN / {OPERATIONS.length} CONTRACTS</span><h1 tabIndex={-1}>RIVAL<br/><em>HEIST<span>01</span></em></h1><p>THE CITY IS YOURS.<br/><strong>IF YOU CAN GET OUT.</strong></p>
      <div className="rh-lobby-promos"><Link to="/store/characters"><img src="/assets/rivals/store/commander.webp" alt=""/><span><small>THE COMMAND COLLECTION</small><b>LEAVE A SIGNATURE.</b><em>EXPLORE THE STORE <ArrowUpRight size={13}/></em></span></Link><Link to="/inventory"><Crosshair size={19}/><span><small>QUARTERMASTER</small><b>YOUR FIELD LOCKER</b></span><ArrowUpRight size={16}/></Link></div>
    </div>
    <div className="rh-operative-tag"><span>FIELD OPERATIVE / {dossier.callsign}</span><b>{stats.rank.name}</b><small>READY FOR INSERTION</small></div>
    <nav className="rh-command-nav" aria-label="Main menu">{NAV.slice(1).map(({to,label,icon:Icon},index) => <Link to={to} key={to} aria-label={label==='CUSTOMIZATION'?'CHARACTER CUSTOMIZATION':label}><span className="rh-nav-index" aria-hidden="true">0{index+1}</span><span><b>{label}</b><small>{to==='/missions'?OPERATIONS.length+' JOBS. YOUR NEXT PAYDAY.':to==='/store'?'HARDWARE / IDENTITY / SIGNATURE':to==='/bounties'?'CREATE / SUBMIT / TRACK':to==='/leaderboards'?'EXHIBITION & YOUR RECORDED RUNS':to==='/profile'?'YOUR RECORD. YOUR REPUTATION.':to==='/settings'?'CONFIGURE YOUR EXPERIENCE':to==='/rank'?'EARN YOUR NEXT INSIGNIA':to==='/inventory'?'ISSUED KIT / VERIFIED COLLECTION':'CALLSIGN / CREST / IDENTITY'}</small></span><Icon size={21}/></Link>)}</nav>
    <div className="rh-lobby-deploy"><div><span className="rh-eyebrow">NEXT CONTRACT / {String(next.venue+1).padStart(2,'0')}</span><h2>{next.name}</h2><p>{next.location}</p></div><Link className="rh-primary rh-play" to={'/play?operation='+next.id} aria-label="PLAY"><PlayGlyph/><span>PLAY<small>DEPLOY TO OPERATION</small></span><ArrowUpRight size={25}/></Link></div>
    <button className="rh-command-exit" onClick={onExit}><LogOut size={15}/><span>EXIT / BACK</span></button>
  </section><section className="rh-lobby-bottom"><div><Shield size={25}/><span><small>YOUR STANDING</small><strong>{stats.rank.name}</strong></span><Link to="/rank">VIEW RANK <ChevronRight size={14}/></Link></div><div><Crosshair size={24}/><span><small>SUCCESSFUL EXTRACTIONS</small><strong>{String(stats.wins).padStart(2,'0')}</strong></span><span className="rh-muted">LOCAL RECORD</span></div><div><Clock3 size={24}/><span><small>PERSONAL BEST</small><strong>{formatTime(stats.best)}</strong></span><Link to="/profile">DOSSIER <ChevronRight size={14}/></Link></div></section><section className="rh-campaign-awards" aria-label="Campaign earnings and achievements"><div><span>MISSION ACHIEVEMENTS</span><strong>{awards} CONTRACT PAYOUTS</strong></div><div><span>REVIVE COINS</span><strong>{coins.toLocaleString()}</strong></div><div><span>SPENDING CASH</span><strong>{gameMoney(cash)}</strong></div><p>Earn coins for revives and cash for food, drinks and nightlife. Fictional currency, saved on this device.</p></section></>;
}
function PlayGlyph(){return <svg viewBox="0 0 24 24" width="25" height="25" fill="currentColor" aria-hidden="true"><path d="M6 3.5 21 12 6 20.5V3.5Z"/></svg>;}
function Stat({ label, value, children }: { label: string; value: ReactNode; children?: ReactNode }) {
  return <div className="rh-stat"><span>{label}</span><strong>{value}</strong>{children && <small>{children}</small>}</div>;
}
function Empty({ title, children }: { title: string; children: ReactNode }) {
  return <div className="rh-empty"><Flag size={27}/><h3>{title}</h3><p>{children}</p><Link className="rh-text-link" to="/play">PLAN AN INSERTION <ArrowUpRight size={15}/></Link></div>;
}
function History({ records }: { records: HeistRecord[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  if (!records.length) return <Empty title="YOUR STORY STARTS OUT THERE">Complete a heist to build your operation history — No completed missions have been recorded in this browser yet</Empty>;
  return <div className="rh-history">{records.map(record => <article key={record.runId} className="rh-history-row"><button aria-expanded={expanded === record.runId} onClick={() => setExpanded(expanded===record.runId ? null : record.runId)}><span className={'rh-result-icon '+record.state.toLowerCase()}>{record.state==='SUCCESS' ? <Check size={18}/> : <Flag size={18}/>}</span><span><strong>{OPERATIONS[record.venue].name}</strong><small>{new Date(record.finishedAt).toLocaleDateString(undefined,{month:'short',day:'numeric'})} · {record.completed}/{record.mandatory??10} OBJECTIVES</small></span><b className={'rh-result '+record.state.toLowerCase()}>{record.state==='SUCCESS' ? 'COMPLETED' : record.state==='FAILED' ? 'FAILED' : 'ABANDONED'}</b><time>{formatTime(record.seconds)}</time><ChevronRight size={15}/></button>{expanded===record.runId && <div className="rh-run-details"><p>{record.kills} eliminations · {record.shots} shots · {record.hits} hits · {runScore(record).toLocaleString()} practice points</p><h4>COMPLETED OBJECTIVES</h4>{record.objectives.length ? <ul>{record.objectives.map((title,i) => <li key={i}><Check size={13}/>{title}</li>)}</ul> : <p>No objectives completed</p>}</div>}</article>)}</div>;
}
function Missions({ dossier }: { dossier: Dossier }) {
  const [filter, setFilter] = useState('all');
  const records = dossier.records.filter(r => filter==='all' || (filter==='completed' ? r.state==='SUCCESS' : r.state!=='SUCCESS'));
  return <><PageHeading code="01" title="OPERATIONS" description={OPERATIONS.length+" contracts. From bank vaults to bridge interceptions. Earn your extraction."}/>
    <div className="rh-section-head"><h2>AVAILABLE CONTRACTS</h2><span>CONTINUOUS CAMPAIGN / REPLAYABLE</span></div>
    <div className="rh-mission-grid">{OPERATIONS.map(op=>{
      const wins=dossier.records.filter(r=>r.venue===op.venue&&r.state==='SUCCESS'),unlocked=isAssignmentUnlocked(dossier,op.venue);
      return <article className="rh-mission-card" key={op.id} data-locked={!unlocked} data-stage={op.venue}>
        <div className="rh-mission-visual"><div className="rh-recon-label"><span>CONTRACT / {String(op.venue+1).padStart(2,'0')}</span><span>{wins.length?<><Check size={12}/> COMPLETED</>:unlocked?'AUTHORIZED':'CLASSIFIED'}</span></div><OperationArt assignment={op}/><strong className="rh-mission-number">0{op.venue+1}</strong></div>
        <div className="rh-mission-body"><span className="rh-eyebrow">{op.type} / {op.location}</span><h2>{op.name}</h2><MissionDifficulty stage={op.venue}/><p>{op.description}</p><div className="rh-mission-data"><span>BEST EXTRACTION <b>{formatTime(wins.length?Math.min(...wins.map(r=>r.seconds)):null)}</b></span><span>COMPLETED <b>{String(wins.length).padStart(2,'0')}</b></span><span>SECURITY <b>{op.security} UNITS</b></span></div><Link className="rh-secondary" to={'/play?operation='+op.id}>{!unlocked?'REVIEW UNLOCK REQUIREMENT':wins.length?'REPLAY OPERATION':'VIEW BRIEFING'}<ArrowUpRight size={16}/></Link></div>
      </article>;
    })}</div><div className="rh-section-head rh-history-heading"><h2>OPERATION HISTORY</h2><span>DEVICE RECORDS</span></div><div className="rh-tabs" role="group" aria-label="History filter">{[['all','ALL RUNS'],['completed','COMPLETED'],['other','OTHER OUTCOMES']].map(([id,label])=><button key={id} aria-pressed={filter===id} onClick={()=>setFilter(id)}>{label}</button>)}</div><History records={records}/><p className="rh-local-notice">History is saved only on this device for this profile. It does not sync between devices.</p></>;
}
function Profile({ dossier }: { dossier: Dossier }) {
  const stats=dossierStats(dossier);
  const progression=profileProgress(stats.score);
  const achievements=profileAchievements(stats);
  const cosmetics=profileCosmetics(dossier,stats,achievements);
  return <><PageHeading code="03" title="OPERATIVE PROFILE" description="Identity, progression and the record you have earned in the city"/>
    <section className="rh-profile-hero">
      <div className="rh-profile-portrait" style={{backgroundImage:`url(${ART})`}} aria-hidden="true"><span>ACTIVE OPERATIVE</span><div className={'rh-profile-insignia '+dossier.emblem}><Shield size={31}/><b>LVL<br/>{String(progression.level).padStart(2,'0')}</b></div></div>
      <div className="rh-profile-identity"><span className="rh-eyebrow">RIVALS COMMAND / FIELD DOSSIER</span><div className="rh-profile-name"><div className={'rh-large-emblem '+dossier.emblem}><Shield size={42}/><span>{stats.rankIndex+1}</span></div><div><h2>{dossier.callsign}</h2><p>{stats.rank.name} <i/> EQUIPPED: {dossier.emblem.toUpperCase()} CREST</p></div></div><div className="rh-xp"><div><span>OPERATIVE LEVEL {progression.level}</span><b>{progression.current.toLocaleString()} / {progression.needed.toLocaleString()} XP</b></div><progress aria-label="Level progress" value={progression.current} max={progression.needed}/><small>{progression.remaining.toLocaleString()} XP UNTIL LEVEL {progression.level + 1} <em>LOCAL PRACTICE XP</em></small></div></div>
      <div className="rh-profile-actions"><Link className="rh-secondary" to="/customization">CUSTOMIZE IDENTITY <ArrowUpRight size={16}/></Link><span><BadgeCheck size={15}/> SECURE RAID RECORDS<br/><small>AWAITING SERVER VERIFICATION</small></span></div>
    </section>
    <section className="rh-profile-command" aria-label="Career snapshot"><Stat label="COMPLETED MISSIONS" value={String(stats.wins).padStart(2,'0')}><span>from {stats.attempts} deployments</span></Stat><Stat label="VERIFIED RAIDS" value="00"><span>secure results only</span></Stat><Stat label="SUCCESS RATE" value={stats.successRate+'%'}><span>local operation record</span></Stat><Stat label="BEST EXTRACTION" value={formatTime(stats.best)}><span>{stats.kills} total eliminations</span></Stat></section>
    <div className="rh-profile-grid">
      <section className="rh-profile-panel rh-achievement-panel"><div className="rh-profile-panel-head"><div><span className="rh-eyebrow">CAREER MILESTONES</span><h2>ACHIEVEMENTS</h2></div><span>{achievements.filter(item=>item.unlocked).length}/{achievements.length} EARNED</span></div><div className="rh-achievement-list">{achievements.map(item=><article key={item.name} data-unlocked={item.unlocked}><span className="rh-achievement-icon">{item.unlocked?<Award size={20}/>:<LockKeyhole size={18}/>}</span><div><strong>{item.name}</strong><p>{item.description}</p></div><small>{item.unlocked?'EARNED':'LOCKED'}</small></article>)}</div></section>
      <section className="rh-profile-panel rh-cosmetics-panel"><div className="rh-profile-panel-head"><div><span className="rh-eyebrow">FIELD LOCKER</span><h2>IDENTITY LOADOUT</h2></div><Link to="/customization" className="rh-text-link">VIEW ALL <ArrowUpRight size={14}/></Link></div><div className="rh-cosmetic-grid">{cosmetics.map(item=><article key={item.name} data-unlocked={item.unlocked}><span>{item.unlocked?<Sparkles size={18}/>:<LockKeyhole size={17}/>}</span><small>{item.type}</small><strong>{item.name}</strong><em>{item.equipped?'EQUIPPED':item.unlocked?'UNLOCKED':'LOCKED'}</em></article>)}</div><p className="rh-profile-note">Cosmetics are identity-only and never affect gameplay. Secure inventory unlocks will appear here when connected.</p></section>
    </div>
    <div className="rh-section-head rh-profile-history-head"><div><span className="rh-eyebrow">MISSION ARCHIVE</span><h2>RECENT DEPLOYMENTS</h2></div><Link to="/missions" className="rh-text-link">FULL HISTORY <ArrowUpRight size={14}/></Link></div><History records={dossier.records.slice(0,5)}/><p className="rh-local-notice">Local practice data is stored on this device. Verified raid rewards, XP and inventory require a secure server record.</p></>;
}
function profileProgress(score: number) {
  let level=1, floor=0, next=1000;
  while (score>=next) { level+=1; floor=next; next+=Math.round(1000*(1+(level-1)*.12)); }
  return { level, current:score-floor, needed:next-floor, remaining:next-score };
}
function profileAchievements(stats: ReturnType<typeof dossierStats>) {
  return [
    { name:'FIRST HEIST', description:'Finish your first recorded operation.', unlocked:stats.attempts>0 },
    { name:'VAULT BREAKER', description:'Complete three successful extractions.', unlocked:stats.wins>=3 },
    { name:'SECURITY SPECIALIST', description:'Log 25 eliminations across your operations.', unlocked:stats.kills>=25 },
    { name:'FIRST RIVAL VICTORY', description:'Win a verified rival challenge.', unlocked:false },
    { name:'VAULT ARCHITECT', description:'Publish a verified community vault.', unlocked:false },
    { name:'EXPEDITION SURVIVOR', description:'Finish a verified expedition.', unlocked:false },
  ];
}
function profileCosmetics(dossier: Dossier, stats: ReturnType<typeof dossierStats>, achievements: ReturnType<typeof profileAchievements>) {
  return [
    { type:'CREST', name:dossier.emblem.toUpperCase()+' INSIGNIA', unlocked:true, equipped:true },
    { type:'CALLING CARD', name:'FIRST EXTRACTION', unlocked:achievements[0].unlocked, equipped:false },
    { type:'FINISH', name:'VAULT BREAKER GOLD', unlocked:achievements[1].unlocked, equipped:false },
    { type:'TITLE', name:'CITY RUNNER', unlocked:stats.wins>=5, equipped:false },
  ];
}
function Ranks({ dossier }: { dossier: Dossier }) {
  const stats=dossierStats(dossier), progress=stats.next ? Math.min(100,(stats.score-stats.rank.points)/(stats.next.points-stats.rank.points)*100) : 100;
  return <><PageHeading code="05" title="EARN YOUR NAME" description="Build your standing through completed heists and clean extractions"/><section className="rh-rank-hero"><div className={'rh-large-emblem '+dossier.emblem}><Shield size={70}/><span>{stats.rankIndex+1}</span></div><div><span className="rh-eyebrow">CURRENT PRACTICE RANK</span><h2>{stats.rank.name}</h2><p>{stats.score.toLocaleString()} POINTS {stats.next && <>/ {stats.next.points.toLocaleString()} TO {stats.next.name}</>}</p><progress aria-label="Progress to next rank" value={progress} max="100"/><small>{stats.next ? (stats.next.points-stats.score).toLocaleString()+' points to your next promotion' : 'Highest local practice tier achieved'}</small></div></section><div className="rh-section-head"><h2>THE RANK LADDER</h2><span>06 / TIERS</span></div><div className="rh-rank-ladder">{RANKS.map((rank,i)=><article className={i===stats.rankIndex?'current':''} key={rank.name}><span className="rh-eyebrow">TIER {String(i+1).padStart(2,'0')}</span><Shield size={35}/><h3>{rank.name}</h3><p>{rank.points.toLocaleString()} PTS</p><small>{i===stats.rankIndex?'CURRENT RANK':i<stats.rankIndex?'ACHIEVED':'NEXT OBJECTIVE'}</small></article>)}</div><p className="rh-local-notice">Rank is calculated from your completed operations on this device</p></>;
}
function Customization({ dossier, onSave, saved }: { dossier: Dossier; onSave: (callsign: string,emblem: Dossier['emblem'])=>void; saved: boolean }) {
  const [callsign,setCallsign]=useState(dossier.callsign),[emblem,setEmblem]=useState(dossier.emblem),[message,setMessage]=useState('');
  return <><PageHeading code="02" title="MAKE IT YOURS" description="Your callsign — Your colors — A dossier that feels like you"/><div className="rh-custom-layout"><section className="rh-operative-preview" style={{backgroundImage:`url(${ART})`}}><div className="rh-operative-label"><span className="rh-eyebrow">FIELD OPERATIVE</span><h2>{callsign || 'VEX'}</h2><span className={'rh-calling-card '+emblem}><Shield size={22}/> {dossierStats(dossier).rank.name}</span></div><small>OPERATIVE DOSSIER</small></section><form className="rh-panel rh-custom-form" onSubmit={e=>{e.preventDefault();if(!/^[a-zA-Z0-9 _-]{2,20}$/.test(callsign.trim())){setMessage('Use 2–20 letters, numbers, spaces, hyphens or underscores');return;}onSave(callsign.trim().toUpperCase(),emblem);setMessage('Dossier updated');}}><div className="rh-section-head"><h2>OPERATIVE IDENTITY</h2><span>PERSONALIZE</span></div><label className="rh-input-label">CALLSIGN<input aria-label="Callsign" value={callsign} maxLength={20} onChange={e=>setCallsign(e.target.value)}/><small>2–20 characters — This name is used on your local profile</small></label><fieldset className="rh-emblem-picker"><legend>CALLING CARD FINISH</legend>{(['gold','ice','ember'] as const).map(color=><button type="button" key={color} className={color} aria-label={color+' calling card'} aria-pressed={emblem===color} onClick={()=>setEmblem(color)}><Shield size={28}/><span>{color.toUpperCase()}</span>{emblem===color && <Check size={14}/>}</button>)}</fieldset><p className="rh-muted">Calling cards style your menu, profile and rank insignia — They do not replace the player model, change weapons or grant gameplay advantages</p><button className="rh-primary" type="submit">SAVE IDENTITY <Check size={17}/></button><p role="status" className="rh-save-note">{message}{!saved && ' Storage unavailable: changes last for this session only'}</p></form></div></>;
}
