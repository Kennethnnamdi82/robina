import { useGame } from "@/context/GameContext";
import { useAuth } from "@/context/AuthContext";
import { shortenWallet, getLevelInfo } from "@/types/game";
import { toast } from "sonner";
import {
  Copy,
  Users,
  Coins,
  ArrowUp,
  LogOut,
  Shield,
  HelpCircle,
} from "lucide-react";
import LevelIcon from "@/components/LevelIcon";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import UpgradeModal from "@/components/UpgradeModal";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

type FaqItem = { question: string; answer: string };
type FaqSection = { title: string; items: FaqItem[] };

const FAQ_SECTIONS: FaqSection[] = [
  {
    title: "General",
    items: [
      {
        question: "What is BaseDrop?",
        answer:
          "BaseDrop is a card-based Web3 mini app on Base where you collect treasures, earn BD Coins, complete tasks, and compete each season.",
      },
      {
        question: "How do I start earning BD Coins?",
        answer:
          "Connect your wallet, open game cards, complete eligible tasks, and use referrals to build BD faster.",
      },
      {
        question: "Do I need a wallet to play?",
        answer:
          "Yes. You need a wallet connected to Base to play, pay in USDC, and save your progress.",
      },
      {
        question: "What are the different levels?",
        answer:
          "Progression starts at Beginner, then Bronze, Silver, Gold, Platinum, Diamond, Master, Grandmaster, Legendary, and Top Legendary.",
      },
    ],
  },
  {
    title: "Gameplay",
    items: [
      {
        question: "How does the Treasure system work?",
        answer:
          "A full season has 6 treasures. You must collect all 6/6 to qualify for season treasure rewards.",
      },
      {
        question: "Why did I get BD Coins and no Treasure?",
        answer:
          "Each card gives only one reward type: Treasure OR BD Coins, never both in the same card.",
      },
      {
        question: "What happens after I open all 8 cards?",
        answer:
          "A new 8-card set loads automatically so gameplay continues without stopping.",
      },
      {
        question: "What is the Treasure Bank?",
        answer:
          "Treasure Bank stores your found treasures as your collectible progress record.",
      },
    ],
  },
  {
    title: "Account & Payments",
    items: [
      {
        question: "How do I pay for upgrades?",
        answer:
          "USDC on Base is used for paid upgrades. You can also upgrade using BD if you reach the required amount.",
      },
      {
        question: "Are payments instant?",
        answer:
          "Most payments confirm quickly, but timing depends on network confirmation speed.",
      },
      {
        question: "How do tasks work for X and Telegram?",
        answer:
          "You can complete follow, like/repost/comment, join, and post-link tasks. Some submissions are reviewed before BD is awarded.",
      },
      {
        question: "I submitted my X post link. When do I get BD?",
        answer:
          "Post-link tasks can require manual review. Once approved, your BD reward is added.",
      },
      {
        question: "Why does balance sometimes look like zero briefly?",
        answer:
          "After login or long inactivity, sync can take a few seconds. Your saved progress should appear after refresh/sync completes.",
      },
    ],
  },
  {
    title: "Seasons",
    items: [
      {
        question: "How long does a season last?",
        answer:
          "Season timing is set by admin. You can always check the current season countdown in the app.",
      },
      {
        question: "What happens when a season ends?",
        answer: "BD Coins and seasonal rankings reset to 0 for the new season.",
      },
      {
        question: "What do I keep permanently?",
        answer:
          "Your wallet identity, user level, payment history, and permanent assets stay with your account.",
      },
      {
        question: "How do I qualify for final seasonal payout?",
        answer:
          "Collect all 6/6 treasures and stay competitive on the season ranking rules shown by the active season.",
      },
      {
        question: "Will my rank drop if I spend BD to level up?",
        answer:
          "Yes. If you use BD for an upgrade, your BD balance decreases, so your leaderboard position may move down.",
      },
    ],
  },
];

function daySeed() {
  return Math.floor(Date.now() / 86400000);
}

function dailyFaqSections(): FaqSection[] {
  const seed = daySeed();
  const withOneEach = FAQ_SECTIONS.map((section, sectionIdx) => {
    const idx = (seed + sectionIdx) % section.items.length;
    return {
      title: section.title,
      items: [section.items[idx]],
    };
  });

  const bonusSections = withOneEach.map((section, idx) => {
    const source = FAQ_SECTIONS[idx];
    if (source.items.length < 2) return section;
    const showBonus = (seed + idx) % 2 === 0;
    if (!showBonus) return section;
    const firstIdx = source.items.findIndex(
      (item) => item.question === section.items[0].question,
    );
    const bonusIdx =
      (firstIdx + 1 + (seed % (source.items.length - 1))) % source.items.length;
    const bonusItem = source.items[bonusIdx];
    if (!bonusItem || bonusItem.question === section.items[0].question)
      return section;
    return { ...section, items: [...section.items, bonusItem] };
  });

  return bonusSections;
}

export default function ProfilePage() {
  const { user } = useGame();
  const { baseUser, signOut, isAdmin } = useAuth();
  const levelInfo = getLevelInfo(user.level);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const navigate = useNavigate();
  const dailySections = dailyFaqSections();

  const appBaseUrl = (
    import.meta.env.VITE_APP_URL || window.location.origin
  ).replace(/\/+$/, "");
  const referralLink = `${appBaseUrl}/?ref=${encodeURIComponent(user.referralCode)}`;

  function copyReferral() {
    navigator.clipboard.writeText(referralLink);
    toast.success("Referral link copied!");
  }

  async function handleLogout() {
    await signOut();
    toast.success("Logged out");
  }

  return (
    <>
      <div className="px-4 pt-6 pb-24 max-w-lg mx-auto space-y-5 animate-fade-in">
        <h1 className="text-xl font-bold">Profile</h1>

        {/* Profile Card */}
        <div className="glass-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-4">
            <img
              src={baseUser?.avatar || ""}
              alt="avatar"
              className="w-14 h-14 rounded-2xl border-2 border-primary/30 bg-secondary"
            />
            <div>
              <p className="text-sm font-bold">
                {baseUser?.name || shortenWallet(user.wallet)}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {shortenWallet(user.wallet)}
              </p>
              <div
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold mt-1 bg-level-${user.level.toLowerCase().replace(" ", "-")} ${levelInfo.color}`}
              >
                <LevelIcon level={user.level} size={12} />
                {user.level}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-secondary/50 rounded-xl p-3 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Coins className="w-3 h-3 text-accent" />
              </div>
              <p className="text-lg font-bold">{user.bd.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">BD Balance</p>
            </div>
            <div className="bg-secondary/50 rounded-xl p-3 text-center">
              <p className="text-lg font-bold">{user.referralCount}</p>
              <p className="text-[10px] text-muted-foreground">Referrals</p>
            </div>
          </div>
        </div>

        {/* Upgrade Button */}
        <button
          onClick={() => setShowUpgrade(true)}
          className="w-full py-4 rounded-2xl gradient-primary text-primary-foreground font-bold text-sm transition-all active:scale-95 neon-glow"
        >
          <div className="flex items-center justify-center gap-2">
            <ArrowUp className="w-5 h-5" />
            Upgrade Level
          </div>
        </button>

        {/* Referral */}
        <div className="glass-card rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-accent" />
            <p className="text-sm font-semibold">Referral Program</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Earn 20 BD per valid referral. Referred user must complete a task
            AND make a paid action.
          </p>
          <div className="flex gap-2">
            <div className="flex-1 bg-secondary/50 rounded-xl px-3 py-2.5 text-xs text-muted-foreground truncate font-mono">
              {referralLink}
            </div>
            <button
              onClick={copyReferral}
              className="px-4 py-2.5 rounded-xl gradient-primary text-primary-foreground transition-all active:scale-95"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Admin Panel Link — admins only */}
        {isAdmin && (
          <button
            onClick={() => navigate("/admin")}
            className="w-full glass-card rounded-2xl p-4 flex items-center justify-between hover:border-primary/30 transition-all active:scale-[0.98]"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-accent/10">
                <Shield className="w-5 h-5 text-accent" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold">Admin Dashboard</p>
                <p className="text-xs text-muted-foreground">
                  Manage users, tasks & payments
                </p>
              </div>
            </div>
          </button>
        )}

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full py-3 rounded-2xl border border-destructive/30 text-destructive text-sm font-medium hover:bg-destructive/10 transition-all active:scale-95 flex items-center justify-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>

        <div className="glass-card rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-accent" />
            <p className="text-sm font-semibold">FAQ</p>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Quick answers to help you play smarter and progress faster.
          </p>
          <div className="space-y-3">
            {dailySections.map((section) => (
              <div
                key={section.title}
                className="rounded-xl bg-secondary/30 px-3"
              >
                <p className="text-xs font-semibold pt-3">{section.title}</p>
                <Accordion type="single" collapsible className="w-full">
                  {section.items.map((item, idx) => (
                    <AccordionItem
                      key={item.question}
                      value={`${section.title}-${idx}`}
                      className="border-border/40"
                    >
                      <AccordionTrigger className="text-xs py-3 text-left hover:no-underline">
                        {item.question}
                      </AccordionTrigger>
                      <AccordionContent className="text-xs text-muted-foreground pb-3">
                        {item.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            ))}
          </div>
        </div>
      </div>
      <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} />
    </>
  );
}
