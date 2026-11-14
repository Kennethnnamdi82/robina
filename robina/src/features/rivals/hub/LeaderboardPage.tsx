import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, Clock3, Crosshair, Search, Shield, Trophy } from 'lucide-react';
import { dossierStats, formatTime, OPERATIONS, runScore, type Dossier } from './model';
import { missionsApi } from '@/services/missions';
import './leaderboard.css';

type Metric = 'score' | 'best' | 'wins';
export default function LeaderboardPage({ dossier }: { dossier: Dossier }) {
  const [scope, setScope] = useState<'personal' | 'verified'>('personal');
  const [metric, setMetric] = useState<Metric>('score'), [query, setQuery] = useState('');
  const [verified, setVerified] = useState<Array<{ callsign: string; wins: number; score: number; best: number; emblem: Dossier['emblem']; subtitle: string; key: string }>>([]);
  const [verifiedLoading, setVerifiedLoading] = useState(false), [verifiedError, setVerifiedError] = useState('');
  useEffect(() => {
    if (scope !== 'verified') return;
    let active = true;
    setVerifiedLoading(true); setVerifiedError('');
    void missionsApi.leaderboard().then(data => {
      if (!active) return;
      setVerified(data.items.map((row, index) => ({ callsign: row.player, wins: 1, score: row.score,
        best: row.durationSeconds, emblem: 'ice' as const,
        subtitle: `${OPERATIONS.find(operation => `assignment-${operation.id}` === row.missionId)?.name ?? row.missionId} / VERIFIED`,
        key: `${row.missionId}:${row.player}:${row.verifiedAt}:${index}` })));
    }).catch(() => { if (active) setVerifiedError('Verified standings are unavailable. Check your connection and try again.'); })
      .finally(() => { if (active) setVerifiedLoading(false); });
    return () => { active = false; };
  }, [scope]);
  const stats = dossierStats(dossier);
  const personal = useMemo(() => OPERATIONS.map(operation => {
    const runs = dossier.records.filter(record => record.state === 'SUCCESS' && record.venue === operation.venue);
    return { key: operation.id, callsign: operation.name, wins: runs.length, score: runs.reduce((total, run) => total + runScore(run), 0), best: runs.length ? Math.min(...runs.map(run => run.seconds)) : Infinity, emblem: dossier.emblem, subtitle: operation.type };
  }).filter(row => row.wins > 0), [dossier]);
  const ranked = [...(scope === 'personal' ? personal : verified)].sort((a, b) => metric === 'best' ? a.best - b.best : b[metric] - a[metric] || a.best - b.best);
  const rows = ranked.map((row, index) => ({ ...row, position: index + 1 })).filter(row => `${row.callsign} ${row.subtitle}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <div className="rl-page">
    <header className="rl-heading"><Link className="rh-back" to="/"><ArrowLeft size={15}/>BACK TO LOBBY</Link><span className="rh-eyebrow">RIVALS / THE PERFORMANCE RECORD</span><h1 tabIndex={-1}>LEADERBOARDS</h1><p>Clean jobs. Fast exits. A record worth chasing.</p></header>
    <section className="rl-career" aria-label="Your career standing"><div className="rl-identity"><span className="rl-crest"><Shield size={29}/></span><div><small>YOUR OPERATIVE</small><strong>{dossier.callsign}</strong><span>{stats.rank.name}</span></div></div><div><small>CAREER SCORE</small><strong>{stats.score.toLocaleString()}</strong></div><div><small>EXTRACTIONS</small><strong>{String(stats.wins).padStart(2, '0')}</strong></div><div><small>PERSONAL BEST</small><strong>{formatTime(stats.best)}</strong></div><Link to="/profile" aria-label="View your operative profile"><ArrowUpRight size={21}/></Link></section>
    <div className="rl-toolbar"><div className="rl-scopes" role="group" aria-label="Leaderboard view"><button aria-pressed={scope === 'personal'} onClick={() => { setScope('personal'); setQuery(''); }}>MY RECORDED RUNS</button><button aria-pressed={scope === 'verified'} onClick={() => { setScope('verified'); setQuery(''); }}>VERIFIED STANDINGS</button></div><label className="rl-search"><Search size={16}/><input aria-label="Search leaderboard" placeholder={scope === 'personal' ? 'Find a contract' : 'Find an operative'} maxLength={40} value={query} onChange={event => setQuery(event.target.value)}/></label></div>
    <div className="rl-board-heading"><div><span className="rh-eyebrow">{scope === 'personal' ? 'YOUR RECORD / THIS DEVICE' : 'SERVER-VERIFIED RUNS'}</span><h2>{scope === 'personal' ? 'CONTRACT STANDINGS' : 'VERIFIED STANDINGS'}</h2></div><label>SORT BY<select aria-label="Rank by" value={metric} onChange={event => setMetric(event.target.value as Metric)}><option value="score">Performance score</option><option value="best">Fastest extraction</option><option value="wins">Completed heists</option></select></label></div>
    {scope === 'verified' && <p className="rl-disclaimer" role="status">{verifiedLoading ? 'Loading verified runs…' : verifiedError || 'Only server-verified successful missions appear here. Local practice runs never affect these standings.'}</p>}
    {!rows.length ? <section className="rl-empty"><Crosshair size={34}/><span className="rh-eyebrow">{query ? 'NO MATCHES' : scope === 'verified' ? 'NO VERIFIED RUNS' : 'YOUR PLACE IS STILL OPEN'}</span><h2>{query ? 'TRY ANOTHER SEARCH' : scope === 'verified' ? 'THE BOARD IS OPEN.' : 'SET THE FIRST BENCHMARK.'}</h2><p>{query ? 'Try a different contract or operative name.' : scope === 'verified' ? verifiedLoading ? 'Checking server records.' : verifiedError || 'No server-verified mission results have been recorded yet.' : 'Complete a heist to rank your contracts by performance, extraction count and fastest escape. Your actual results belong here.'}</p>{!query && scope === 'personal' && <Link className="rh-secondary" to="/missions">CHOOSE YOUR CONTRACT <ArrowUpRight size={16}/></Link>}</section> : <>
      <div className="rl-column-head" aria-hidden="true"><span>POSITION / {scope === 'personal' ? 'CONTRACT' : 'OPERATIVE'}</span><span>SCORE</span><span>HEISTS</span><span>BEST EXIT</span></div>
      <ol className="rl-ranking" aria-label={scope === 'personal' ? 'Personal contract rankings' : 'Verified mission rankings'}>{rows.map(row => <li key={row.key} data-podium={row.position <= 3}><span className="rl-position">{String(row.position).padStart(2, '0')}</span><span className="rl-row-crest">{row.position === 1 ? <Trophy size={19}/> : <Shield size={18}/>}</span><div className="rl-name"><strong>{row.callsign}</strong><small>{row.subtitle}</small></div><div className="rl-value" data-primary={metric === 'score'}><small>SCORE</small><b>{row.score.toLocaleString()}</b></div><div className="rl-value" data-primary={metric === 'wins'}><small>HEISTS</small><b>{row.wins}</b></div><div className="rl-value" data-primary={metric === 'best'}><small>BEST EXIT</small><b><Clock3 size={12}/>{formatTime(row.best)}</b></div></li>)}</ol>
    </>}
    <footer className="rl-board-footer"><span><i/>{scope === 'personal' ? 'LOCAL PRACTICE RECORD' : 'SERVER-VERIFIED RECORD'}</span><p>{scope === 'personal' ? 'These device-local runs are not verified and do not earn server rewards or global rank.' : 'Only independently verified completions qualify. Browser-reported runs cannot enter this board.'}</p></footer>
  </div>;
}
