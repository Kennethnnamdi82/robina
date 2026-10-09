import * as T from 'three';
import { createActor, equipActor, animateActor, mountActor, disposeActor, type Actor } from './actors';
import { MissionAssets, disposeObject } from './assets';
import { DistrictArt } from './environment';
import { districtSky } from './atmosphere';
import { CombatAudio } from './audio';
import { CombatEffects } from './effects';
import { GameInput } from './input';
import { ENEMIES, MISSION, OBJECTIVES, WEAPON_ORDER, type EnemyRole, type WeaponId } from './gameData';
import { moveBody, obstacleDistance } from './physics';
import { MissionRuntime } from './runtime';
import { createDistrict, type District } from './world';

export type EnemyActor = { id: string; role: EnemyRole; stage: number; hp: number; actor: Actor; home: T.Vector3; cooldown: number; warning: number; target: T.Vector3; hit: number; speed: number; engaged: boolean; visible: boolean; side: number; think: number; direction: T.Vector3 };
type Projectile = { mesh: T.Mesh; velocity: T.Vector3; life: number; damage: number; role: EnemyRole };
type Hazard = { mesh: T.Mesh; age: number; active: boolean };
export type HudSnapshot = {
  assetsReady: boolean; assetsProgress: number;
  mode: MissionRuntime['mode']; stage: number; objective: string; health: number; ammo: number; reserve: number; weaponId: WeaponId;
  reload: number; dodge: number; hit: boolean; kill: boolean; damage: number; damageAngle: number; aiming: boolean; covered: boolean;
  bearing: number; time: number; kills: number; shots: number; hits: number; damageReceived: number; feed: string; cause: string; muted: boolean;
  bossHealth: number | null; bossPhase: string; sniper: boolean; interact: string; distance: number;
  targets: { id: string; x: number; y: number; name: string; threat: string; hp: number; warning: boolean }[];
  map: { player: [number, number]; enemies: [number, number][]; target: [number, number] };
  rewards: { xp: number; credits: number; item: string };
};
export class RugfireEngine {
  readonly assets = new MissionAssets(); readonly ready: Promise<void>;
  private assetsReady = false; private assetsProgress = 0; private art?: DistrictArt;
  readonly runtime = new MissionRuntime();
  readonly scene = new T.Scene(); readonly camera = new T.PerspectiveCamera(56, 1, .06, 180);
  readonly audio = new CombatAudio(); readonly effects = new CombatEffects();
  readonly world: District; readonly player = createActor('player'); readonly input: GameInput;
  readonly renderer: T.WebGLRenderer; enemies: EnemyActor[] = [];
  private accumulator = 0; private lastRender = 0; private lightUpdate = 0; private qualityUpdate = 0; private frameAverage = 1 / 60; private failed = false; private startEpoch = 0; private lastPublishedMode: MissionRuntime['mode'] = 'briefing';
  private resize: ResizeObserver; private animation = 0; private disposed = false; private last = 0; private hudTime = 0;
  private yaw = 0; private pitch = -.04; private aimBlend = 0; private velocity = new T.Vector3(); private dodgeDirection = new T.Vector3();
  private vectors = Array.from({ length: 12 }, () => new T.Vector3()); private ray = new T.Ray(); private bounds = new T.Box3(); private playerSphere = new T.Sphere();
  private projectiles: Projectile[] = []; private projectileCursor = 0; private hazards: Hazard[] = [];
  private reportSent = false; private reinforcement = false; private hazardCooldown = 3; private footstep = 0; private heartbeat = 0; private damageAngle = 0; private nearCover = false;
  private interact = ''; private target = new T.Vector3(0, 0, 4);
  constructor(private host: HTMLElement, private onHud: (snapshot: HudSnapshot) => void, private onError: (message: string) => void) {
    try {
    this.renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = T.PCFShadowMap;
    this.renderer.toneMapping = T.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.15; this.renderer.outputColorSpace = T.SRGBColorSpace;
    host.appendChild(this.renderer.domElement); this.renderer.domElement.setAttribute('aria-label', 'RUGFIRE third-person combat world');
    districtSky(this.scene);
    this.scene.add(new T.HemisphereLight(0xbacbd6, 0x5b5344, 1.45));
    const sun = new T.DirectionalLight(0xe5cdb0, 2.1); sun.position.set(-15, 28, 12); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -24; sun.shadow.camera.right = 24; sun.shadow.camera.top = 34; sun.shadow.camera.bottom = -34;
    sun.shadow.camera.far = 110; sun.shadow.bias = -.0005; sun.shadow.normalBias = .035; this.scene.add(sun, sun.target);
    sun.target.position.set(0, 0, -27);
    const rim = new T.DirectionalLight(0x9bbacb, 1.1); rim.position.set(12, 9, -45); this.scene.add(rim);
    this.world = createDistrict(); this.scene.add(this.world.root, this.player.root, this.effects.root);
    this.player.root.position.set(0, 0, 12); equipActor(this.player, 'rifle');
    for (const def of MISSION.enemies) this.spawn(def.id, def.role, def.x, def.y, def.z, def.stage);
    const projectileGeometry = new T.SphereGeometry(.045, 5, 4), projectileMaterial = new T.MeshBasicMaterial({ color: 0xffa66e });
    for (let i = 0; i < 64; i++) { const mesh = new T.Mesh(projectileGeometry, projectileMaterial); mesh.visible = false; this.scene.add(mesh); this.projectiles.push({ mesh, velocity: new T.Vector3(), life: 0, damage: 0, role: 'kol' }); }
    for (let i = 0; i < 3; i++) {
      const mesh = new T.Mesh(new T.RingGeometry(.05, 2.8, 48), new T.MeshBasicMaterial({ color: 0xc4663c, transparent: true, opacity: .2, side: T.DoubleSide }));
      mesh.rotation.x = -Math.PI / 2; mesh.visible = false; this.scene.add(mesh); this.hazards.push({ mesh, age: 0, active: false });
    }
    this.input = new GameInput(this.renderer.domElement, () => this.pause());
    this.renderer.domElement.addEventListener('webglcontextlost', this.contextLost);
    this.resize = new ResizeObserver(() => this.resizeView()); this.resize.observe(host); this.resizeView();
    this.camera.position.set(1, 3.2, 18); this.camera.lookAt(0, 1.4, -5); this.publish(); this.animation = requestAnimationFrame(this.frame);
    this.ready = this.prepareAssets();
    } catch (error) { this.dispose(); throw error; }
  }
  private async prepareAssets() {
    try {
      await this.assets.load((loaded, total) => { if (!this.disposed) { this.assetsProgress = loaded / total; this.publish(); } });
      if (this.disposed) return;
      mountActor(this.player, this.assets);
      this.enemies.forEach(enemy => mountActor(enemy.actor, this.assets));
      this.art = new DistrictArt(this.assets, this.world);
      this.assetsReady = true; this.publish();
    } catch (error) {
      if (!this.disposed) { this.failed = true; this.assets.dispose(); this.onError('Mission assets could not be prepared. Check your connection and restart graphics. ' + (error instanceof Error ? error.message : '')); }
    }
  }
  private contextLost = (event: Event) => { event.preventDefault(); this.failed = true; this.pause(); this.onError('Graphics context lost. Reload the page to restore the operation.'); };
  private resizeView() { const w = this.host.clientWidth, h = this.host.clientHeight; if (!w || !h) return; this.renderer.setSize(w, h); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  private spawn(id: string, role: EnemyRole, x: number, y: number, z: number, stage: number) {
    const actor = createActor(role); actor.root.position.set(x, y, z); actor.root.visible = false; this.scene.add(actor.root);
    if (this.assetsReady) mountActor(actor, this.assets);
    this.enemies.push({ id, role, stage, hp: ENEMIES[role].health, actor, home: new T.Vector3(x, y, z), cooldown: 1.3 + this.enemies.length * .21, warning: 0, target: new T.Vector3(), hit: 0, speed: 0, engaged: false, visible: false, side: this.enemies.length % 2 ? 1 : -1, think: 0, direction: new T.Vector3() });
  }
  async start() {
    if (this.disposed || this.failed || !this.assetsReady || (this.runtime.mode !== 'briefing' && this.runtime.mode !== 'paused')) return;
    const epoch = ++this.startEpoch; let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const lock = this.input.lock().then(() => { if (this.disposed || epoch !== this.startEpoch) this.input.release(); });
      await Promise.race([lock, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Mouse capture timed out')), 3000); })]);
      if (this.disposed || epoch !== this.startEpoch) return;
      if (document.pointerLockElement !== this.renderer.domElement) throw new Error('Pointer lock unavailable');
      this.runtime.mode = 'active'; if (this.runtime.stage === 0) this.runtime.stage = 1;
      this.runtime.notify('OPERATION LIVE / HOSTILES IN THE STREET'); this.input.clear(); this.last = 0; this.publish();
      void this.audio.unlock().then(available => { if (this.disposed) return; if (epoch !== this.startEpoch || this.runtime.mode !== 'active') { if (this.runtime.mode !== 'active') this.audio.suspend(); return; } if (!available) { this.runtime.notify('AUDIO UNAVAILABLE / OPERATION READY'); this.publish(); } });
    } catch {
      if (this.disposed || epoch !== this.startEpoch) return;
      this.startEpoch++; this.input.release(); this.audio.suspend();
      this.onError('Mouse capture was blocked. Use a desktop browser and click Enter operation again.');
    } finally { if (timer) clearTimeout(timer); }
  }
  pause() { if (this.runtime.mode !== 'active') return; this.runtime.mode = 'paused'; this.input.release(); this.audio.suspend(); this.publish(); }
  toggleMute() { this.audio.toggle(); this.publish(); }
  setWeapon(id: WeaponId) { this.runtime.switchWeapon(id); equipActor(this.player, this.runtime.weaponId); }
  reload() { if (this.runtime.reload()) this.audio.reload(); }
  dodge() {
    if (!this.runtime.dodge()) return;
    this.dodgeDirection.copy(this.velocity);
    if (this.dodgeDirection.lengthSq() < .01) this.dodgeDirection.set(Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this.dodgeDirection.normalize(); this.audio.tone(120, .15, .08);
  }
  private frame = (timestamp: number) => {
    if (this.disposed || this.failed) return;
    try {
      const elapsed = this.last ? Math.min((timestamp - this.last) / 1000, .25) : 1 / 60; this.last = timestamp;
      if (this.runtime.mode === 'active') {
        this.accumulator = Math.min(this.accumulator + elapsed, .1);
        while (this.accumulator >= 1 / 60 && this.runtime.mode === 'active') {
          const dt = 1 / 60; this.accumulator -= dt;
          this.runtime.tick(dt); this.updatePlayer(dt); this.updateEnemies(dt); this.updateProjectiles(dt); this.updateMission(); this.updateBoss(dt);
        }
        if ((this.runtime.mode as MissionRuntime['mode']) === 'rugged' || (this.runtime.mode as MissionRuntime['mode']) === 'complete') {
          this.input.release(); this.audio.suspend();
          if (!this.reportSent) { this.reportSent = true; window.dispatchEvent(new CustomEvent('rugfire:mission-report', { detail: { missionId: MISSION.id, ...this.snapshot() } })); }
        }
      } else this.accumulator = 0;
      // Menus do not need continuous expensive world rendering.
      const render = this.runtime.mode === 'active' || timestamp - this.lastRender > 160;
      if (render && !document.hidden) {
        const dt = Math.min(elapsed, .1); this.updateCamera(dt); this.effects.update(dt); this.art?.update(timestamp / 1000);
        animateActor(this.player, dt, this.runtime.mode === 'active' ? this.velocity.length() : 0, this.runtime.time, this.runtime.reloadLeft ? 1 - this.runtime.reloadLeft / (this.runtime.weapon.reloadMs / 1000) : 0, this.runtime.dodgeLeft / .38, this.runtime.damagePulse, this.runtime.mode === 'rugged');
        if (!this.runtime.dodgeLeft && this.runtime.mode !== 'rugged') this.player.torso.rotation.x -= this.pitch * .65;
        for (const enemy of this.enemies) {
          enemy.actor.root.visible = enemy.stage <= Math.max(1, this.runtime.stage) && enemy.actor.root.position.distanceToSquared(this.player.root.position) < 3600;
          if (enemy.actor.root.visible) animateActor(enemy.actor, dt, this.runtime.mode === 'active' ? enemy.speed : 0, this.runtime.time, 0, 0, enemy.hit, enemy.hp <= 0);
        }
        if (timestamp - this.lightUpdate > 250) {
          this.lightUpdate = timestamp;
          this.world.lights.sort((a, b) => a.position.distanceToSquared(this.player.root.position) - b.position.distanceToSquared(this.player.root.position));
          this.world.lights.forEach((light, index) => { light.visible = index < 4; });
        }
        this.world.beacon.visible = this.runtime.stage === 6; this.world.beacon.scale.setScalar(1 + Math.sin(this.runtime.time * 2) * .05);
        this.renderer.render(this.scene, this.camera); this.lastRender = timestamp;
        if (this.runtime.mode === 'active') {
          this.frameAverage = this.frameAverage * .95 + elapsed * .05;
          if (timestamp - this.qualityUpdate > 2500 && this.frameAverage > 1 / 32) {
            const current = this.renderer.getPixelRatio(), minimum = Math.min(window.devicePixelRatio || 1, .75);
            if (current > minimum) this.renderer.setPixelRatio(Math.max(minimum, current * .85));
            this.qualityUpdate = timestamp;
          }
        }
      }
      this.hudTime += elapsed;
      if (this.hudTime > .08 && this.runtime.mode === 'active') { this.hudTime = 0; this.publish(); }
      if (this.runtime.mode !== this.lastPublishedMode) this.publish();
      this.animation = requestAnimationFrame(this.frame);
    } catch (error) {
      this.failed = true; this.runtime.mode = 'paused'; this.input.release(); this.audio.suspend();
      console.error('[rugfire]', error); this.publish(); this.onError('The operation stopped safely. Restart the graphics to continue.');
    }
  };
  private updatePlayer(dt: number) {
    const r = this.runtime, input = this.input;
    this.yaw += input.mouseX * (input.aim ? .0015 : .0023); this.pitch = T.MathUtils.clamp(this.pitch - input.mouseY * .0018, -.6, .65); input.mouseX = input.mouseY = 0;
    for (let i = 0; i < 3; i++) if (input.consume('Digit' + (i + 1))) this.setWeapon(WEAPON_ORDER[i]);
    if (input.consume('KeyR')) this.reload(); if (input.consume('Space')) this.dodge();
    const forward = this.vectors[0].set(Math.sin(this.yaw), 0, -Math.cos(this.yaw)), right = this.vectors[1].set(Math.cos(this.yaw), 0, Math.sin(this.yaw)), move = this.vectors[2].set(0, 0, 0);
    if (input.keys.has('KeyW')) move.add(forward); if (input.keys.has('KeyS')) move.sub(forward);
    if (input.keys.has('KeyD')) move.add(right); if (input.keys.has('KeyA')) move.sub(right);
    const speed = input.aim ? 2.5 : input.keys.has('ShiftLeft') ? 7.1 : 4.3;
    if (move.lengthSq()) move.normalize().multiplyScalar(speed);
    this.velocity.lerp(move, 1 - Math.exp(-dt * 16));
    if (r.dodgeLeft > 0) moveBody(this.player.root.position, this.dodgeDirection.x * dt * 12, this.dodgeDirection.z * dt * 12, this.world.colliders);
    else moveBody(this.player.root.position, this.velocity.x * dt, this.velocity.z * dt, this.world.colliders);
    this.player.root.rotation.y = -this.yaw;
    this.player.move = input.keys.has('KeyS') ? 'Back' : input.keys.has('KeyA') ? 'Left' : input.keys.has('KeyD') ? 'Right' : 'Walk';
    this.player.reloadTime = r.weapon.reloadMs / 1000;
    for (const supply of this.art?.supplies || []) if (!supply.taken && supply.mesh.position.distanceTo(this.player.root.position) < 1.25) {
      supply.taken = true; supply.mesh.visible = false;
      if (supply.kind === 'health') r.health = Math.min(100, r.health + 40);
      else for (const id of WEAPON_ORDER) r.ammo[id].reserve += id === 'pistol' ? 24 : 60;
      r.notify(supply.kind === 'health' ? 'FIELD MEDKIT / HEALTH RESTORED' : 'AMMUNITION RECOVERED'); this.audio.tone(540, .12, .08);
    }
    this.footstep += dt; if (this.velocity.length() > 1 && this.footstep > (speed > 6 ? .24 : .36)) { this.audio.footstep(); this.footstep = 0; }
    this.heartbeat += dt; if (r.health < 30 && this.heartbeat > .85) { this.audio.tone(45, .16, .14); this.heartbeat = 0; }
    if ((input.fire && r.weapon.automatic) || input.firePressed) this.shoot(); input.firePressed = false;
    if (input.consume('KeyE') && this.interact && r.stage === 4) {
      r.stage = 5; r.supply(); r.notify('LIQUIDITY DRAIN ISOLATED / MEGA RUGGER INBOUND', 4); this.audio.tone(400, .35, .16);
    }
  }
  private updateCamera(dt: number) {
    this.aimBlend = T.MathUtils.damp(this.aimBlend, this.input.aim ? 1 : 0, 12, dt);
    const eye = this.vectors[0].copy(this.player.root.position).add(this.vectors[1].set(0, 1.45, 0));
    const forward = this.vectors[2].set(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
    const right = this.vectors[3].set(Math.cos(this.yaw), 0, Math.sin(this.yaw));
    const desired = this.vectors[4].copy(eye).addScaledVector(forward, -T.MathUtils.lerp(5.6, 3.15, this.aimBlend)).addScaledVector(right, T.MathUtils.lerp(.85, .6, this.aimBlend)); desired.y += T.MathUtils.lerp(.9, .2, this.aimBlend);
    const direction = this.vectors[5].subVectors(desired, eye).normalize(), distance = obstacleDistance(eye, direction, this.world.colliders, eye.distanceTo(desired), true);
    desired.copy(eye).addScaledVector(direction, Math.max(.12, distance - .18)); this.camera.position.lerp(desired, 1 - Math.exp(-dt * 16));
    direction.subVectors(this.camera.position, eye).normalize();
    const safe = obstacleDistance(eye, direction, this.world.colliders, eye.distanceTo(this.camera.position), true);
    if (safe < eye.distanceTo(this.camera.position)) this.camera.position.copy(eye).addScaledVector(direction, Math.max(.12, safe - .18));
    const look = this.vectors[6].copy(eye).addScaledVector(forward, 40).addScaledVector(right, .3);
    this.camera.lookAt(look); const fov = this.input.aim ? 47 : this.input.keys.has('ShiftLeft') ? 61 : 56;
    this.camera.fov = T.MathUtils.damp(this.camera.fov, fov, 9, dt); this.camera.updateProjectionMatrix(); this.camera.updateMatrixWorld();
  }
  private shoot() {
    const r = this.runtime; if (!r.fire()) return;
    const origin = this.vectors[0].copy(this.camera.position), direction = this.vectors[1]; this.camera.getWorldDirection(direction);
    const spread = r.weapon.spread * (this.input.aim ? .25 : 1) * (this.velocity.length() > 1 ? 1.5 : 1);
    direction.x += (Math.random() - .5) * spread; direction.y += (Math.random() - .5) * spread; direction.normalize();
    let distance = obstacleDistance(origin, direction, this.world.colliders, r.weapon.range), target: EnemyActor | null = null;
    this.ray.set(origin, direction);
    for (const enemy of this.enemies) {
      if (enemy.hp <= 0 || enemy.stage > r.stage || r.stage === 6) continue;
      const pos = enemy.actor.root.position, scale = enemy.actor.root.scale.x;
      this.bounds.min.set(pos.x - .43 * scale, pos.y + .1, pos.z - .4 * scale); this.bounds.max.set(pos.x + .43 * scale, pos.y + 1.9 * scale, pos.z + .4 * scale);
      if (this.ray.intersectBox(this.bounds, this.vectors[2])) { const d = origin.distanceTo(this.vectors[2]); if (d < distance) { target = enemy; distance = d; } }
    }
    const end = this.vectors[3].copy(origin).addScaledVector(direction, distance), muzzle = this.vectors[4];
    this.player.root.updateMatrixWorld(true); this.player.muzzle.getWorldPosition(muzzle);
    direction.subVectors(end, muzzle).normalize();
    const muzzleDistance = obstacleDistance(muzzle, direction, this.world.colliders, muzzle.distanceTo(end));
    if (muzzleDistance + .05 < muzzle.distanceTo(end)) { end.copy(muzzle).addScaledVector(direction, muzzleDistance); target = null; }
    this.effects.flash(muzzle); this.effects.tracer(muzzle, end); this.effects.impact(end, !!target);
    this.effects.shell(muzzle, this.vectors[5].set(Math.cos(this.yaw), 0, Math.sin(this.yaw)));
    this.player.recoil = 1; this.pitch = Math.min(.65, this.pitch + r.weapon.recoil * (this.input.aim ? .6 : 1)); this.audio.shot(r.weaponId);
    if (target) {
      const headshot = end.y > target.actor.root.position.y + 1.5 * target.actor.root.scale.x;
      target.hp = Math.max(0, target.hp - r.weapon.damage * (headshot ? 1.6 : 1)); target.hit = .28; target.engaged = true; r.hits++; r.hitPulse = .13;
      if (target.hp === 0) { target.warning = 0; target.speed = 0; r.kill(target.role); }
      this.audio.hit(target.hp <= 0);
    }
  }
  private updateEnemies(dt: number) {
    const r = this.runtime; this.nearCover = false;
    if (r.stage === 6 || r.mode !== 'active') return;
    for (const enemy of this.enemies) {
      if (enemy.hp <= 0 || enemy.stage > r.stage) continue;
      const def = ENEMIES[enemy.role], position = enemy.actor.root.position, player = this.player.root.position;
      enemy.hit = Math.max(0, enemy.hit - dt); enemy.cooldown -= dt; enemy.think -= dt;
      const distance = position.distanceTo(player);
      if (distance < def.range + 9) enemy.engaged = true;
      if (enemy.think <= 0) {
        enemy.think = .12;
        const source = this.vectors[0].copy(position); source.y += 1.25 * enemy.actor.root.scale.x;
        const endpoint = this.vectors[1].copy(player); endpoint.y += 1.1;
        const direction = this.vectors[2].subVectors(endpoint, source).normalize();
        const visible = obstacleDistance(source, direction, this.world.colliders, source.distanceTo(endpoint)) > source.distanceTo(endpoint) - .1;
        enemy.visible = visible;
        enemy.direction.set(0, 0, 0);
        if (!enemy.engaged) {
          enemy.direction.set(Math.sin(r.time * .7 + enemy.home.z), 0, 0).multiplyScalar(.3);
        } else {
          enemy.actor.root.rotation.y = Math.atan2(position.x - player.x, position.z - player.z);
          const planar = this.vectors[3].subVectors(player, position).setY(0).normalize();
          if (enemy.role === 'rugger' || enemy.role === 'boss') {
            if (distance > (enemy.role === 'boss' ? 10 : 6) || !visible) enemy.direction.copy(planar);
          } else if (enemy.role === 'kol') {
            enemy.direction.set(planar.z * enemy.side, 0, -planar.x * enemy.side).multiplyScalar(.7);
            if (distance > 17 || !visible) enemy.direction.addScaledVector(planar, .8);
            if (distance < 9 || enemy.hp < def.health * .3) enemy.direction.addScaledVector(planar, -1);
          } else {
            if (distance < 16 && Math.abs(position.x - enemy.home.x) < 1.2) enemy.direction.set(enemy.side, 0, 0);
            else if (enemy.cooldown > 2) enemy.direction.set(Math.sin(r.time * .8) * .3, 0, 0);
          }
          if (enemy.direction.lengthSq()) enemy.direction.normalize();
          if (visible && distance < def.range && enemy.cooldown <= 0 && enemy.warning <= 0) {
            enemy.warning = def.telegraph * (enemy.role === 'boss' && enemy.hp < def.health * .2 ? .7 : 1);
            enemy.target.copy(endpoint); enemy.cooldown = def.cooldown; if (enemy.role === 'whale') r.notify('WHALE LOCKED ON / DODGE OR BREAK SIGHTLINE', 1.8);
          }
        }
      }
      if (enemy.warning > 0) {
        enemy.warning -= dt; enemy.direction.multiplyScalar(.85); if (enemy.role === 'whale') { enemy.actor.muzzle.getWorldPosition(this.vectors[6]); this.effects.tracer(this.vectors[6], enemy.target, true); }
        if (enemy.warning <= 0) this.enemyShot(enemy);
      }
      if (!enemy.visible && enemy.engaged && distance < def.range) this.nearCover = true;
      const dx = enemy.direction.x * def.speed * dt, dz = enemy.direction.z * def.speed * dt;
      const oldX = position.x, oldZ = position.z;
      if (enemy.role === 'whale') position.x = T.MathUtils.clamp(position.x + dx, 6.7, 9.1);
      else moveBody(position, dx, dz, this.world.colliders, enemy.role === 'boss' ? .6 : .36);
      const moved = Math.hypot(oldX - position.x, oldZ - position.z);
      enemy.speed = moved / dt;
      if (moved < .005 && enemy.direction.lengthSq() > .2) { enemy.side *= -1; moveBody(position, enemy.side * dt * def.speed, 0, this.world.colliders); }
      if (enemy.role !== 'boss' && Math.abs(position.z - enemy.home.z) > 12) position.z = T.MathUtils.clamp(position.z, enemy.home.z - 12, enemy.home.z + 12);
    }
  }
  private enemyShot(enemy: EnemyActor) {
    if (this.runtime.mode !== 'active' || enemy.hp <= 0) return;
    const count = enemy.role === 'boss' ? (enemy.hp < ENEMIES.boss.health * .2 ? 5 : 3) : 1;
    enemy.actor.root.updateMatrixWorld(true); enemy.actor.muzzle.getWorldPosition(this.vectors[0]); enemy.actor.recoil = 1; this.effects.flash(this.vectors[0]);
    const relative = this.vectors[1].subVectors(enemy.actor.root.position, this.player.root.position);
    this.audio.shot('enemy', (relative.x * Math.cos(this.yaw) + relative.z * Math.sin(this.yaw)) / 16, relative.length());
    for (let i = 0; i < count; i++) {
      const projectile = this.projectiles[this.projectileCursor++ % this.projectiles.length]; projectile.mesh.position.copy(this.vectors[0]);
      projectile.velocity.subVectors(enemy.target, this.vectors[0]); projectile.velocity.x += (i - (count - 1) / 2) * .7;
      // Deliberate aim error creates readable pressure rather than unavoidable hits.
      if (enemy.role !== 'whale') projectile.velocity.x += (Math.random() - .5) * 1.8;
      projectile.velocity.normalize().multiplyScalar(enemy.role === 'whale' ? 48 : 24);
      projectile.life = 3; projectile.damage = ENEMIES[enemy.role].damage; projectile.role = enemy.role; projectile.mesh.visible = true;
    }
  }
  private updateProjectiles(dt: number) {
    this.playerSphere.center.copy(this.player.root.position); this.playerSphere.center.y += 1; this.playerSphere.radius = .55;
    for (const p of this.projectiles) {
      if (p.life <= 0) continue;
      const start = this.vectors[0].copy(p.mesh.position), dir = this.vectors[1].copy(p.velocity).normalize(), travel = p.velocity.length() * dt;
      const wall = obstacleDistance(start, dir, this.world.colliders, travel); this.ray.set(start, dir);
      const playerHit = this.ray.intersectSphere(this.playerSphere, this.vectors[2]), hitDistance = playerHit ? start.distanceTo(playerHit) : Infinity;
      if (playerHit && hitDistance <= travel && hitDistance < wall) {
        if (this.runtime.damage(p.damage, p.role)) { this.audio.damage(); this.damageAngle = Math.atan2(start.x - this.player.root.position.x, -(start.z - this.player.root.position.z)) - this.yaw; }
        p.life = 0;
      } else if (wall < travel) { this.effects.impact(this.vectors[3].copy(start).addScaledVector(dir, wall), false, 3); p.life = 0; }
      else { p.mesh.position.addScaledVector(p.velocity, dt); this.effects.tracer(start, p.mesh.position, true); p.life -= dt; }
      p.mesh.visible = p.life > 0;
    }
  }
  private updateMission() {
    const r = this.runtime; if (r.mode !== 'active') return; this.interact = '';
    if (r.stage === 0 && this.player.root.position.z < MISSION.zones[0]) { r.stage = 1; r.notify('LAUNCH DISTRICT / HOSTILES CONFIRMED'); }
    if (r.stage >= 1 && r.stage <= 3 && this.enemies.filter(e => e.stage === r.stage).every(e => e.hp <= 0)) { r.stage++; r.supply(); r.notify('SECTOR SECURED / FIELD SUPPLIES RECEIVED'); }
    if (r.stage === 4 && this.enemies.filter(e => e.stage === 4).every(e => e.hp <= 0)) {
      this.target.copy(this.world.terminal);
      if (this.player.root.position.distanceTo(this.world.terminal) < 2.6) this.interact = 'E / DISABLE LIQUIDITY CORE';
    } else if (r.stage === 6) {
      this.target.copy(this.world.extraction); if (this.player.root.position.distanceTo(this.world.extraction) < 2) r.complete();
    } else if (r.stage === 0) this.target.set(0, 0, 3);
    else {
      const active = this.enemies.filter(e => e.hp > 0 && e.stage <= r.stage).sort((a, b) => a.actor.root.position.distanceToSquared(this.player.root.position) - b.actor.root.position.distanceToSquared(this.player.root.position))[0];
      if (active) this.target.copy(active.actor.root.position);
    }
  }
  private updateBoss(dt: number) {
    const r = this.runtime, boss = this.enemies.find(e => e.role === 'boss');
    if (!boss || r.stage !== 5 || r.mode !== 'active') return;
    if (boss.hp <= 0) { r.stage = 6; r.notify('THREAT ELIMINATED / PROCEED TO EXTRACTION', 5); this.hazards.forEach(h => { h.active = false; h.mesh.visible = false; }); this.projectiles.forEach(p => { p.life = 0; p.mesh.visible = false; }); return; }
    const ratio = boss.hp / ENEMIES.boss.health;
    if (ratio < .72 && !this.reinforcement) {
      this.reinforcement = true; this.spawn('reinforce-a', 'kol', -6, 0, -73, 5); this.spawn('reinforce-b', 'rugger', 6, 0, -73, 5);
      r.notify('REINFORCEMENTS / FLANKS COMPROMISED', 3);
    }
    if (ratio < .45) {
      this.hazardCooldown -= dt;
      if (this.hazardCooldown <= 0) {
        this.hazardCooldown = ratio < .2 ? 5.5 : 8;
        for (let i = 0; i < 3; i++) {
          const h = this.hazards[i]; h.active = true; h.age = 0; h.mesh.visible = true;
          h.mesh.position.set(T.MathUtils.clamp(this.player.root.position.x + (i - 1) * 3.3, -9, 9), .025, T.MathUtils.clamp(this.player.root.position.z + (i % 2 ? -2 : 1), -79, -58));
        }
        r.notify('LIQUIDITY DRAIN / LEAVE MARKED ZONES', 2);
      }
    }
    if (ratio < .2) { boss.cooldown = Math.min(boss.cooldown, 1); boss.direction.multiplyScalar(1.15); }
    for (const h of this.hazards) if (h.active) {
      h.age += dt; const mat = h.mesh.material as T.MeshBasicMaterial; mat.opacity = h.age < 2 ? .14 + Math.sin(h.age * 12) * .06 : .5; mat.color.setHex(h.age < 2 ? 0xd39858 : 0xa3372b);
      if (h.age > 2 && h.age < 6 && this.player.root.position.distanceTo(h.mesh.position) < 2.8) { if (r.damage(12 * dt, 'drain') && this.heartbeat > .3) { this.audio.damage(); this.heartbeat = 0; } }
      if (h.age > 6) { h.active = false; h.mesh.visible = false; }
    }
  }
  snapshot(): HudSnapshot {
    const r = this.runtime, boss = this.enemies.find(e => e.role === 'boss'), ratio = boss ? boss.hp / ENEMIES.boss.health : 1;
    const targets: HudSnapshot['targets'] = [];
    for (const e of this.enemies) {
      if (!e.actor.root.visible || e.hp <= 0 || r.stage === 6) continue;
      const world = this.vectors[9].copy(e.actor.root.position); world.y += 2.2 * e.actor.root.scale.x;
      const direction = this.vectors[10].subVectors(world, this.camera.position); this.camera.getWorldDirection(this.vectors[11]);
      if (direction.dot(this.vectors[11]) < 0 || direction.length() > 45) continue;
      const blocked = obstacleDistance(this.camera.position, direction.normalize(), this.world.colliders, this.camera.position.distanceTo(world));
      if (blocked < this.camera.position.distanceTo(world) - .5) continue;
      world.project(this.camera); if (Math.abs(world.x) > 1.1 || Math.abs(world.y) > 1.1) continue;
      targets.push({ id: e.id, x: (world.x + 1) * 50, y: (1 - world.y) * 50, name: ENEMIES[e.role].name, threat: ENEMIES[e.role].threat, hp: e.hp / ENEMIES[e.role].health, warning: e.warning > 0 });
    }
    return {
      assetsReady: this.assetsReady, assetsProgress: this.assetsProgress,
      mode: r.mode, stage: r.stage, objective: OBJECTIVES[r.stage], health: Math.ceil(r.health), ammo: r.ammo[r.weaponId].magazine, reserve: r.ammo[r.weaponId].reserve,
      weaponId: r.weaponId, reload: r.reloadLeft ? 1 - r.reloadLeft / (r.weapon.reloadMs / 1000) : 0, dodge: r.dodgeCooldown, hit: r.hitPulse > 0, kill: r.killPulse > 0,
      damage: r.damagePulse, damageAngle: this.damageAngle, aiming: this.input?.aim ?? false, covered: this.nearCover, bearing: ((this.yaw * 180 / Math.PI) % 360 + 360) % 360, time: Math.floor(r.time), kills: r.kills,
      shots: r.shots, hits: r.hits, damageReceived: Math.round(r.damageReceived), feed: r.feedLeft > 0 || r.mode !== 'active' ? r.feed : '', cause: r.cause, muted: this.audio.muted,
      bossHealth: r.stage === 5 && boss ? ratio : null, bossPhase: ratio > .72 ? '01 / PRESSURE' : ratio > .45 ? '02 / REINFORCEMENTS' : ratio > .2 ? '03 / LIQUIDITY DRAIN' : '04 / LAST STAND',
      sniper: this.enemies.some(e => e.role === 'whale' && e.hp > 0 && e.warning > 0), interact: this.interact, distance: Math.round(this.player.root.position.distanceTo(this.target)),
      targets, map: { player: [this.player.root.position.x, this.player.root.position.z], enemies: this.enemies.filter(e => e.hp > 0 && e.stage <= r.stage && r.stage < 6).map(e => [e.actor.root.position.x, e.actor.root.position.z]), target: [this.target.x, this.target.z] },
      rewards: r.rewards,
    };
  }
  private publish() { this.lastPublishedMode = this.runtime.mode; this.onHud(this.snapshot()); }
  dispose() {
    if (this.disposed) return; this.disposed = true; this.startEpoch++; cancelAnimationFrame(this.animation); this.resize?.disconnect(); this.input?.dispose(); this.audio.dispose();
    this.renderer?.domElement.removeEventListener('webglcontextlost', this.contextLost);
    disposeActor(this.player); this.enemies.forEach(enemy => disposeActor(enemy.actor));
    disposeObject(this.scene); this.assets.dispose(); this.world?.textures.forEach(t => t.dispose()); this.scene.environment?.dispose();
    this.renderer?.dispose(); this.renderer?.domElement.remove();
  }
}
