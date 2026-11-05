import { useNavigate,useSearchParams,Link } from 'react-router-dom';
import { useMemo,type ReactNode } from 'react';
import { ArrowLeft,ArrowUpRight,Clock3,Check } from 'lucide-react';
import RaidApp from '../three/RaidApp';
import { createAssignmentOperation } from '../three/Operations';
import { OPERATIONS,isAssignmentUnlocked,type HubPreferences,type Dossier } from './model';
import type { MissionSnapshot } from '../missions/types';
export default function PlayPage({preferences,onResult,renderSettings,dossier}:{preferences:HubPreferences;onResult:(mission:MissionSnapshot,venue:number)=>void;renderSettings:(back:()=>void)=>ReactNode;dossier:Dossier}){
  const navigate=useNavigate(),[search]=useSearchParams();
  const selected=OPERATIONS.find(op=>op.id===search.get('operation'))||OPERATIONS[0];
  const operation=useMemo(()=>createAssignmentOperation(selected.venue),[selected.venue]);
  if(!isAssignmentUnlocked(dossier,selected.venue))return <main className="rh-app rh-main"><h1>ASSIGNMENT CLASSIFIED.</h1><p>Complete {OPERATIONS[selected.venue-1].name} to authorize this insertion.</p><Link className="rh-primary" to="/missions">REVIEW OPERATIONS</Link></main>;
  return <RaidApp operation={operation} preferences={preferences} onResult={onResult} onExit={()=>navigate('/')} renderSettings={renderSettings} renderWelcome={({enter,preparing,error})=><main className="rh-app rh-briefing-app"><div className="rh-briefing-art" aria-hidden="true"/><section className="rh-briefing"><Link className="rh-back" to="/"><ArrowLeft size={16}/> BACK TO LOBBY</Link><span className="rh-eyebrow">MISSION BRIEF / {selected.type}</span><h1>{selected.name}<span>.</span></h1><p className="rh-briefing-location">{selected.location}</p><p>{selected.description}</p><div className="rh-briefing-objectives"><h2>MISSION OBJECTIVES</h2>{operation.mission.objectives.map(o=><span key={o.id}><Check size={16}/>{o.title}</span>)}</div><div className="rh-briefing-meta"><span><Clock3 size={14}/> NO DEADLINE</span><span>4 CAMERA PERSPECTIVES</span></div><button className="rh-primary" disabled={preparing} onClick={enter}>DEPLOY / START HEIST<ArrowUpRight size={19}/></button>{error&&<p role="alert">{error}</p>}<Link className="rh-text-link" to="/settings">OPERATION SETTINGS <ArrowUpRight size={14}/></Link><small className="rh-local-notice">Progress is stored in this browser. No shared online ranking or account rewards.</small></section></main>}/>;
}
