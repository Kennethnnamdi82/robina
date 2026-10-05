import { useState } from 'react';
import { useGame } from '@/context/GameContext';
import { AUTO_CLAIM_PRICE } from '@/types/game';
import { Zap, Check, Clock, Shield, Sparkles } from 'lucide-react';
import USDCPaymentModal from '@/components/USDCPaymentModal';

export default function AutoClaimPage() {
  const { user, activateAutoClaim } = useGame();
  const isActive = user.autoClaimActive && user.autoClaimExpiry > Date.now();
  const remaining = isActive ? user.autoClaimExpiry - Date.now() : 0;
  const daysRemaining = Math.ceil(remaining / (24 * 60 * 60 * 1000));
  const [showPayment, setShowPayment] = useState(false);

  async function handleConfirm() {
    await activateAutoClaim();
  }

  return (
    <div className="px-4 pt-6 pb-24 max-w-lg mx-auto space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold">Auto Claim</h1>
        <p className="text-xs text-muted-foreground mt-1">Automatically claim BD every 6 hours</p>
      </div>

      {/* Status Card */}
      <div className={`glass-card rounded-2xl p-5 relative overflow-hidden ${isActive ? 'border-green-500/30' : ''}`}>
        <div className="absolute inset-0 gradient-primary opacity-5 rounded-2xl" />
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-xl ${isActive ? 'bg-green-500/20' : 'bg-secondary'}`}>
              <Zap className={`w-6 h-6 ${isActive ? 'text-green-400' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <p className="text-sm font-semibold">Status</p>
              <p className={`text-xs font-bold ${isActive ? 'text-green-400' : 'text-muted-foreground'}`}>
                {isActive ? 'Active ✅' : 'Inactive'}
              </p>
            </div>
          </div>
          {isActive && (
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground">Expires in</p>
              <p className="text-sm font-bold">{daysRemaining} days</p>
            </div>
          )}
        </div>
      </div>

      {/* Benefits */}
      <div className="glass-card rounded-2xl p-5 space-y-4">
        <p className="text-sm font-semibold">Benefits</p>
        {[
          { icon: <Sparkles className="w-4 h-4" />, text: 'Passive BD earning every 6 hours' },
          { icon: <Shield className="w-4 h-4" />, text: 'No need to log in every time' },
          { icon: <Clock className="w-4 h-4" />, text: 'Runs automatically for 30 days' },
        ].map((b, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent/10 text-accent">{b.icon}</div>
            <p className="text-xs text-muted-foreground">{b.text}</p>
          </div>
        ))}
      </div>

      {/* Pricing */}
      <div className="glass-card rounded-2xl p-5 text-center space-y-2">
        <p className="text-xs text-muted-foreground">Price</p>
        <p className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-accent to-primary">
          ${AUTO_CLAIM_PRICE} USDC
        </p>
        <p className="text-[10px] text-muted-foreground">for 30 days</p>
      </div>

      {/* CTA */}
      <button
        onClick={() => !isActive && setShowPayment(true)}
        disabled={isActive}
        className={`w-full py-4 rounded-2xl font-bold text-sm transition-all active:scale-95 ${
          isActive
            ? 'bg-green-500/20 text-green-400 cursor-not-allowed'
            : 'gradient-primary text-primary-foreground animate-pulse-glow'
        }`}
      >
        <div className="flex items-center justify-center gap-2">
          {isActive ? (
            <>
              <Check className="w-5 h-5" />
              Auto Claim Active
            </>
          ) : (
            <>
              <Zap className="w-5 h-5" />
              Activate Auto Claim
            </>
          )}
        </div>
      </button>

      <USDCPaymentModal
        open={showPayment}
        onClose={() => setShowPayment(false)}
        title="Activate Auto Claim"
        amount={AUTO_CLAIM_PRICE}
        action="auto_claim"
        onConfirm={handleConfirm}
      />
    </div>
  );
}
