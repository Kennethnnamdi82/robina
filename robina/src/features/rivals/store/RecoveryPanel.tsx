import {Link} from 'react-router-dom';
import {HeartPulse} from 'lucide-react';
import RecoveryPreview from './RecoveryPreview';
export {RECOVERY_STATES} from './RecoveryPreview';

export default function RecoveryPanel({review=false}:{review?:boolean}){
  if(review)return <RecoveryPreview review/>;
  return <section className="rs-recovery-options">
    <span className="rs-kicker">OPERATIVE CARE</span><HeartPulse size={40}/>
    <h2>NO WAIT AFTER DEFEAT</h2>
    <p>You can retry immediately after a failed mission. Your next deployment starts at 100 HP, with no recovery countdown or payment required.</p>
    <p>During a mission, collect field first-aid to restore 25 HP while you are alive.</p>
    <Link className="rs-primary" to="/">RETURN TO LOBBY</Link>
  </section>;
}
