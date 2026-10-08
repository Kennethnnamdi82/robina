import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, Line } from "@react-three/drei";
import { forwardRef, useCallback, useEffect, useRef, useState, type ForwardedRef, type MutableRefObject } from "react";
import * as THREE from "three";
import { ENEMIES, type EnemyRole, type MissionEnemy, type WeaponDefinition } from "./gameData";

export type ActiveEnemy = MissionEnemy & { health: number; alive: boolean };

type RugfireMissionProps = {
  mode: "briefing" | "active" | "rugged" | "complete";
  enemies: ActiveEnemy[];
  activeWave: number;
  weapon: WeaponDefinition;
  onFire: (targetId?: string) => boolean;
  onDamageEnemy: (id: string, amount: number) => void;
  onPlayerDamage: (amount: number, source: EnemyRole) => void;
  onReachZone: (zone: number) => void;
  onWeaponInput: (weapon: 1 | 2 | 3) => void;
  onReloadInput: () => void;
  onDodge: () => void;
  reloading: boolean;
};

export default function RugfireMission(props: RugfireMissionProps) {
  return (
    <div className="relative h-[min(72vh,680px)] min-h-[520px] overflow-hidden rounded-[1.45rem] border border-white/10 bg-[#07090c] shadow-[0_24px_80px_rgba(0,0,0,0.52)]">
      <Canvas shadows dpr={[1, 1.5]} camera={{ fov: 58, near: 0.1, far: 120, position: [0, 4, 18] }}>
        <MissionScene {...props} />
      </Canvas>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/45 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/65 to-transparent" />
    </div>
  );
}

function MissionScene({ mode, enemies, activeWave, weapon, onFire, onDamageEnemy, onPlayerDamage, onReachZone, onWeaponInput, onReloadInput, onDodge, reloading }: RugfireMissionProps) {
  const playerPosition = useRef(new THREE.Vector3(0, 0.85, 12));
  const forward = useRef(new THREE.Vector3(0, 0, -1));
  const enemiesRef = useRef(enemies);
  const [shotPulse, setShotPulse] = useState(0);
  const [sniperAlert, setSniperAlert] = useState(false);
  const lastShot = useRef(0);

  useEffect(() => {
    enemiesRef.current = enemies;
  }, [enemies]);

  const shoot = useCallback(() => {
    if (mode !== "active" || reloading) return;
    const now = performance.now();
    if (now - lastShot.current < weapon.fireInterval) return;
    lastShot.current = now;

    const player = playerPosition.current;
    const target = enemiesRef.current
      .filter((enemy) => enemy.alive && enemy.wave <= activeWave)
      .map((enemy) => {
        const enemyPosition = new THREE.Vector3(...enemy.position);
        const direction = enemyPosition.sub(player).normalize();
        return { enemy, distance: player.distanceTo(new THREE.Vector3(...enemy.position)), alignment: direction.dot(forward.current) };
      })
      .filter((candidate) => candidate.distance <= weapon.range && candidate.alignment > 0.955)
      .sort((a, b) => b.alignment - a.alignment || a.distance - b.distance)[0];

    if (!onFire(target?.enemy.id)) return;
    setShotPulse((value) => value + 1);
    if (target) onDamageEnemy(target.enemy.id, weapon.damage);
  }, [activeWave, mode, onDamageEnemy, onFire, reloading, weapon]);

  return (
    <>
      <color attach="background" args={["#080a0d"]} />
      <fog attach="fog" args={["#080a0d", 23, 84]} />
      <ambientLight intensity={0.45} color="#b6c4d0" />
      <hemisphereLight intensity={0.5} color="#8ca6b7" groundColor="#121212" />
      <directionalLight castShadow position={[4, 12, 9]} intensity={1.6} color="#ffe3a4" shadow-mapSize={[1024, 1024]} />
      <pointLight position={[-7, 5, -17]} intensity={22} distance={17} color="#d2ff57" />
      <pointLight position={[8, 4, -33]} intensity={18} distance={16} color="#ff4e54" />

      <CityDistrict />
      {enemies.filter((enemy) => enemy.wave <= activeWave).map((enemy) => (
        <EnemyActor
          key={enemy.id}
          enemy={enemy}
          playerPosition={playerPosition}
          mode={mode}
          onAttack={(role) => {
            if (role === "whale") {
              setSniperAlert(true);
              window.setTimeout(() => setSniperAlert(false), 900);
            }
            onPlayerDamage(ENEMIES[role].damage, role);
          }}
        />
      ))}
      <PlayerController
        mode={mode}
        onShoot={shoot}
        playerPosition={playerPosition}
        forward={forward}
        onReachZone={onReachZone}
        onWeaponInput={onWeaponInput}
        onReloadInput={onReloadInput}
        onDodge={onDodge}
        shotPulse={shotPulse}
      />
      {sniperAlert ? <SniperBeam playerPosition={playerPosition} /> : null}
    </>
  );
}

function PlayerController({ mode, onShoot, playerPosition, forward, onReachZone, onWeaponInput, onReloadInput, onDodge, shotPulse }: {
  mode: RugfireMissionProps["mode"];
  onShoot: () => void;
  playerPosition: MutableRefObject<THREE.Vector3>;
  forward: MutableRefObject<THREE.Vector3>;
  onReachZone: (zone: number) => void;
  onWeaponInput: (weapon: 1 | 2 | 3) => void;
  onReloadInput: () => void;
  onDodge: () => void;
  shotPulse: number;
}) {
  const { camera, gl } = useThree();
  const operator = useRef<THREE.Group>(null);
  const keys = useRef(new Set<string>());
  const yaw = useRef(0);
  const pitch = useRef(-0.12);
  const aiming = useRef(false);
  const lastDodge = useRef(0);
  const lastTelemetry = useRef(0);
  const [muzzle, setMuzzle] = useState(false);

  useEffect(() => {
    const canvas = gl.domElement;
    const keyDown = (event: KeyboardEvent) => {
      keys.current.add(event.code);
      if (event.code === "KeyR") onReloadInput();
      if (event.code === "Digit1") onWeaponInput(1);
      if (event.code === "Digit2") onWeaponInput(2);
      if (event.code === "Digit3") onWeaponInput(3);
      if (event.code === "Space" && performance.now() - lastDodge.current > 950) {
        lastDodge.current = performance.now();
        onDodge();
      }
    };
    const keyUp = (event: KeyboardEvent) => keys.current.delete(event.code);
    const mouseMove = (event: MouseEvent) => {
      if (document.pointerLockElement !== canvas) return;
      yaw.current -= event.movementX * 0.0025;
      pitch.current = THREE.MathUtils.clamp(pitch.current - event.movementY * 0.0018, -0.5, 0.23);
    };
    const mouseDown = (event: MouseEvent) => {
      if (document.pointerLockElement !== canvas || mode !== "active") return;
      if (event.button === 0) onShoot();
      if (event.button === 2) aiming.current = true;
    };
    const mouseUp = (event: MouseEvent) => { if (event.button === 2) aiming.current = false; };
    const contextMenu = (event: MouseEvent) => event.preventDefault();
    const lock = () => { if (mode === "active") canvas.requestPointerLock(); };
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    window.addEventListener("mousemove", mouseMove);
    window.addEventListener("mousedown", mouseDown);
    window.addEventListener("mouseup", mouseUp);
    canvas.addEventListener("click", lock);
    canvas.addEventListener("contextmenu", contextMenu);
    return () => {
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("mousemove", mouseMove);
      window.removeEventListener("mousedown", mouseDown);
      window.removeEventListener("mouseup", mouseUp);
      canvas.removeEventListener("click", lock);
      canvas.removeEventListener("contextmenu", contextMenu);
    };
  }, [gl, mode, onDodge, onReloadInput, onShoot, onWeaponInput]);

  useEffect(() => {
    if (!shotPulse) return;
    setMuzzle(true);
    const timeout = window.setTimeout(() => setMuzzle(false), 55);
    return () => window.clearTimeout(timeout);
  }, [shotPulse]);

  useFrame((_, delta) => {
    const current = playerPosition.current;
    const planarForward = new THREE.Vector3(Math.sin(yaw.current), 0, -Math.cos(yaw.current)).normalize();
    forward.current.copy(planarForward);
    const right = new THREE.Vector3(planarForward.z, 0, -planarForward.x);
    const movement = new THREE.Vector3();
    if (mode === "active") {
      if (keys.current.has("KeyW")) movement.add(planarForward);
      if (keys.current.has("KeyS")) movement.sub(planarForward);
      if (keys.current.has("KeyD")) movement.add(right);
      if (keys.current.has("KeyA")) movement.sub(right);
      if (movement.lengthSq() > 0) {
        movement.normalize();
        const speed = keys.current.has("ShiftLeft") ? 7.6 : aiming.current ? 3.1 : 4.7;
        current.addScaledVector(movement, speed * delta);
        current.x = THREE.MathUtils.clamp(current.x, -11.5, 11.5);
        current.z = THREE.MathUtils.clamp(current.z, -57, 14);
        if (operator.current) operator.current.rotation.y = Math.atan2(movement.x, movement.z);
      }
      if (keys.current.has("Space") && performance.now() - lastDodge.current < 260) current.addScaledVector(planarForward, 10 * delta);
    }
    if (operator.current) operator.current.position.copy(current);
    const verticalLook = Math.sin(pitch.current);
    const cameraForward = new THREE.Vector3(planarForward.x * Math.cos(pitch.current), verticalLook, planarForward.z * Math.cos(pitch.current)).normalize();
    const distance = aiming.current ? 4.4 : 7.5;
    const desiredCamera = current.clone().add(new THREE.Vector3(0, 1.8, 0)).addScaledVector(cameraForward, -distance);
    camera.position.lerp(desiredCamera, 1 - Math.exp(-10 * delta));
    camera.lookAt(current.clone().add(new THREE.Vector3(0, 1.35, 0)).addScaledVector(cameraForward, 14));
    const perspectiveCamera = camera as THREE.PerspectiveCamera;
    const desiredFov = aiming.current ? 46 : 58;
    perspectiveCamera.fov = THREE.MathUtils.lerp(perspectiveCamera.fov, desiredFov, 1 - Math.exp(-9 * delta));
    perspectiveCamera.updateProjectionMatrix();
    if (performance.now() - lastTelemetry.current > 250) {
      lastTelemetry.current = performance.now();
      if (current.z < 4) onReachZone(1);
      if (current.z < -18) onReachZone(2);
      if (current.z < -36) onReachZone(3);
    }
  });

  return <Operator ref={operator} muzzle={muzzle} />;
}

const Operator = forwardRef(function Operator({ muzzle }: { muzzle: boolean }, ref: ForwardedRef<THREE.Group>) {
  return (
  <group ref={ref} position={[0, 0.85, 12]}>
    <mesh castShadow position={[0, 0.95, 0]}><capsuleGeometry args={[0.34, 0.9, 5, 10]} /><meshStandardMaterial color="#232b31" roughness={0.65} /></mesh>
    <mesh castShadow position={[0, 1.72, 0]}><sphereGeometry args={[0.27, 16, 16]} /><meshStandardMaterial color="#c5ad98" /></mesh>
    <mesh castShadow position={[0, 0.25, 0.02]}><boxGeometry args={[0.56, 0.72, 0.4]} /><meshStandardMaterial color="#151b1e" /></mesh>
    <mesh castShadow position={[0.36, 1.13, -0.22]} rotation={[0, 0, -0.3]}><boxGeometry args={[0.16, 0.16, 0.85]} /><meshStandardMaterial color="#b8c6c7" metalness={0.7} /></mesh>
    <mesh position={[0, 1.1, -0.15]}><boxGeometry args={[0.7, 0.38, 0.13]} /><meshStandardMaterial color="#c9ff45" emissive="#607c11" emissiveIntensity={0.6} /></mesh>
    {muzzle ? <pointLight position={[0.36, 1.13, -0.68]} intensity={9} distance={4} color="#fff3bb" /> : null}
  </group>
  );
});

function EnemyActor({ enemy, playerPosition, mode, onAttack }: { enemy: ActiveEnemy; playerPosition: MutableRefObject<THREE.Vector3>; mode: RugfireMissionProps["mode"]; onAttack: (role: EnemyRole) => void }) {
  const group = useRef<THREE.Group>(null);
  const lastAttack = useRef(0);
  const [flash, setFlash] = useState(false);
  const definition = ENEMIES[enemy.role];

  useFrame(({ clock }) => {
    if (!enemy.alive || mode !== "active" || !group.current) return;
    const ownPosition = group.current.position;
    const distance = ownPosition.distanceTo(playerPosition.current);
    group.current.lookAt(playerPosition.current.x, ownPosition.y, playerPosition.current.z);
    if (enemy.role === "kol") ownPosition.x += Math.sin(clock.elapsedTime * 2 + ownPosition.z) * 0.008;
    if (enemy.role === "rugger" && distance > 7) ownPosition.lerp(playerPosition.current.clone().setY(ownPosition.y), 0.0017);
    if (distance <= definition.range && performance.now() - lastAttack.current >= definition.cooldown) {
      lastAttack.current = performance.now();
      setFlash(true);
      window.setTimeout(() => setFlash(false), 75);
      onAttack(enemy.role);
    }
  });

  if (!enemy.alive) return null;
  const isBoss = enemy.role === "boss";
  const scale = isBoss ? 1.55 : enemy.role === "rugger" ? 1.18 : 1;
  const health = Math.max(0, enemy.health / definition.health);
  return (
    <group ref={group} position={enemy.position} scale={scale}>
      <mesh castShadow position={[0, 0.9, 0]}><capsuleGeometry args={[0.36, 0.95, 5, 10]} /><meshStandardMaterial color={isBoss ? "#361317" : "#242126"} roughness={0.68} /></mesh>
      <mesh castShadow position={[0, 1.68, 0]}><sphereGeometry args={[0.28, 16, 16]} /><meshStandardMaterial color="#bb907c" /></mesh>
      <mesh castShadow position={[0.38, 1.08, -0.25]} rotation={[0, 0, -0.25]}><boxGeometry args={[0.14, 0.15, isBoss ? 1.05 : 0.8]} /><meshStandardMaterial color="#11181c" metalness={0.65} /></mesh>
      <mesh position={[0, 1.07, -0.22]}><boxGeometry args={[0.73, 0.28, 0.1]} /><meshStandardMaterial color={definition.color} emissive={definition.color} emissiveIntensity={0.75} /></mesh>
      {flash ? <pointLight position={[0.36, 1.1, -0.75]} intensity={8} distance={3} color="#ff8c61" /> : null}
      <Html position={[0, isBoss ? 2.6 : 2.05, 0]} center distanceFactor={11} style={{ pointerEvents: "none" }}>
        <div className={`w-24 ${isBoss ? "w-36" : ""} text-center font-sans`}>
          <div className="border border-red-400/35 bg-black/80 px-1.5 py-1 text-[7px] font-black tracking-[0.14em] text-red-200">{definition.name}</div>
          <div className="mt-0.5 h-1 overflow-hidden border border-white/10 bg-black/75"><div className="h-full bg-red-500" style={{ width: `${health * 100}%` }} /></div>
          <div className="mt-0.5 text-[6px] font-bold tracking-wider text-white/55">{definition.token} · {definition.threat}</div>
        </div>
      </Html>
    </group>
  );
}

function SniperBeam({ playerPosition }: { playerPosition: MutableRefObject<THREE.Vector3> }) {
  return <Line points={[[7.5, 4.1, -34], [playerPosition.current.x, playerPosition.current.y + 0.7, playerPosition.current.z]]} color="#d38cff" lineWidth={1.2} transparent opacity={0.8} />;
}

function CityDistrict() {
  const buildings: Array<[number, number, number, number, number, number, string]> = [
    [-9, 6, 4, 5, 12, 8, "#1c2228"], [9, 7, 1, 5, 14, 10, "#171d22"], [-8, 7, -18, 5, 14, 8, "#1a1e20"], [8, 8, -23, 5, 16, 9, "#20242a"], [-8, 6, -43, 5, 12, 8, "#1b2025"], [8, 8, -47, 5, 16, 9, "#1b2025"],
  ];
  const covers: Array<[number, number, number, number, number, number]> = [
    [-2.8, 0.75, 3, 2.1, 1.5, 0.7], [3.2, 0.75, -5, 2.4, 1.5, 0.75], [-3.6, 0.75, -15, 1.8, 1.5, 0.8], [2.5, 0.75, -21, 2.1, 1.5, 0.75], [-2.4, 0.75, -31, 2.2, 1.5, 0.8], [4, 0.75, -40, 2.6, 1.5, 0.8], [-4.2, 0.75, -47, 2.1, 1.5, 0.8], [4, 0.75, -52, 2.8, 1.5, 0.8],
  ];
  return (
    <group>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -23]}><planeGeometry args={[28, 90]} /><meshStandardMaterial color="#25272a" roughness={0.93} /></mesh>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, -23]}><planeGeometry args={[9.2, 90]} /><meshStandardMaterial color="#151719" roughness={0.88} /></mesh>
      {[-2, -10, -18, -26, -34, -42, -50].map((z) => <mesh key={z} position={[0, 0.025, z]}><boxGeometry args={[0.22, 0.03, 3.1]} /><meshBasicMaterial color="#cf9f45" /></mesh>)}
      {buildings.map(([x, y, z, width, height, depth, color], index) => <mesh castShadow receiveShadow key={index} position={[x, y, z]}><boxGeometry args={[width, height, depth]} /><meshStandardMaterial color={color} roughness={0.82} metalness={0.2} /></mesh>)}
      {covers.map(([x, y, z, width, height, depth], index) => <group key={index} position={[x, y, z]}><mesh castShadow receiveShadow><boxGeometry args={[width, height, depth]} /><meshStandardMaterial color="#53575a" roughness={0.85} /></mesh><mesh position={[0, 0.62, depth / 2 + 0.012]}><planeGeometry args={[width * 0.76, 0.24]} /><meshBasicMaterial color="#c9ff45" /></mesh></group>)}
      <LaunchBillboard position={[-6.2, 4, -9]} text="$MOONPUG\nLAUNCHING NOW" color="#c9ff45" />
      <LaunchBillboard position={[6.2, 4, -27]} text="APY 10,000%\nTRUST THE HYPE" color="#ff515c" />
      <LaunchBillboard position={[-6.1, 4, -39]} text="LIQUIDITY\nFACILITY" color="#ffbd4a" />
      {[-4, -19, -35, -49].map((z, index) => <group key={z} position={[index % 2 ? 5.7 : -5.7, 0, z]}><mesh position={[0, 3, 0]}><cylinderGeometry args={[0.08, 0.12, 6, 8]} /><meshStandardMaterial color="#30373c" metalness={0.6} /></mesh><pointLight position={[0, 5.7, 0]} intensity={7} distance={11} color="#ffca7b" /></group>)}
    </group>
  );
}

function LaunchBillboard({ position, text, color }: { position: [number, number, number]; text: string; color: string }) {
  return <group position={position} rotation={[0, position[0] > 0 ? -0.35 : 0.35, 0]}><mesh><boxGeometry args={[3.8, 2.1, 0.14]} /><meshStandardMaterial color="#111519" metalness={0.5} /></mesh><Html transform center distanceFactor={12} position={[0, 0, 0.09]}><div className="w-28 whitespace-pre-line border border-white/10 bg-black/85 px-2 py-2 text-center font-sans text-[9px] font-black leading-tight tracking-wider" style={{ color }}>{text}</div></Html></group>;
}
