import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import RecoveryPanel from './RecoveryPanel';
import './store.css';
export default function RecoveryPage() {
  return <div className="rs-store"><header className="rs-masthead"><div><Link to="/store/health" className="rs-back"><ArrowLeft size={14}/> BACK TO HEALTH & RECOVERY</Link><span className="rs-kicker">OPERATIVE CARE / DESIGN PREVIEW</span><h1 tabIndex={-1}>RECOVERY PROTOCOL<span>.</span></h1></div></header><RecoveryPanel/></div>;
}
