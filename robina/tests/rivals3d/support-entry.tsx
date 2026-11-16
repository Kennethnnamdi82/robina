import {createRoot} from 'react-dom/client';
import {MemoryRouter,Routes,Route,Navigate} from 'react-router-dom';
import '../../src/features/rivals/hub/hub.css';
import '../../src/features/rivals/hub/command-theme.css';
import '../../src/features/rivals/hub/readability.css';
import SupportPage from '../../src/features/rivals/store/SupportPage';
import StorePage from '../../src/features/rivals/store/StorePage';
import {StoreIdentity} from '../../src/features/rivals/store/StoreIdentity';
// Loopback-only development fixture. The browser QA script intercepts every
// API and checkout request; no credentials, provider calls or real payments.
if(import.meta.env.DEV&&import.meta.env.VITE_RIVALS_3D_SANDBOX==='true'&&['127.0.0.1','localhost'].includes(location.hostname)){
  createRoot(document.getElementById('root')!).render(<StoreIdentity.Provider value="isolated-support-ui"><MemoryRouter initialEntries={['/support']}><div className="rh-app"><main className="rh-main"><Routes><Route path="support" element={<SupportPage/>}/><Route path="store/*" element={<StorePage/>}/><Route path="purchase-history" element={<StorePage/>}/><Route path="*" element={<Navigate to="/support" replace/>}/></Routes></main></div></MemoryRouter></StoreIdentity.Provider>);
}
