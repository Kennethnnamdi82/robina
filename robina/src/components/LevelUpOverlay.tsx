import { useEffect, useState } from 'react';
import { Rocket } from 'lucide-react';

interface Props {
  level: string;
  visible: boolean;
  onDone: () => void;
}

export default function LevelUpOverlay({ level, visible, onDone }: Props) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (visible) {
      setShow(true);
      const t = setTimeout(() => {
        setShow(false);
        onDone();
      }, 2200);
      return () => clearTimeout(t);
    }
  }, [visible, onDone]);

  if (!show) return null;

  return (
    <div className="user-experience fixed inset-0 z-[100] flex items-center justify-center bg-background/90 backdrop-blur-md animate-fade-in">
      <div className="text-center space-y-4 animate-scale-in">
        <div className="w-20 h-20 mx-auto rounded-full gradient-primary flex items-center justify-center animate-pulse-glow">
          <Rocket className="w-10 h-10 text-primary-foreground" />
        </div>
        <p className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-accent to-primary">
          Level Up! 🚀
        </p>
        <p className="text-lg font-bold text-foreground">{level}</p>
      </div>
    </div>
  );
}
