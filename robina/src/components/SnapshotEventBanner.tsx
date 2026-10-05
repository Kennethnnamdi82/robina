import { useEffect, useState } from "react";
import { Gem } from "lucide-react";
import { SEASON_2_END_AT } from "@/utils/seasonRewards";

function getTimeParts(remainingMs: number) {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return { days, hours, minutes, seconds };
}

function CountdownBox({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex min-w-[38px] items-baseline justify-center gap-0.5 rounded border border-amber-300/20 bg-white/[0.07] px-1.5 py-1">
      <span className="text-xs font-black leading-none text-white">
        {String(value).padStart(2, "0")}
      </span>
      <span className="text-[8px] font-bold uppercase leading-none text-amber-100/70">
        {label}
      </span>
    </div>
  );
}

export default function SnapshotEventBanner() {
  const [now, setNow] = useState(() => Date.now());
  const remainingMs = SEASON_2_END_AT - now;
  const hasEnded = remainingMs <= 0;
  const { days, hours, minutes, seconds } = getTimeParts(remainingMs);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div
      className="relative z-30 border-b border-primary/25 bg-[linear-gradient(90deg,#07060b,#17112a_45%,#07060b)] px-3 py-1.5 text-white shadow-md shadow-black/20"
      aria-live="polite"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/80 to-transparent" />

      <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-1.5 sm:min-h-9 sm:flex-row sm:justify-between sm:gap-3">
        <div className="flex min-w-0 items-center gap-2 text-center sm:text-left">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-primary/30 bg-primary/15 text-primary">
            <Gem className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-extrabold uppercase leading-tight text-primary/80">
              Season Event:
            </p>
            <h1 className="truncate text-xs font-black uppercase leading-tight tracking-normal text-white sm:text-sm">
              {hasEnded ? "SEASON 2 HAS ENDED" : "SEASON 2 LIVE NOW"}
            </h1>
          </div>
        </div>

        {hasEnded ? (
          <div className="rounded border border-emerald-300/25 bg-emerald-300/10 px-2.5 py-1 text-[11px] font-black uppercase text-emerald-100">
            Snapshot taken
          </div>
        ) : (
          <div className="flex shrink-0 items-center gap-1">
            <CountdownBox value={days} label="Days" />
            <CountdownBox value={hours} label="Hrs" />
            <CountdownBox value={minutes} label="Min" />
            <CountdownBox value={seconds} label="Sec" />
          </div>
        )}
      </div>
    </div>
  );
}
