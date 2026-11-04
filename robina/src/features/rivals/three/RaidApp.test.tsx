import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SandboxSession } from './SandboxSession';
import { preloadRaidAssets } from './RaidAssets';

const runtime = vi.hoisted(() => ({ created: 0, disposed: 0 }));
vi.mock('./RaidAssets', () => ({ preloadRaidAssets: vi.fn() }));
vi.mock('./RaidRuntime', () => ({ RaidRuntime: class {
  constructor(_host: HTMLElement, private session: SandboxSession) {
    runtime.created++; session.update({ status: 'playing' });
  }
  dispose() { runtime.disposed++; this.session.dispose(); }
} }));
import RaidApp from './RaidApp';

afterEach(async () => { cleanup(); await act(async () => {}); vi.restoreAllMocks(); runtime.created = runtime.disposed = 0; });
describe('production 3D entry lifecycle', () => {
  it('starts without a development flag and keeps normal route links', () => {
    render(<RaidApp />);
    expect(screen.getByRole('button', { name: 'ENTER 3D RAID' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'RETURN TO BASE' }).getAttribute('href')).toBe('/');
    expect(screen.getByRole('link', { name: 'PLAY CLASSIC 2D' }).getAttribute('href')).toBe('/gaming?engine=2d');
    expect(screen.queryByText(/sandbox disabled/i)).toBeNull();
  });
  it('survives StrictMode and releases the runtime only on actual unmount', async () => {
    vi.spyOn(SandboxSession.prototype, 'startAudio').mockImplementation(() => {});
    const view = render(<StrictMode><RaidApp /></StrictMode>);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'ENTER 3D RAID' })); });
    expect(runtime.created).toBe(1); expect(runtime.disposed).toBe(0);
    expect(screen.getByLabelText('RIVALS 3D raid')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Graphics settings' })).toBeNull();
    await act(async () => { view.unmount(); });
    expect(runtime.disposed).toBe(1);
  });
  it('finishes production downloads before starting the unchanged runtime deadline', async () => {
    vi.spyOn(SandboxSession.prototype, 'startAudio').mockImplementation(() => {});
    let release!: () => void;
    vi.mocked(preloadRaidAssets).mockReturnValueOnce(new Promise<void>(resolve => { release = resolve; }));
    render(<RaidApp />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'ENTER 3D RAID' })); });
    expect(runtime.created).toBe(0);
    expect(screen.getByRole('button', { name: 'DOWNLOADING CITY…' }).hasAttribute('disabled')).toBe(true);
    await act(async () => { release(); });
    expect(runtime.created).toBe(1);
    expect(screen.getByLabelText('RIVALS 3D raid')).toBeTruthy();
  });
});
