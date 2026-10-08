import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Crosshair, Shield, Skull, Target, Trophy, RotateCcw, Home, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import RugfireMission, { type ActiveEnemy } from "@/features/rugfire/RugfireMission";
import { ENEMIES, MISSION_ENEMIES, OBJECTIVES, WEAPONS, type EnemyRole, type WeaponId } from "@/features/rugfire/gameData";

type MissionMode = "briefing" | "active" | "rugged" | "complete";
type AmmoState = Record<WeaponId, { magazine: number; reserve: number }>;

const WEAPON_ORDER: WeaponId[] = ["pistol", "smg", "rifle"];

function createEnemies(): ActiveEnemy[] {
  return MISSION_ENEMIES.map((enemy) => ({ ...enemy, health: ENEMIES[enemy.role].health, alive: true }));
}

function createAmmo(): AmmoState {
  return {
    pistol: { magazine: WEAPONS.pistol.magazineSize, reserve: WEAPONS.pistol.reserveAmmo },
    smg: { magazine: WEAPONS.smg.magazineSize, reserve: WEAPONS.smg.reserveAmmo },
    rifle: { magazine: WEAPONS.rifle.magazineSize, reserve: WEAPONS.rifle.reserveAmmo },
  };
}

export default function GamingPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<MissionMode>("briefing");
  const [phase, setPhase] = useState(0);
  const [enemies, setEnemies] = useState<ActiveEnemy[]>(createEnemies);
  const [weaponId, setWeaponId] = useState<WeaponId>("rifle");
  const [ammo, setAmmo] = useState<AmmoState>(createAmmo);
  const [health, setHealth] = useState(100);
  const [reloading, setReloading] = useState(false);
  const [damageReceived, setDamageReceived] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [feed, setFeed] = useState("SYSTEM READY");
  const dodgeUntil = useRef(0);

  const weapon = WEAPONS[weaponId];
  const activeWave = phase === 0 ? 0 : phase <= 2 ? 1 : phase === 3 ? 2 : 3;
  const objective = OBJECTIVES[phase];
  const boss = enemies.find((enemy) => enemy.id === "boss");
  const enemiesEliminated = enemies.filter((enemy) => !enemy.alive).length;

  useEffect(() => {
    if (!startedAt || mode !== "active") return;
    const interval = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => window.clearInterval(interval);
  }, [mode, startedAt]);

  useEffect(() => {
    const waveOneClear = enemies.filter((enemy) => enemy.wave === 1).every((enemy) => !enemy.alive);
    const waveTwoClear = enemies.filter((enemy) => enemy.wave === 2).every((enemy) => !enemy.alive);
    if (mode !== "active") return;
    if (phase === 1 && waveOneClear) {
      setPhase(2);
      setFeed("LAUNCH DISTRICT SECURED · ADVANCE TO FACILITY");
    }
    if (phase === 3 && waveTwoClear) {
      setPhase(4);
      setFeed("MEGA RUGGER DETECTED · ELIMINATE THE THREAT");
    }
    if (phase === 4 && boss && !boss.alive) {
      setMode("complete");
      setFeed("THREAT ELIMINATED");
    }
  }, [boss, enemies, mode, phase]);

  const retry = () => {
    setMode("briefing"); setPhase(0); setEnemies(createEnemies()); setWeaponId("rifle"); setAmmo(createAmmo());
    setHealth(100); setReloading(false); setDamageReceived(0); setElapsed(0); setStartedAt(null); setFeed("SYSTEM READY"); dodgeUntil.current = 0;
  };

  const beginMission = () => {
    setMode("active"); setPhase(0); setStartedAt(Date.now()); setFeed("OPERATION LIVE · REACH THE LAUNCH DISTRICT");
  };

  const handleReachZone = (zone: number) => {
    if (phase === 0 && zone >= 1) { setPhase(1); setFeed("SUSPICIOUS ACTIVITY DETECTED · INVESTIGATE THE LAUNCH"); }
    if (phase === 2 && zone >= 2) { setPhase(3); setFeed("LIQUIDITY FACILITY BREACHED · DISABLE THE OPERATION"); }
  };

  const handleFire = (targetId?: string) => {
    const current = ammo[weaponId];
    if (mode !== "active" || reloading || current.magazine <= 0) {
      if (current.magazine <= 0 && !reloading) setFeed("MAGAZINE EMPTY · PRESS R TO RELOAD");
      return false;
    }
    setAmmo((previous) => ({ ...previous, [weaponId]: { ...previous[weaponId], magazine: previous[weaponId].magazine - 1 } }));
    if (!targetId) setFeed("ROUND EXPENDED · NO TARGET LOCK");
    return true;
  };

  const handleDamageEnemy = (id: string, amount: number) => {
    setEnemies((previous) => previous.map((enemy) => {
      if (enemy.id !== id || !enemy.alive) return enemy;
      const nextHealth = Math.max(0, enemy.health - amount);
      if (nextHealth === 0) { setFeed(`${ENEMIES[enemy.role].name} · THREAT ELIMINATED`); }
      else setFeed(`${ENEMIES[enemy.role].name} HIT · ${nextHealth} INTEGRITY`);
      return { ...enemy, health: nextHealth, alive: nextHealth > 0 };
    }));
  };

  const handlePlayerDamage = (amount: number, source: EnemyRole) => {
    if (Date.now() < dodgeUntil.current || mode !== "active") return;
    setDamageReceived((value) => value + amount);
    setHealth((previous) => {
      const nextHealth = Math.max(0, previous - amount);
      if (nextHealth === 0) { setMode("rugged"); setFeed(`YOU GOT RUGGED · ${ENEMIES[source].name} GOT THE LAST HIT`); }
      else if (source === "whale") setFeed("WHALE LOCKED ON · TAKE COVER");
      return nextHealth;
    });
  };

  const handleReload = () => {
    const current = ammo[weaponId];
    if (reloading || current.magazine >= weapon.magazineSize || current.reserve <= 0 || mode !== "active") return;
    setReloading(true); setFeed(`RELOADING ${weapon.name.toUpperCase()}`);
    window.setTimeout(() => {
      setAmmo((previous) => {
        const equipped = previous[weaponId];
        const loaded = Math.min(weapon.magazineSize - equipped.magazine, equipped.reserve);
        return { ...previous, [weaponId]: { magazine: equipped.magazine + loaded, reserve: equipped.reserve - loaded } };
      });
      setReloading(false); setFeed("WEAPON READY");
    }, weapon.reloadMs);
  };

  const handleDodge = () => { if (mode === "active") { dodgeUntil.current = Date.now() + 280; setFeed("EVADE WINDOW ACTIVE"); } };
  const handleWeaponInput = (number: 1 | 2 | 3) => {
    const nextWeapon = WEAPON_ORDER[number - 1];
    if (nextWeapon && mode === "active") { setWeaponId(nextWeapon); setReloading(false); setFeed(`${WEAPONS[nextWeapon].name.toUpperCase()} EQUIPPED`); }
  };

  const formattedTime = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;
  const healthTone = health <= 30 ? "bg-red-500" : "bg-lime-300";
  const lowHealth = health <= 30 && mode === "active";
  const missionStats = useMemo(() => [["Targets", `${enemiesEliminated}/${enemies.length}`], ["Time", formattedTime], ["Damage", damageReceived.toString()]], [damageReceived, enemies.length, enemiesEliminated, formattedTime]);

  return (
    <main className="user-experience min-h-screen pb-24 pt-4">
      <div className="mx-auto max-w-5xl px-3 sm:px-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div><p className="lime-kicker">Rugfire · operation 01</p><h1 className="mt-0.5 text-2xl font-black tracking-tight text-white sm:text-3xl">THE LAUNCH</h1></div>
          <div className="rounded-lg border border-white/10 bg-black/35 px-2.5 py-2 text-right"><p className="text-[8px] font-bold uppercase tracking-[0.16em] text-white/40">Mission time</p><p className="font-mono text-sm font-bold text-primary">{formattedTime}</p></div>
        </div>

        <div className="relative">
          <RugfireMission mode={mode} enemies={enemies} activeWave={activeWave} weapon={weapon} onFire={handleFire} onDamageEnemy={handleDamageEnemy} onPlayerDamage={handlePlayerDamage} onReachZone={handleReachZone} onWeaponInput={handleWeaponInput} onReloadInput={handleReload} onDodge={handleDodge} reloading={reloading} />
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between p-3 sm:p-5">
            <div className="w-36 rounded-lg border border-white/10 bg-black/65 p-2 backdrop-blur-md"><div className="mb-1 flex items-center justify-between text-[9px] font-bold tracking-wider text-white/65"><span className="flex items-center gap-1"><Shield className="h-3 w-3 text-primary" /> VITALS</span><span>{health}/100</span></div><div className="h-1.5 overflow-hidden bg-white/10"><div className={`h-full transition-all duration-300 ${healthTone}`} style={{ width: `${health}%` }} /></div></div>
            <div className="max-w-[58%] rounded-lg border border-primary/20 bg-black/65 px-3 py-2 text-right backdrop-blur-md"><p className="text-[8px] font-bold uppercase tracking-[0.15em] text-primary/75">Objective {phase + 1}/5</p><p className="mt-0.5 text-[10px] font-bold uppercase text-white">{objective}</p></div>
          </div>

          {mode === "active" ? <><div className="pointer-events-none absolute left-1/2 top-1/2 z-10 grid h-5 w-5 -translate-x-1/2 -translate-y-1/2 place-items-center"><Crosshair className="h-5 w-5 text-primary/90 drop-shadow-[0_0_6px_rgba(201,255,69,0.65)]" /></div><div className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-lg border border-white/10 bg-black/65 px-3 py-2 backdrop-blur-md sm:bottom-5 sm:left-5"><p className="text-[8px] font-bold uppercase tracking-[0.14em] text-white/45">{reloading ? "Reloading" : weapon.name}</p><p className="font-mono text-xl font-black text-white">{ammo[weaponId].magazine}<span className="text-xs text-white/45"> / {ammo[weaponId].reserve}</span></p></div><div className="pointer-events-none absolute bottom-3 right-3 z-10 rounded-lg border border-white/10 bg-black/65 px-3 py-2 text-right backdrop-blur-md sm:bottom-5 sm:right-5"><p className="text-[8px] font-bold uppercase tracking-[0.14em] text-white/45">Intel</p><p className="max-w-40 text-[9px] font-bold uppercase leading-tight text-primary">{feed}</p></div></> : null}
          {lowHealth ? <div className="pointer-events-none absolute inset-0 z-20 border-[10px] border-red-500/30 shadow-[inset_0_0_90px_rgba(255,35,35,0.38)]" /> : null}
          {mode === "briefing" ? <Briefing onStart={beginMission} /> : null}
          {mode === "rugged" ? <ResultScreen title="YOU GOT RUGGED" copy="The liquidity disappeared. Re-enter the operation and finish the hunt." action="Retry operation" onAction={retry} onExit={() => navigate("/")} rugged stats={missionStats} /> : null}
          {mode === "complete" ? <ResultScreen title="MISSION COMPLETE" copy="Mega Rugger has been neutralized. The Launch District is secure." action="Run again" onAction={retry} onExit={() => navigate("/")} stats={missionStats} /> : null}
        </div>

        <section className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {WEAPON_ORDER.map((id, index) => <button key={id} onClick={() => handleWeaponInput((index + 1) as 1 | 2 | 3)} disabled={mode !== "active"} className={`rounded-xl border px-2 py-2 text-left transition-all ${weaponId === id ? "border-primary/45 bg-primary/10" : "border-border bg-card/70 hover:border-white/25"} disabled:opacity-60`}><p className="text-[8px] font-black text-primary">0{index + 1}</p><p className="mt-0.5 truncate text-[10px] font-bold text-white">{WEAPONS[id].name}</p></button>)}
          <button onClick={handleReload} disabled={mode !== "active" || reloading} className="rounded-xl border border-border bg-card/70 px-2 py-2 text-left hover:border-primary/40 disabled:opacity-60"><p className="text-[8px] font-black text-primary">R</p><p className="mt-0.5 text-[10px] font-bold text-white">Reload</p></button>
          <button onClick={handleDodge} disabled={mode !== "active"} className="rounded-xl border border-border bg-card/70 px-2 py-2 text-left hover:border-primary/40 disabled:opacity-60"><p className="text-[8px] font-black text-primary">SPACE</p><p className="mt-0.5 text-[10px] font-bold text-white">Dodge</p></button>
          <div className="rounded-xl border border-border bg-card/70 px-2 py-2 text-left"><p className="text-[8px] font-black text-primary">STATUS</p><p className="mt-0.5 text-[10px] font-bold text-white">{mode === "active" ? "LIVE" : mode.toUpperCase()}</p></div>
        </section>
        <section className="mt-3 rounded-2xl border border-border bg-card/65 p-3"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Target className="h-4 w-4 text-primary" /><p className="text-xs font-bold text-white">Operator controls</p></div><p className="text-[9px] font-semibold text-muted-foreground">CLICK THE GAME TO LOCK MOUSE</p></div><p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">WASD to move · Mouse to look · Left click to fire · Right click to aim · Shift to sprint · Space to dodge · 1 / 2 / 3 to switch weapons · R to reload.</p></section>
      </div>
    </main>
  );
}

function Briefing({ onStart }: { onStart: () => void }) {
  return <div className="absolute inset-0 z-30 grid place-items-center bg-[#07090c]/55 p-4 backdrop-blur-[2px]"><div className="w-full max-w-md border border-white/15 bg-[#0b0e11]/95 p-5 shadow-2xl sm:p-7"><p className="lime-kicker">Mission briefing</p><h2 className="mt-2 text-3xl font-black text-white">OPERATION: THE LAUNCH</h2><div className="mt-5 border-l-2 border-primary/70 pl-3"><p className="text-xs font-bold uppercase tracking-wide text-primary">Locate the liquidity operation.</p><p className="mt-2 text-sm leading-relaxed text-white/60">A fictional token launch has triggered a suspicious liquidity drain in Meme City. Enter the district, clear the threat, and extract.</p></div><div className="mt-6 grid grid-cols-3 gap-2 text-center"><MissionTag icon={<Crosshair className="h-4 w-4" />} label="3 weapons" /><MissionTag icon={<Skull className="h-4 w-4" />} label="4 threats" /><MissionTag icon={<Zap className="h-4 w-4" />} label="1 boss" /></div><button onClick={onStart} className="mt-6 flex w-full items-center justify-center gap-2 bg-primary px-4 py-3 text-sm font-black text-primary-foreground transition hover:brightness-110 active:scale-[0.99]"><Crosshair className="h-4 w-4" /> ENTER OPERATION</button></div></div>;
}

function MissionTag({ icon, label }: { icon: ReactNode; label: string }) {
  return <div className="border border-white/10 bg-white/[0.035] px-2 py-3 text-primary"><div className="mx-auto grid w-fit place-items-center">{icon}</div><p className="mt-1 text-[9px] font-bold uppercase text-white/65">{label}</p></div>;
}

function ResultScreen({ title, copy, action, onAction, onExit, rugged = false, stats }: { title: string; copy: string; action: string; onAction: () => void; onExit: () => void; rugged?: boolean; stats: string[][] }) {
  return <div className="absolute inset-0 z-30 grid place-items-center bg-[#08090b]/80 p-4 backdrop-blur-sm"><div className={`w-full max-w-md border p-6 text-center shadow-2xl ${rugged ? "border-red-500/45 bg-[#190b0d]/95" : "border-primary/35 bg-[#10150b]/95"}`}><div className={`mx-auto grid h-12 w-12 place-items-center border ${rugged ? "border-red-400/50 text-red-400" : "border-primary/50 text-primary"}`}>{rugged ? <Skull className="h-6 w-6" /> : <Trophy className="h-6 w-6" />}</div><p className="lime-kicker mt-4">Rugfire mission report</p><h2 className="mt-2 text-3xl font-black text-white">{title}</h2><p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-white/60">{copy}</p><div className="mt-6 grid grid-cols-3 gap-2 border-y border-white/10 py-4">{stats.map(([label, value]) => <ReportStat key={label} label={label} value={value} />)}</div><button onClick={onAction} className="mt-5 flex w-full items-center justify-center gap-2 bg-primary py-3 text-sm font-black text-primary-foreground"><RotateCcw className="h-4 w-4" /> {action}</button><button onClick={onExit} className="mt-2 flex w-full items-center justify-center gap-2 border border-white/15 py-3 text-xs font-bold text-white/65"><Home className="h-4 w-4" /> Return to base</button></div></div>;
}

function ReportStat({ label, value }: { label: string; value: string }) { return <div><p className="text-[8px] font-bold uppercase tracking-wider text-white/40">{label}</p><p className="mt-1 text-xs font-black text-white">{value}</p></div>; }
