import type {Diagnostics3D} from './RaidRuntime';
import type {Operation3D} from './Operations';
import {ASSIGNMENTS} from '../missions/assignments';
import './campaign.css';

export function CampaignStatus({operation,metrics}:{operation:Operation3D;metrics?:Diagnostics3D}){
  if(operation.assignment===undefined)return null;
  const pursuit=metrics?.pursuit,campaign=metrics?.campaign;
  return <aside className="r3-campaign-status" aria-label="Operation and police pursuit">
    <div className="r3-wanted" aria-label={'Police response level '+(pursuit?.level??0)} data-active={pursuit?.active}><span>{Array.from({length:5},(_,i)=><i key={i} data-lit={i<(pursuit?.level??0)}>★</i>)}</span><small>{pursuit?.active?pursuit.evading>0?'SEARCHING / STAY OUT OF SIGHT':'POLICE IN PURSUIT':pursuit?.lost?'PURSUIT LOST':'NO POLICE ALERT'}</small></div>
    <p>{String(operation.assignment+1).padStart(2,'0')} / {String(ASSIGNMENTS.length).padStart(2,'0')} · {operation.mission.name}</p>
    {campaign?.holdActive&&<div className="r3-hold"><strong>{campaign.message}</strong><div role="progressbar" aria-label="Site operation progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(campaign.holdProgress*100)}><i style={{width:campaign.holdProgress*100+'%'}}/></div><small>Stay near the device. Movement outside the site pauses progress.</small></div>}
    {pursuit?.active&&pursuit.evading>0&&<div className="r3-escape-meter" role="progressbar" aria-label="Evading police" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100,Math.round(pursuit.evading/pursuit.escapeSeconds*100))}><i style={{width:Math.min(100,pursuit.evading/pursuit.escapeSeconds*100)+'%'}}/></div>}
    {campaign?.carrying&&!campaign.holdActive&&<small>{pursuit?.active?'BREAK LINE OF SIGHT BEFORE EXTRACTION':'OBJECTIVE SECURED / REACH YOUR GETAWAY'}</small>}
  </aside>;
}
export function NextMissionBrief({operation}:{operation:Operation3D}){
  if(operation.assignment===undefined)return null;
  const next=ASSIGNMENTS[(operation.assignment+1)%ASSIGNMENTS.length];
  return <div className="r3-next-stage"><small>NEXT CONTRACT UNLOCKED</small><strong>{next.name}</strong><span>{next.type} · {next.location}</span></div>;
}
