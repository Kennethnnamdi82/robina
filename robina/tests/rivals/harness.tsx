import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import GamingPage from '../../src/pages/GamingPage';
import BottomNav from '../../src/components/BottomNav';
import '../../src/index.css';

// Tests the actual page in StrictMode with the website chrome, without login/API dependencies.
// This file is outside index.html's production import graph and grants no production access.
createRoot(document.getElementById('root')!).render(<StrictMode><MemoryRouter initialEntries={['/gaming']}>
  <Routes><Route path="/gaming" element={<GamingPage validation={new URLSearchParams(location.search).get('validation') === '1'} />} /><Route path="*" element={<main>Website home</main>} /></Routes>
  <BottomNav />
</MemoryRouter></StrictMode>);
