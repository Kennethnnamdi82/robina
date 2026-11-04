import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/rivals/three/RaidApp', () => ({ default: () => <h1>City raid</h1> }));
vi.mock('./GamingPage', () => ({ default: () => <h1>Classic raid</h1> }));
import GamingRoute, { gameEngine } from './GamingRoute';

afterEach(() => { cleanup(); vi.unstubAllEnvs(); });
describe('production game selection', () => {
  it('defaults to 3D and allows only the explicit classic fallback', () => {
    expect(gameEngine('', '')).toBe('3d');
    expect(gameEngine('engine=2d', '')).toBe('2d');
    expect(gameEngine('validation=1&engine=unknown', '')).toBe('3d');
  });
  it('honors the deployment rollback switch even with a 3D URL', () => {
    expect(gameEngine('engine=3d', '2d')).toBe('2d');
  });
  it('loads 3D through the production route', async () => {
    render(<MemoryRouter initialEntries={['/gaming']}><GamingRoute /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'City raid' })).toBeTruthy();
  });
  it('keeps classic playable at the same authenticated route', async () => {
    render(<MemoryRouter initialEntries={['/gaming?engine=2d']}><GamingRoute /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Classic raid' })).toBeTruthy();
  });
});
