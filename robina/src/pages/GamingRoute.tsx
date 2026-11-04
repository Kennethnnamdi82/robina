import { Component, lazy, Suspense, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

const CityGame = lazy(() => import('@/features/rivals/three/RaidApp'));
const ClassicGame = lazy(() => import('./GamingPage'));

export function gameEngine(search: string, configured = import.meta.env.VITE_RIVALS_ENGINE): '2d' | '3d' {
  // A documented rollback switch, not a validation or authentication bypass.
  if (configured === '2d') return '2d';
  return new URLSearchParams(search).get('engine') === '2d' ? '2d' : '3d';
}

class GameBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { console.error('[RIVALS]', error); }
  render() {
    if (!this.state.failed) return this.props.children;
    return <main className="min-h-screen grid place-content-center gap-5 bg-background p-8 text-foreground">
      <h1>RIVALS could not load</h1>
      <p>Your account and balances have not been changed. Try reloading, or play the classic version.</p>
      <button onClick={() => window.location.reload()}>RELOAD GAME</button>
      <a href="/gaming?engine=2d">PLAY CLASSIC 2D</a>
      <Link to="/">RETURN TO BASE</Link>
    </main>;
  }
}

/** The authenticated home page; old /gaming links redirect here. */
export default function GamingRoute() {
  const [search] = useSearchParams();
  const engine = gameEngine(search.toString());
  return <GameBoundary key={engine}><Suspense fallback={
    <main className="min-h-screen grid place-content-center gap-5 bg-background p-8 text-foreground">
      <p role="status">Loading RIVALS…</p><Link to="/">RETURN TO BASE</Link>
    </main>
  }>{engine === '2d' ? <ClassicGame /> : <CityGame />}</Suspense></GameBoundary>;
}
