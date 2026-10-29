import { useState } from 'react';
import { ArenaView } from '@/features/rivals/ui/ArenaView';
import { Lobby } from '@/features/rivals/ui/Lobby';
import '@/features/rivals/rivals.css';
import { initialPresentation, saveQuality, type CharacterId, type QualityId } from '@/features/rivals/core/presentation';

export default function GamingPage() {
  const [inArena, setInArena] = useState(false);
  const [characterId, setCharacterId] = useState<CharacterId>('vex');
  const [presentation, setPresentation] = useState(initialPresentation);
  const setQuality = (quality: QualityId) => { saveQuality(quality); setPresentation(value => ({ ...value, quality })); };
  return <main className="rivals-shell" aria-label="RIVALS Rival Heist">
    {inArena ? <ArenaView onExit={() => setInArena(false)} characterId={characterId} quality={presentation.quality} reducedMotion={presentation.reducedMotion} onQuality={setQuality} /> : <Lobby onEnter={() => setInArena(true)} characterId={characterId} onCharacter={setCharacterId} quality={presentation.quality} onQuality={setQuality} />}
  </main>;
}
