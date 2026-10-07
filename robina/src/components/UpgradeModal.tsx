import { useState } from 'react';
import { useGame } from '@/context/GameContext';
import { getLevelInfo, getNextLevel } from '@/types/game';
import { toast } from 'sonner';
import { ArrowRight, Coins, X } from 'lucide-react';
import LevelIcon from '@/components/LevelIcon';
import USDCPaymentModal from '@/components/USDCPaymentModal';
import { useNavigate } from 'react-router-dom';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function UpgradeModal({ open, onClose }: Props) {
  const { user, upgradeLevelWithBD, upgradeLevelWithUSDC, refreshUser } = useGame();
  const currentLevel = getLevelInfo(user.level);
  const nextLevel = getNextLevel(user.level);
  const [showUSDCPayment, setShowUSDCPayment] = useState(false);
  const [redirectingAfterSuccess, setRedirectingAfterSuccess] = useState(false);
  const navigate = useNavigate();

  if (!open) return null;

  async function handleBD() {
    if (redirectingAfterSuccess) return;
    if (!nextLevel) return;
    if (user.bd < nextLevel.bdRequired) {
      toast.error(`You need ${nextLevel.bdRequired} BD to upgrade`);
      return;
    }
    if (await upgradeLevelWithBD()) {
      toast.success(`Upgraded to ${nextLevel.name}!`);
      await refreshUser();
      setRedirectingAfterSuccess(true);
      setTimeout(() => {
        setRedirectingAfterSuccess(false);
        onClose();
        navigate('/');
      }, 3500);
    }
  }

  async function handleUSDCConfirm() {
    if (redirectingAfterSuccess) return;
    if (!nextLevel) return;
    if (await upgradeLevelWithUSDC()) {
      await refreshUser();
      setRedirectingAfterSuccess(true);
      toast.success(`Upgraded to ${nextLevel.name}! Redirecting...`);
      setTimeout(() => {
        setRedirectingAfterSuccess(false);
        onClose();
        navigate('/');
      }, 3500);
    }
  }

  if (!nextLevel) {
    return (
      <div className="user-experience fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm" onClick={onClose}>
        <div className="w-full max-w-lg glass-card rounded-3xl p-6 animate-scale-in space-y-4" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Max Level</h2>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-secondary"><X className="w-5 h-5" /></button>
          </div>
          <p className="text-sm text-muted-foreground text-center py-6">You've reached the highest level! 🏆</p>
        </div>
      </div>
    );
  }

  const canAffordBD = user.bd >= nextLevel.bdRequired;

  return (
    <>
      <div className="user-experience fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm" onClick={onClose}>
        <div className="w-full max-w-lg glass-card rounded-3xl p-6 animate-scale-in space-y-5" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Upgrade Level</h2>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-secondary"><X className="w-5 h-5" /></button>
          </div>

          {/* Current → Next */}
          <div className="flex items-center justify-center gap-4">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mx-auto">
                <LevelIcon level={currentLevel.name} size={28} className={currentLevel.color} />
              </div>
              <p className={`text-xs font-semibold mt-2 ${currentLevel.color}`}>{currentLevel.name}</p>
              <p className="text-[10px] text-muted-foreground">{currentLevel.claimReward} BD/claim</p>
            </div>
            <ArrowRight className="w-5 h-5 text-muted-foreground" />
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mx-auto border-2 border-primary/30">
                <LevelIcon level={nextLevel.name} size={28} className={nextLevel.color} />
              </div>
              <p className={`text-xs font-semibold mt-2 ${nextLevel.color}`}>{nextLevel.name}</p>
              <p className="text-[10px] text-muted-foreground">{nextLevel.claimReward} BD/claim</p>
            </div>
          </div>

          {/* BD Balance */}
          <div className="glass-card rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-accent" />
              <span className="text-xs text-muted-foreground">Your BD Balance</span>
            </div>
            <span className="text-sm font-bold">{user.bd.toLocaleString()} BD</span>
          </div>

          {/* Upgrade Options */}
          <div className="space-y-3">
            <button
              onClick={handleBD}
              disabled={!canAffordBD || redirectingAfterSuccess}
              className={`w-full py-4 rounded-2xl font-bold text-sm transition-all active:scale-95 ${
                canAffordBD
                  ? 'gradient-primary text-primary-foreground neon-glow'
                  : 'bg-secondary text-muted-foreground cursor-not-allowed'
              }`}
            >
              {redirectingAfterSuccess ? 'Upgrade successful. Redirecting...' : `Upgrade with ${nextLevel.bdRequired.toLocaleString()} BD`}
            </button>

            <button
              onClick={() => setShowUSDCPayment(true)}
              disabled={redirectingAfterSuccess}
              className="w-full py-4 rounded-2xl border border-accent/40 text-accent font-bold text-sm transition-all active:scale-95 hover:bg-accent/10"
            >
              Upgrade with ${nextLevel.usdcPrice} USDC
            </button>
          </div>
        </div>
      </div>

      <USDCPaymentModal
        open={showUSDCPayment}
        onClose={() => setShowUSDCPayment(false)}
        title={`Upgrade to ${nextLevel.name}`}
        amount={nextLevel.usdcPrice}
        action="upgrade"
        onConfirm={handleUSDCConfirm}
      />
    </>
  );
}
