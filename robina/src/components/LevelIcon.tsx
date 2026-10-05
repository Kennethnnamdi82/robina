import {
  Droplet, Shield, Gem, Crown, Star,
  Diamond, Swords, Flame, Sparkles, Trophy
} from 'lucide-react';
import type { Level } from '@/types/game';

const ICON_MAP: Record<Level, React.ElementType> = {
  Beginner: Droplet,
  Bronze: Shield,
  Silver: Gem,
  Gold: Crown,
  Platinum: Star,
  Diamond: Diamond,
  Master: Swords,
  Grandmaster: Flame,
  Legendary: Sparkles,
  'Top Legendary': Trophy,
};

interface Props {
  level: Level;
  size?: number;
  className?: string;
}

export default function LevelIcon({ level, size = 20, className = '' }: Props) {
  const Icon = ICON_MAP[level] || Droplet;
  return <Icon className={className} size={size} />;
}
