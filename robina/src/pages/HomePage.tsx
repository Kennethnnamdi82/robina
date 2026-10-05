import { useGame } from "@/context/GameContext";
import {
  shortenWallet,
  getLevelInfo,
  getClaimReward,
  getInstantClaimCost,
  getNextLevel,
} from "@/types/game";
import { formatTime } from "@/utils/formatTime";
import { toast } from "sonner";
import {
  Zap,
  ArrowUp,
  Clock,
  Sparkles,
  Coins,
  ChevronRight,
  BadgePercent,
} from "lucide-react";
import LevelIcon from "@/components/LevelIcon";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import UpgradeModal from "@/components/UpgradeModal";
import LevelUpOverlay from "@/components/LevelUpOverlay";
import USDCPaymentModal from "@/components/USDCPaymentModal";

const HOME_PANEL_CLASS =
  "relative isolate overflow-hidden rounded-2xl border border-[#2a2f3b] bg-[#171a22] shadow-card";
const HOME_SUB_PANEL_CLASS =
  "rounded-xl border border-[#2a2f3b] bg-[#222630]";

export default function HomePage() {
  const {
    user,
    loading,
    claimBD,
    instantClaim,
    canClaim,
    claimCooldownRemaining,
    levelJustChanged,
    clearLevelChange,
  } = useGame();

  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showInstantPayment, setShowInstantPayment] = useState(false);
  const navigate = useNavigate();

  const levelInfo = getLevelInfo(user.level);
  const reward = getClaimReward(user.level);
  const instantCost = getInstantClaimCost(user.level);
  const nextLevel = getNextLevel(user.level);
  const levelProgress = nextLevel
    ? Math.min(100, Math.round((user.bd / nextLevel.bdRequired) * 100))
    : 100;

  // Safety check for auto-claim expiry
  const isAutoClaimActive =
    user.autoClaimActive && user.autoClaimExpiry > Date.now();
  const hasCardMultiplier = Number(user.cardMultiplier || 1) >= 2;
  const cardMultiplierLabel = hasCardMultiplier
    ? `${user.cardMultiplier}x active on BD cards`
    : "Boost BD card rewards";

  async function handleClaim() {
    try {
      const ok = await claimBD();
      if (ok) {
        toast.success(`+${reward} BD claimed!`);
      } else {
        toast.error("Claim failed. Please try again or check your connection.");
      }
    } catch (err) {
      toast.error("An unexpected error occurred during claim.");
    }
  }

  async function handleInstantClaimConfirm() {
    const ok = await instantClaim();
    if (ok) {
      toast.success(`Instant claim successful! +${reward} BD`);
    } else {
      toast.error("Instant claim failed.");
    }
  }

  const levelKey = user.level.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="min-h-screen bg-[#0b0d14]">
      <div className="px-4 pt-5 pb-24 max-w-lg mx-auto space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-accent">
              Season Dashboard
            </p>
            <h1 className="text-2xl font-black leading-tight">BaseDrop</h1>
            <p className="text-xs text-muted-foreground">
              {shortenWallet(user.wallet)}
            </p>
          </div>
          <div
            className={`shrink-0 px-3 py-2 rounded-xl text-xs font-bold bg-level-${levelKey} ${levelInfo.color} flex items-center gap-1.5 shadow-sm ring-1 ring-white/10`}
          >
            <LevelIcon level={user.level} size={14} />
            {user.level}
          </div>
        </div>

        <section className={`${HOME_PANEL_CLASS} p-5`}>
          <div className="relative space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Coins className="w-4 h-4 text-accent" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">
                    Available BD
                  </p>
                </div>
                <p className="mt-2 text-5xl font-black leading-none text-white">
                  {user.bd.toLocaleString()}
                </p>
              </div>
              <div className={`${HOME_SUB_PANEL_CLASS} px-3 py-2 text-right`}>
                <p className="text-[10px] font-bold uppercase text-white/55">
                  Per Claim
                </p>
                <p className="text-lg font-black text-white">
                  +{reward} BD
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className={`${HOME_SUB_PANEL_CLASS} p-3`}>
                <p className="text-[10px] font-bold uppercase text-white/55">
                  Current Level
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <LevelIcon
                    level={user.level}
                    size={18}
                    className={levelInfo.color}
                  />
                  <p className={`text-sm font-bold ${levelInfo.color}`}>
                    {user.level}
                  </p>
                </div>
              </div>
              <div className={`${HOME_SUB_PANEL_CLASS} p-3`}>
                <p className="text-[10px] font-bold uppercase text-white/55">
                  Claim Cycle
                </p>
                <p className="mt-2 text-sm font-bold text-white">
                  Every 6 hours
                </p>
              </div>
            </div>
          </div>

          <div className="my-5 h-px bg-[#2a2f3b]" />

          <div className="relative">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-white">
                  {canClaim ? "Ready to claim" : "Mining in progress"}
                </p>
                <p className="text-xs text-white/60">
                  {canClaim
                    ? `Your ${reward} BD reward is available.`
                    : loading
                      ? "Syncing your mining status."
                      : "Next claim unlocks when the timer ends."}
                </p>
              </div>
              {!canClaim && !loading ? (
                <div className={`${HOME_SUB_PANEL_CLASS} px-3 py-2 text-right`}>
                  <div className="flex items-center justify-end gap-1.5 text-white/55">
                    <Clock className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold uppercase">
                      Unlocks In
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-xl font-black tracking-tight text-white">
                    {formatTime(claimCooldownRemaining)}
                  </p>
                </div>
              ) : null}
            </div>

            <button
              onClick={handleClaim}
              disabled={!canClaim}
              className={`w-full py-4 rounded-xl font-black text-lg transition-all duration-300 shadow-lg ${
                canClaim
                  ? "bg-primary text-primary-foreground active:scale-95"
                  : "border border-[#2a2f3b] bg-[#222630] text-white/45 cursor-not-allowed"
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Sparkles className="w-5 h-5" />
                {canClaim ? `Claim ${reward} BD` : "Mining Locked"}
              </div>
            </button>

            {!canClaim && !loading && (
              <button
                onClick={() => setShowInstantPayment(true)}
                className="mt-3 w-full py-3 rounded-xl border border-[#2a2f3b] bg-[#222630] text-white text-xs font-bold hover:bg-[#2b303b] transition-all active:scale-95 uppercase tracking-wide"
              >
                <div className="flex items-center justify-center gap-2">
                  <Zap className="w-3.5 h-3.5 fill-accent text-accent" />
                  Instant Claim (${instantCost} USDC)
                </div>
              </button>
            )}
          </div>
        </section>

        <section className={`${HOME_PANEL_CLASS} p-4`}>
          <button
            onClick={() => setShowUpgrade(true)}
            className="relative w-full text-left"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#2a2f3b] bg-[#222630]">
                  <ArrowUp className="w-5 h-5 text-accent" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white">Level Progress</p>
                  <p className="truncate text-xs text-white/60">
                    {nextLevel
                      ? `Next: ${nextLevel.name} gives +${nextLevel.claimReward} BD per claim`
                      : "You have reached the highest level"}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 shrink-0 text-white/55" />
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#2b303b]">
              <div
                className="h-full rounded-full gradient-primary transition-all duration-500"
                style={{ width: `${levelProgress}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px] font-semibold text-white/55">
              <span>{levelProgress}% of next level</span>
              {nextLevel ? (
                <span>{nextLevel.bdRequired.toLocaleString()} BD target</span>
              ) : (
                <span>Max level</span>
              )}
            </div>
          </button>
        </section>

        <button
          onClick={() => navigate("/auto-claim")}
          className={`${HOME_PANEL_CLASS} w-full p-4 transition-all hover:border-white/20 active:scale-[0.98]`}
        >
          <div className="relative flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl border border-[#2a2f3b] transition-colors ${isAutoClaimActive ? "bg-green-500/15" : "bg-[#222630]"}`}
              >
                <Zap
                  className={`w-5 h-5 ${isAutoClaimActive ? "text-green-400" : "text-muted-foreground"}`}
                />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-white">Auto-Mining</p>
                <p
                  className={`text-xs ${isAutoClaimActive ? "text-green-400" : "text-white/60"}`}
                >
                  {isAutoClaimActive ? "Active and earning every cycle" : "Turn on passive claims"}
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-white/55" />
          </div>
        </button>

        <button
          onClick={() => navigate("/gaming")}
          className={`${HOME_PANEL_CLASS} w-full p-4 transition-all hover:border-white/20 active:scale-[0.98]`}
        >
          <div className="relative flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl border border-[#2a2f3b] transition-colors ${hasCardMultiplier ? "bg-green-500/15" : "bg-[#222630]"}`}
              >
                <BadgePercent
                  className={`w-5 h-5 ${hasCardMultiplier ? "text-green-400" : "text-muted-foreground"}`}
                />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-white">Card Multiplier</p>
                <p
                  className={`text-xs ${hasCardMultiplier ? "text-green-400" : "text-white/60"}`}
                >
                  {cardMultiplierLabel}
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-white/55" />
          </div>
        </button>
      </div>

      <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} />

      <USDCPaymentModal
        open={showInstantPayment}
        onClose={() => setShowInstantPayment(false)}
        title="Instant Claim"
        amount={instantCost}
        action="instant_claim"
        onConfirm={handleInstantClaimConfirm}
      />

      <LevelUpOverlay
        level={levelJustChanged || ""}
        visible={!!levelJustChanged}
        onDone={clearLevelChange}
      />
    </div>
  );
}
