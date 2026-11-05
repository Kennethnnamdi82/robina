import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import RecoveryPanel from './RecoveryPanel';
import './store.css';
export default function RecoveryPage({review=false}:{review?:boolean}) {
  return <div className="rs-store"><header className="rs-masthead"><div><Link to="/store/health" className="rs-back"><ArrowLeft size={14}/> BACK TO HEALTH & RECOVERY</Link><span className="rs-kicker">OPERATIVE CARE</span><h1 tabIndex={-1}>RECOVERY PROTOCOL</h1></div></header><RecoveryPanel review={review}/></div>;
}
