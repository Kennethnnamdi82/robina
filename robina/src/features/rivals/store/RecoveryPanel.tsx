import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, ArrowRight, CheckCircle2, Clock3, Cross, HeartPulse, ShieldAlert, TriangleAlert } from 'lucide-react';
import { findProduct } from './catalog';
import PurchaseDialog from './PurchaseDialog';

export const RECOVERY_STATES = ['alive', 'low-health', 'medical-available', 'defeated', 'countdown', 'pending', 'successful', 'free-available', 'unconfirmed'] as const;
type RecoveryState = typeof RECOVERY_STATES[number];
const labels = ['Alive · 100 HP', 'Low health', 'Medical recovery available', 'Player defeated', 'Recovery countdown active', 'Instant recovery pending', 'Recovery successful', 'Free recovery available', 'Recovery unconfirmed'];
export default function RecoveryPanel() {
  const [state, setState] = useState<RecoveryState>('countdown'), [purchase, setPurchase] = useState(false);
  const healthy = state === 'alive' || state === 'successful', low = state === 'low-health' || state === 'medical-available';
  const hp = healthy ? 100 : low ? 24 : 0, free = state === 'free-available';
  const heading = healthy ? 'READY TO RETURN.' : low ? 'STAY IN THE FIGHT.' : free ? 'YOUR NEXT CHANCE.' : 'YOUR SOLDIER HAS FALLEN.';
  return <section className="rs-recovery" data-state={state}>
    <div className="rs-preview-banner"><ShieldAlert size={17}/><p><strong>RECOVERY DESIGN PREVIEW</strong> Sample status only. No countdown is running, no health changes and gameplay is not locked.</p></div>
    <label className="rs-state-select">RECOVERY STATE<select aria-label="Recovery preview state" value={state} onChange={e => setState(e.target.value as RecoveryState)}>{RECOVERY_STATES.map((s, i) => <option key={s} value={s}>{labels[i]}</option>)}</select></label>
    <div className="rs-recovery-layout"><div className="rs-recovery-scene"><div className="rs-recovery-reticle" aria-hidden="true"><HeartPulse size={76} strokeWidth={.8}/></div><span className="rs-kicker">{healthy ? 'OPERATIVE STATUS / HEALTHY' : low ? 'FIELD STATUS / WOUNDED' : 'MISSION FAILED'}</span><h2>{heading}</h2><p>{low ? 'Existing medical pickups can restore health during a mission. This screen does not use an item.' : healthy ? 'Full-health presentation. Eligibility must come from an authoritative recovery service when connected.' : 'The city gets another night. You get another chance.'}</p><div className="rs-health"><span>CURRENT HEALTH</span><strong>{hp}<small>/100 HP</small></strong><progress aria-label="Sample player health" value={hp} max={100}/></div></div>
      <aside className="rs-recovery-options"><span className="rs-kicker">RECOVERY PROTOCOL / UI STUDY</span>
        <div className="rs-recovery-clock"><Clock3 size={22}/><span>{healthy || free ? '00:00:00' : '01:59:59'}</span><small>{free ? 'SAMPLE: FREE RECOVERY AVAILABLE' : 'STATIC SAMPLE · TWO-HOUR INTENDED POLICY'}</small></div>
        {state === 'pending' && <p className="rs-recovery-message" role="status"><Activity size={18}/> Sample pending payment. Health is not restored.</p>}
        {state === 'successful' && <p className="rs-recovery-message" role="status"><CheckCircle2 size={18}/> Sample verified recovery. No real HP change.</p>}
        {state === 'unconfirmed' && <p className="rs-recovery-message" role="status"><TriangleAlert size={18}/> Recovery unconfirmed. Do not assume payment succeeded.</p>}
        {low ? <div className="rs-recovery-message"><Cross size={18}/> FIND FIELD MEDICAL SUPPLIES <small>Use the existing Collect control during gameplay.</small></div> : <><span className="rs-option-label">OPTION A / FREE RECOVERY</span><p>{free ? 'Free recovery is available in this sample state.' : 'FREE RECOVERY IN ' + (healthy ? '00:00:00' : '01:59:59')}<small>A server must confirm when the wait has ended.</small></p><span className="rs-option-label">OPTION B / INSTANT RECOVERY</span><p>Restore 100 HP <b>$2.00</b><small>Proposed paid recovery. Not available for purchase.</small></p><button className="rs-primary" onClick={() => setPurchase(true)}>REVIVE NOW — $2 <ArrowRight size={18}/></button><small className="rs-fineprint">Opens a clearly labeled purchase preview. Does not revive you.</small></>}
        <Link className="rs-secondary" to="/">RETURN TO MAIN MENU</Link>
      </aside></div>
    <section className="rs-lock-study"><span className="rs-kicker">MISSION ENTRY / RECOVERY-LOCK PRESENTATION</span><div><strong>{healthy || free ? 'ELIGIBILITY AWAITS CONFIRMATION' : 'OPERATIVE RECOVERING'}</strong><button disabled>DEPLOY LOCKED <Clock3 size={15}/></button></div><p>This sample button illustrates a future recovery lock. Lobby and mission entry are unchanged; no frontend access restriction is imposed.</p></section>
    {purchase && <PurchaseDialog product={findProduct('revive')!} onClose={() => setPurchase(false)}/>}
  </section>;
}
