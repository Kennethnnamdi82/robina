import {useState} from 'react';
import {Link} from 'react-router-dom';
import {Cross,HeartPulse,ShieldAlert} from 'lucide-react';

export const RECOVERY_STATES=['alive','low-health','medical-available','defeated'] as const;
type RecoveryState=typeof RECOVERY_STATES[number];
const labels=['Alive · 100 HP','Low health','Medical supplies available','Player defeated'];
export default function RecoveryPreview({review=false}:{review?:boolean}){
  const [state,setState]=useState<RecoveryState>('defeated');
  const healthy=state==='alive',low=state==='low-health'||state==='medical-available';
  const hp=healthy?100:low?20:0;
  return <section className="rs-recovery" data-state={state}>
    {review&&<><div className="rs-preview-banner"><ShieldAlert size={17}/><p><strong>OPERATIVE CARE PREVIEW</strong> Sample health only. No health changes and gameplay is not locked.</p></div>
    <label className="rs-state-select">OPERATIVE STATE<select aria-label="Recovery preview state" value={state} onChange={e=>setState(e.target.value as RecoveryState)}>{RECOVERY_STATES.map((s,i)=><option key={s} value={s}>{labels[i]}</option>)}</select></label></>}
    <div className="rs-recovery-layout"><div className="rs-recovery-scene">
      <div className="rs-recovery-reticle" aria-hidden="true"><HeartPulse size={76} strokeWidth={.8}/></div>
      <span className="rs-kicker">{healthy?'OPERATIVE STATUS / HEALTHY':low?'FIELD STATUS / WOUNDED':'MISSION FAILED'}</span>
      <h2>{healthy?'READY FOR THE NEXT HEIST':low?'STAY IN THE FIGHT':'READY TO TRY AGAIN'}</h2>
      <div className="rs-health"><span>SAMPLE HEALTH</span><strong>{hp}<small>/100 HP</small></strong><progress aria-label="Sample player health" value={hp} max={100}/></div>
    </div><aside className="rs-recovery-options"><span className="rs-kicker">NO WAIT AFTER DEFEAT</span>
      {low&&<div className="rs-recovery-message"><Cross size={18}/> FIND FIELD MEDICAL SUPPLIES <small>Use the existing Collect control during gameplay</small></div>}
      <p>You can retry immediately after a failed mission. Your next deployment starts at 100 HP. No recovery countdown or purchase is required.</p>
      <Link className="rs-primary" to="/">RETURN TO MAIN MENU</Link>
    </aside></div>
  </section>;
}
