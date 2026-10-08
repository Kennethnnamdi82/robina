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
  BadgePercent,
  ListChecks,
  Trophy,
} from "lucide-react";
import LevelIcon from "@/components/LevelIcon";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import UpgradeModal from "@/components/UpgradeModal";
import LevelUpOverlay from "@/components/LevelUpOverlay";
import USDCPaymentModal from "@/components/USDCPaymentModal";

const HOME_PANEL_CLASS =
  "relative isolate overflow-hidden rounded-2xl border border-border bg-card shadow-card";
const HOME_SUB_PANEL_CLASS =
  "rounded-xl border border-border bg-secondary/55";

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
    <div className="user-experience min-h-screen">
      <div className="px-4 pt-5 pb-24 max-w-lg mx-auto space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="lime-kicker">Season Dashboard</p>
            <h1 className="mt-1 text-3xl font-black leading-tight tracking-tight">BaseDrop</h1>
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

        <section className={`${HOME_PANEL_CLASS} p-5 before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-primary/80 before:to-transparent`}>
          <div className="pointer-events-none absolute -right-20 -top-24 h-52 w-52 rounded-full bg-primary/10 blur-3xl" />
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

          <div className="my-5 h-px bg-border" />

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
                  : "border border-border bg-secondary/60 text-white/45 cursor-not-allowed"
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
                className="mt-3 w-full py-3 rounded-xl border border-border bg-secondary/60 text-white text-xs font-bold hover:border-primary/40 hover:bg-primary/10 transition-all active:scale-95 uppercase tracking-wide"
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
          <div className="relative mb-4 flex items-end justify-between">
            <div>
              <p className="lime-kicker">Services</p>
              <h2 className="mt-1 text-lg font-bold text-white">Quick actions</h2>
            </div>
            <p className="text-[10px] font-semibold text-white/45">ONE-TAP ACCESS</p>
          </div>

          <div className="relative grid grid-cols-3 gap-x-2 gap-y-4">
            {[
              {
                label: "Level up",
                detail: `${levelProgress}% progress`,
                icon: ArrowUp,
                active: true,
                onClick: () => setShowUpgrade(true),
              },
              {
                label: "Auto mining",
                detail: isAutoClaimActive ? "Active" : "Start earning",
                icon: Zap,
                active: isAutoClaimActive,
                onClick: () => navigate("/auto-claim"),
              },
              {
                label: "Multiplier",
                detail: hasCardMultiplier ? `${user.cardMultiplier}x active` : "Boost cards",
                icon: BadgePercent,
                active: hasCardMultiplier,
                onClick: () => navigate("/gaming"),
              },
              {
                label: "Tasks",
                detail: "Earn BD",
                icon: ListChecks,
                active: false,
                onClick: () => navigate("/tasks"),
              },
              {
                label: "Auto claim",
                detail: "Every 6 hours",
                icon: Sparkles,
                active: isAutoClaimActive,
                onClick: () => navigate("/auto-claim"),
              },
              {
                label: "Rank",
                detail: "Season board",
                icon: Trophy,
                active: false,
                onClick: () => navigate("/rank"),
              },
            ].map(({ label, detail, icon: Icon, active, onClick }) => (
              <button
                key={label}
                onClick={onClick}
                className="group flex min-h-[104px] flex-col items-center rounded-2xl border border-transparent px-1.5 py-3 text-center transition-all duration-200 hover:border-primary/25 hover:bg-primary/[0.06] active:scale-95"
              >
                <span className={`grid h-11 w-11 place-items-center rounded-2xl border transition-all ${active ? "border-primary/35 bg-primary/15 text-primary shadow-[0_0_22px_rgba(194,255,56,0.12)]" : "border-border bg-secondary/60 text-white/80 group-hover:border-primary/30 group-hover:text-primary"}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <span className="mt-2 text-[11px] font-bold leading-none text-white">{label}</span>
                <span className={`mt-1 truncate text-[9px] leading-none ${active ? "text-primary/80" : "text-white/45"}`}>{detail}</span>
              </button>
            ))}
          </div>
        </section>
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
