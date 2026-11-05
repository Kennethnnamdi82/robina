import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import '../../src/features/rivals/hub/hub.css';
import '../../src/features/rivals/hub/command-theme.css';
import '../../src/features/rivals/hub/readability.css';
import StorePage from '../../src/features/rivals/store/StorePage';
import RecoveryPage from '../../src/features/rivals/store/RecoveryPage';
// Explicit local fixture, not imported by production. No sign-in or account APIs.
if (import.meta.env.DEV && import.meta.env.VITE_RIVALS_3D_SANDBOX === 'true') {
  const route = new URLSearchParams(location.search).get('page') || '/store';
  createRoot(document.getElementById('root')!).render(<MemoryRouter initialEntries={[route]}><div className="rh-app"><main className="rh-main"><Routes><Route path="/recovery" element={<RecoveryPage review/>}/><Route path="*" element={<StorePage review/>}/></Routes></main></div></MemoryRouter>);
}
