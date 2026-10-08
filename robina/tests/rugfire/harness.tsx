import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import GamingPage from '../../src/pages/GamingPage';
import { RugfireEngine } from '../../src/features/rugfire/engine';
import * as THREE from 'three';
import * as physics from '../../src/features/rugfire/physics';
// Development harness is outside the production entry and exposes no production bypass.
if (location.search.includes('engine')) {
  const host = document.getElementById('root')!; host.style.cssText = 'width:100vw;height:100vh';
  const engine = new RugfireEngine(host, hud => { Object.assign(window, { hud }); }, error => { Object.assign(window, { engineError: error }); });
  Object.assign(window, { engine, THREE, physics });
} else createRoot(document.getElementById('root')!).render(<MemoryRouter initialEntries={['/gaming']}><Routes><Route path="/gaming" element={<GamingPage />} /><Route path="/" element={<div>OPERATOR BASE</div>} /></Routes></MemoryRouter>);
