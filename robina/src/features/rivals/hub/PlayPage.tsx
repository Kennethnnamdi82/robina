import { useNavigate,useSearchParams,Link } from 'react-router-dom';
import { useMemo,type ReactNode } from 'react';
import { ArrowLeft,ArrowUpRight,Clock3,Check } from 'lucide-react';
import RaidApp from '../three/RaidApp';
import { createAssignmentOperation } from '../three/Operations';
import { OPERATIONS,isAssignmentUnlocked,type HubPreferences,type Dossier } from './model';
import type { MissionSnapshot } from '../missions/types';
import {MissionDifficulty,OperationArt} from './OperationArt';
import { gameMoney, missionReward, type PlayerEconomy } from '../progression/PlayerEconomy';
export default function PlayPage({preferences,onResult,renderSettings,dossier,economy}:{preferences:HubPreferences;onResult:(mission:MissionSnapshot,venue:number)=>void;renderSettings:(back:()=>void)=>ReactNode;dossier:Dossier;economy:PlayerEconomy}){
  const navigate=useNavigate(),[search]=useSearchParams();
  const selected=OPERATIONS.find(op=>op.id===search.get('operation'))||OPERATIONS[0];
  const operation=useMemo(()=>createAssignmentOperation(selected.venue),[selected.venue]);
  if(!isAssignmentUnlocked(dossier,selected.venue))return <main className="rh-app rh-main"><h1>ASSIGNMENT CLASSIFIED</h1><p>Complete {OPERATIONS[selected.venue-1].name} to authorize this insertion</p><Link className="rh-primary" to="/missions">REVIEW OPERATIONS</Link></main>;
  return <RaidApp operation={operation} preferences={preferences} economy={economy} onResult={onResult} onExit={()=>navigate('/')} renderSettings={renderSettings} renderWelcome={({enter,preparing,error})=><main className="rh-app rh-briefing-app">
    <div className="rh-briefing-art" aria-hidden="true"/>
    <section className="rh-briefing"><Link className="rh-back" to="/"><ArrowLeft size={16}/> BACK TO LOBBY</Link><span className="rh-eyebrow">MISSION BRIEF / {selected.type}</span><h1>{selected.name}</h1><p className="rh-briefing-location">{selected.location}</p><MissionDifficulty stage={selected.venue}/><p>{selected.description}</p><div className="rh-briefing-objectives"><h2>MISSION OBJECTIVES</h2>{operation.mission.objectives.map(o=><span key={o.id}><Check size={16}/>{o.title}</span>)}</div><div className="rh-briefing-meta"><span><Clock3 size={14}/> NO DEADLINE</span><span>4 CAMERA PERSPECTIVES</span></div><button className="rh-primary" disabled={preparing} onClick={enter}>DEPLOY / START HEIST<ArrowUpRight size={19}/></button>{error&&<p role="alert">{error}</p>}<Link className="rh-text-link" to="/settings">OPERATION SETTINGS <ArrowUpRight size={14}/></Link><small className="rh-local-notice">Progress saved on this device</small></section>
    <aside className="rh-briefing-recon"><span className="rh-eyebrow">RECONNAISSANCE / CONTRACT 0{selected.venue+1}</span><OperationArt assignment={selected}/><div><span>SITE SECURITY<b>{selected.security} UNITS</b></span><span>RESPONSE LEVEL<b>{selected.response} / 4</b></span></div><p>Plan your entry. Observe the patrols.<br/>Leave yourself a way out.</p><div className="rh-payout-preview"><span>YOUR CONTRACT SHARE<b>{gameMoney(missionReward(selected.venue).cash)}</b></span><span>ACHIEVEMENT AWARD<b>+{missionReward(selected.venue).coins.toLocaleString()} COINS</b></span></div><small>Fictional cash for city venues. Coins for revives. Paid once per completed run.</small></aside>
  </main>}/>;
}
