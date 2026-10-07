import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { SEASON_2_END_AT } from "@/utils/seasonRewards";

function formatSeasonCountdown(remainingMs: number) {
  const totalMinutes = Math.max(0, Math.ceil(remainingMs / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  return `${days}d ${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m`;
}

export default function SeasonLiveBanner() {
  const [now, setNow] = useState(() => Date.now());
  const remainingMs = Math.max(0, SEASON_2_END_AT - now);
  const hasEnded = remainingMs <= 0;

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div
      className="user-experience relative overflow-hidden rounded-xl border border-primary/35 bg-background/80 px-3 py-3 shadow-sm backdrop-blur transition-all duration-500 hover:border-primary/55 hover:shadow-md animate-fade-in"
      aria-live="polite"
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-primary/15 via-accent/10 to-primary/15" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />

      <div className="relative flex items-center gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/35 bg-primary/15 text-primary">
            <Trophy className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className={`text-xs font-black leading-tight text-foreground ${hasEnded ? "" : "uppercase"}`}>
              {hasEnded
                ? "Season 2 has ended and snapshot taken"
                : "SEASON 2 LIVE NOW"}
            </p>
            {!hasEnded ? (
              <p className="text-[11px] font-semibold uppercase leading-snug text-foreground/75">
                {`${formatSeasonCountdown(remainingMs)} remaining`}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
