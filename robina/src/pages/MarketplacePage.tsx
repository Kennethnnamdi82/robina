import { ArrowUpRight, BadgePercent, Gem, ShieldCheck, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import treasure1 from "@/assets/treasures/treasure-1.jpeg";
import treasure4 from "@/assets/treasures/treasure-4.jpeg";

const MARKET_ITEMS = [
  {
    name: "Card multiplier",
    description: "Increase BD rewards from every card you open.",
    price: "From 0.20 USDC",
    icon: BadgePercent,
    image: treasure1,
    action: "/gaming",
  },
  {
    name: "Auto mining",
    description: "Keep earning BD while you are away for 30 days.",
    price: "0.99 USDC",
    icon: Zap,
    image: treasure4,
    action: "/auto-claim",
  },
];

export default function MarketplacePage() {
  const navigate = useNavigate();

  return (
    <main className="user-experience min-h-screen px-4 pb-24 pt-6">
      <div className="mx-auto max-w-lg space-y-5">
        <header>
          <p className="lime-kicker">Utility market</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Marketplace</h1>
          <p className="mt-1 text-sm text-muted-foreground">Upgrade the way you earn and play.</p>
        </header>

        <section className="relative overflow-hidden rounded-3xl border border-primary/25 bg-[linear-gradient(130deg,hsl(80_18%_13%),hsl(120_4%_8%)_58%)] p-5 shadow-card">
          <div className="pointer-events-none absolute -right-8 -top-12 h-36 w-36 rounded-full bg-primary/20 blur-3xl" />
          <div className="relative">
            <span className="inline-flex rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">Web3 utility</span>
            <h2 className="mt-3 max-w-[14rem] text-2xl font-bold leading-tight">Make every session count.</h2>
            <p className="mt-2 max-w-[16rem] text-xs leading-relaxed text-muted-foreground">Use secure on-chain USDC upgrades to unlock more from BaseDrop.</p>
          </div>
          <div className="relative mt-5 flex items-center gap-2 text-[11px] font-semibold text-primary">
            <ShieldCheck className="h-4 w-4" /> Verified on-chain payments
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-bold">Featured upgrades</h2>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">2 items</span>
          </div>
          <div className="space-y-3">
            {MARKET_ITEMS.map(({ name, description, price, icon: Icon, image, action }) => (
              <article key={name} className="glass-card group flex gap-3 rounded-2xl p-3 transition-colors hover:border-primary/35">
                <img src={image} alt="" className="h-[86px] w-[76px] rounded-xl object-cover opacity-90" />
                <div className="min-w-0 flex-1 py-0.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Icon className="h-4 w-4 text-primary" />
                      <h3 className="text-sm font-bold text-white">{name}</h3>
                    </div>
                    <Gem className="h-4 w-4 shrink-0 text-primary/70" />
                  </div>
                  <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{description}</p>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-primary">{price}</span>
                    <button onClick={() => navigate(action)} className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-[10px] font-bold text-primary-foreground transition-transform active:scale-95">
                      View <ArrowUpRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
