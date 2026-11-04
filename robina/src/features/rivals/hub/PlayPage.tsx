import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useMemo, type ReactNode } from 'react';
import { ArrowLeft, ArrowUpRight, Clock3, Crosshair, Shield, Target } from 'lucide-react';
import RaidApp from '../three/RaidApp';
import { createOperation } from '../three/Operations';
import { OPERATIONS, type HubPreferences } from './model';
import type { MissionSnapshot } from '../missions/types';

export default function PlayPage({ preferences, onResult, renderSettings }: { preferences: HubPreferences; onResult: (mission: MissionSnapshot,venue: number)=>void; renderSettings: (back:()=>void)=>ReactNode }) {
  const navigate=useNavigate(),[search]=useSearchParams();
  const selected=OPERATIONS.find(op=>op.id===search.get('operation')) || OPERATIONS[0];
  const operation=useMemo(()=>{
    const seed=crypto.getRandomValues(new Uint32Array(1))[0] % 4294967200;
    return createOperation(seed-seed%3+selected.venue);
  },[selected.venue]);
  return <RaidApp operation={operation} preferences={preferences} onResult={onResult} onExit={()=>navigate('/')} renderSettings={renderSettings} renderWelcome={({enter,preparing,error})=><main className="rh-app rh-briefing-app"><div className="rh-briefing-art" aria-hidden="true"/><section className="rh-briefing"><Link className="rh-back" to="/"><ArrowLeft size={16}/> BACK TO LOBBY</Link><span className="rh-eyebrow">OPERATION BRIEF / {selected.code} · SOLO INSERTION</span><h1>{selected.name}<span>.</span></h1><p className="rh-briefing-location">{selected.location}</p><p>{selected.description}</p><div className="rh-briefing-objectives"><h2>THE JOB</h2><span><Crosshair size={17}/> INFILTRATE THE DISTRICT</span><span><Shield size={17}/> BREACH SECURITY & DEFEAT THE GUARDIAN</span><span><Target size={17}/> RECOVER THE {selected.target.toUpperCase()}</span><span><ArrowUpRight size={17}/> REACH EXTRACTION</span></div><div className="rh-briefing-meta"><span><Clock3 size={14}/> NO MISSION DEADLINE</span><span>4 CAMERA PERSPECTIVES</span></div><button className="rh-primary" disabled={preparing} aria-busy={preparing} onClick={enter}>{preparing?'PREPARING CITY…':'DEPLOY / START HEIST'}<ArrowUpRight size={19}/></button>{preparing && <p role="status">Downloading your existing 3D city. The first visit may take longer.</p>}{error && <p role="alert">{error}</p>}<Link className="rh-text-link" to="/settings">CONFIGURE YOUR FIELD KIT <ArrowUpRight size={14}/></Link><small className="rh-local-notice">Practice run · outcomes are saved in this browser only · no online scoring or account rewards.</small></section></main>}/>;
}
