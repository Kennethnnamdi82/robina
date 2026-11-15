import { Box3, Vector3 } from 'three';
import { createAssignmentOperation } from '../three/Operations';
import { ASSIGNMENTS } from '../missions/assignments';
import { MissionEngine } from '../missions/MissionEngine';
import { WorldState } from '../world/WorldState';
import { addAssignmentWalls } from '../three/AssignmentSite';
import { addSocialWalls } from '../three/SocialVenues';
import { CharacterController } from '../characters/CharacterController';
import { NavigationGrid } from '../ai/navigation';
import { TacticalEnemy } from '../three/TacticalEnemy';
import type { EnemySpawn } from '../ai/definitions';
import type { DamageEvent } from '../combat/Health';
import { emptyCommand, type PlayerCommand } from '../input/InputBuffer';
import { moveKinematic, traceSolids, horizontalContact } from '../three/physics3d';
import { convertSolids, point3, METRES, type Solid3D } from '../three/world3d';
import { Projectile3D, type Target3D } from '../three/Projectile3D';
import { FieldItems, ENEMY_DROPS, HEALTH_BOXES, meleeStrike } from '../three/FieldItems';
import { Loadout } from '../three/Loadout';
import { CitySimulation, VEHICLE_LENGTH, vehicleCollisionDimensions } from '../three/CitySimulation';
import { VehicleController, addParkedVehicles, vehicleOverlap } from '../three/VehicleController';
import { PolicePursuit } from '../three/PolicePursuit';
import { CampaignGameplay } from '../three/CampaignGameplay';
import { dodgeMotionScale } from '../three/dodgeMotion';

export const SIMULATION_VERSION = 3;
export const SIMULATION_STEP = 1 / 60;
export interface AuthorityInput extends PlayerCommand {
  seq: number; aim: [number, number, number]; jump: boolean; jumpHeld: boolean; highJump: boolean;
  touchRepeat: boolean; throttle: number; steer: number; brake: boolean; stickX: number; stickY: number; cameraYaw: number;
}
export type AuthorityAction = { type: 'vehicle' | 'grenade' | 'handoff' | 'cancelHandoff' | 'cancelPickup' }
  | { type: 'weapon' | 'pickup'; slot: number };
export type SimulationEvent = { type: 'health'; id: string; amount: number; kind: 'damage' | 'firstAid' }
  | { type: 'shot'; owner: string; origin: number[]; direction: number[]; damage: number; speed: number; range: number; life: number }
  | { type: 'grenade' } | { type: 'grenadePickup'; id: string; amount: number } | { type: 'checkpoint'; id: string };

// State is serialized only by the server. These helpers preserve the existing
// controllers' Maps, Sets and vectors without copying rendering objects.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type State = any;
function pack(value: State, omit: string[] = []): State {
  if(typeof value==='number'&&!Number.isFinite(value))return {__number:String(value)};
  if (value instanceof Vector3) return { __vector: value.toArray() };
  if (value instanceof Set) return { __set: [...value].map(v => pack(v)) };
  if (value instanceof Map) return { __map: [...value].map(([k, v]) => [k, pack(v)]) };
  if (Array.isArray(value)) return value.map(v => pack(v));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([k, v]) => !omit.includes(k) && typeof v !== 'function').map(([k, v]) => [k, pack(v)]));
  return value;
}
function unpack(value: State): State {
  if(value?.__number)return Number(value.__number);
  if (value?.__vector) return new Vector3().fromArray(value.__vector);
  if (value?.__set) return new Set(value.__set.map(unpack));
  if (value?.__map) return new Map(value.__map.map(([k, v]: State[]) => [k, unpack(v)]));
  if (Array.isArray(value)) return value.map(unpack);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, unpack(v)]));
  return value;
}
function hydrate(target: State, state: State) {
  for (const [key, encoded] of Object.entries(state)) {
    const value = unpack(encoded);
    if (target[key] && typeof target[key] === 'object' && !Array.isArray(target[key]) &&
        !(target[key] instanceof Set) && !(target[key] instanceof Map) && !(target[key] instanceof Vector3) &&
        value && typeof value === 'object' && !Array.isArray(value)) hydrate(target[key], encoded);
    else target[key] = value;
  }
}

export class MissionSimulation {
  appearance:{outfit:string|null;finish:string|null;emote:string|null;effect:string|null;identity:string|null;trail?:string|null;entrance?:string|null}={outfit:null,finish:null,emote:null,effect:null,identity:null,trail:null,entrance:null};
  readonly operation; readonly world; readonly mission; readonly controller = new CharacterController(true);
  readonly loadout = new Loadout(); readonly field = new FieldItems(); readonly pool = new Projectile3D();
  readonly body = { position: new Vector3(), vertical: 0, grounded: true, jumpTime: 0 };
  readonly traffic; readonly vehicles; readonly police; readonly campaign; readonly navigation; readonly solids;
  readonly enemies: TacticalEnemy[] = []; readonly targets: Target3D[] = []; readonly occupants: Solid3D[] = [];
  readonly events: SimulationEvent[] = [];
  hits = 0; firearmShots = 0; firearmHits = 0; grenadesSpent = 0; lastSequence = -1;
  private healthSerial = 0; private throwRelease = -1; private vehicleSerial = 0; private burnAge = 0;
  private revision=-1;
  private blockersById=new Map<string,WorldState['blockers'][number]>();
  private lastObjectives = new Set<string>(); private aim = new Vector3(); private legacy = { x: 0, y: 0 };
  private command: AuthorityInput = { ...emptyCommand(), seq: -1, aim: [0, 1, 0], jump: false,
    jumpHeld: false, highJump: false, touchRepeat: false, throttle: 0, steer: 0, brake: false, stickX: 0, stickY: 0, cameraYaw: 0 };
  constructor(readonly missionId: string, readonly seed: number, readonly sessionId: string) {
    const index = ASSIGNMENTS.findIndex(a => `assignment-${a.id}` === missionId);
    if (index < 0) throw new Error('invalid_mission');
    this.operation = createAssignmentOperation(index, seed);
    this.world = new WorldState(this.operation.level); addAssignmentWalls(this.world, ASSIGNMENTS[index]); addSocialWalls(this.world);
    this.blockersById=new Map(this.world.blockers.map(b=>[b.id,b]));
    this.solids = convertSolids(this.world);
    this.navigation = new NavigationGrid(this.world.level.width * 2, this.world.level.height * 2, 32, this.world.blockers);
    this.mission = new MissionEngine(this.operation.mission, sessionId); this.mission.prepare(); this.mission.start();
    this.body.position.copy(point3(this.world.level.spawn.x, this.world.level.spawn.y));
    this.targets.push({ id: 'operative', team: 'operative', box: new Box3(), alive: () => this.controller.health > 0 && !this.vehicles.current,
      damage: event => this.damage(event) });
    this.world.level.enemies.forEach((spawn, i) => this.addEnemy(spawn, i * .05));
    this.traffic = new CitySimulation(this.operation.seed); addParkedVehicles(this.traffic.cars);
    this.vehicles = new VehicleController(this.traffic.cars);
    this.traffic.blocked = car => this.solids.some(s => !s.id.startsWith('city-traffic-') && vehicleOverlap(car, car.x, car.z, Math.atan2(car.dx, car.dz), s));
    for (const car of this.traffic.cars) {
      const solid: Solid3D = { id: `city-traffic-${car.id}`, kind: 'cover', enabled: true, box: new Box3(),
        oriented: { center: new Vector3(), half: new Vector3(), yaw: 0 } };
      this.solids.push(solid);
      this.targets.push({ id: `vehicle-${car.id}`, team: 'civilian', box: solid.box, alive: () => (car.health ?? 200) > 0,
        damage: event => this.vehicles.damage(car, event.amount) });
    }
    this.police = new PolicePursuit(this.traffic.cars, new NavigationGrid(this.world.level.width, this.world.level.height, 64, this.world.blockers, 46),
      this.solids, ASSIGNMENTS[index].response, spawn => { if (this.enemies.length < 14) { this.addEnemy(spawn, .05); this.enemies.at(-1)!.alarm(1, this.legacy); } },
      (window, car) => {
        const origin = point3(window.x, window.y, 1.22), lead = Math.min(.5, origin.distanceTo(this.body.position) / 90);
        const driven = this.vehicles.current, vx = driven ? driven.dx * driven.speed : this.controller.vx * METRES,
          vz = driven ? driven.dz * driven.speed : this.controller.vy * METRES;
        const direction = new Vector3(this.body.position.x + vx * lead - origin.x, this.body.position.y + 1 - origin.y,
          this.body.position.z + vz * lead - origin.z).normalize().applyAxisAngle(new Vector3(0, 1, 0), Math.sin(this.mission.elapsed * 13 + car.id) * .018);
        this.shoot(origin, direction, 90, 1, 46, 4, `police-car-${car.id}`, 'security');
      }, this.vehicles.collision);
    this.campaign = new CampaignGameplay(index, this.mission, this.world, this.vehicles, this.police, this.navigation);
    const a = ASSIGNMENTS[index];
    this.field.add('site-first-aid', new Vector3(a.site.x + 7, 0, a.site.z + 2), { kind: 'health', amount: 25 });
    this.field.add('supply-charge', point3(224, 576), { kind: 'bomb', amount: 2 });
    this.field.add('supply-med', point3(288, 704), { kind: 'health', amount: 25 });
    this.field.add('supply-smg', point3(416, 576), { kind: 'weapon', weapon: 'smg' });
    this.syncGeometry();
  }
  input(frame: AuthorityInput) {
    if (frame.seq <= this.lastSequence) return false;
    const next={...frame};for(const key of ['dodge','interact','reload','jump','highJump'] as const)next[key]=Boolean(next[key]||this.command[key]);
    this.lastSequence = frame.seq; this.command = next; return true;
  }
  neutral() { this.command = { ...this.command, ...emptyCommand(), jump: false, jumpHeld: false, highJump: false,
    throttle: 0, steer: 0, brake: true, stickX: 0, stickY: 0 }; }
  action(action: AuthorityAction) {
    if (this.mission.state !== 'ACTIVE' || this.controller.health <= 0) return false;
    if (action.type === 'handoff') {
      if (this.body.position.distanceTo(new Vector3(this.campaign.assignment.extraction.x, this.body.position.y, this.campaign.assignment.extraction.z)) > 6) return false;
      const completed=this.campaign.completeHandoff();if(completed)this.campaign.message='DELIVERY ACCEPTED / CONTRACT VERIFIED';return completed;
    }
    if (action.type === 'cancelHandoff') { this.campaign.handoff = 'none'; return true; }
    if (action.type === 'cancelPickup') { this.field.cancel(); return true; }
    if (action.type === 'pickup') { const item = this.field.nearby(this.body.position, this.solids); return !!item && this.collect(item, action.slot); }
    if (action.type === 'weapon') return !this.vehicles.current && this.loadout.switchTo(action.slot, this.controller.canAttack);
    if (action.type === 'grenade') {
      if (this.vehicles.current || !this.controller.canAttack || this.loadout.busy || !this.field.quantity || this.loadout.current.controller.reloadRemaining > 0) return false;
      this.loadout.start('throw', .55); this.throwRelease = .18; return true;
    }
    if (action.type === 'vehicle') {
      this.controller.stop();
      if (this.vehicles.current) return this.vehicles.exit(this.body.position, this.solids);
      this.vehicles.scan(this.body.position, 28);
      return !!this.vehicles.nearby && this.vehicles.enter(this.vehicles.nearby, this.body.position, this.solids);
    }
    return false;
  }
  private collect(item: FieldItems['pickups'][number], slot?: number) {
    const health = this.controller.health, grenades=this.field.quantity;
    const taken = this.field.take(item, this.loadout, this.controller.vitality, this.controller.health > 0, slot);
    if (taken) this.loadout.start('pickup', .35);
    if (this.controller.health > health) this.events.push({ type: 'health', id: `kit:${++this.healthSerial}`, amount: this.controller.health - health, kind: 'firstAid' });
    if(this.field.quantity>grenades)this.events.push({type:'grenadePickup',id:item.id,amount:this.field.quantity-grenades});
    return taken;
  }
  private damage(event: DamageEvent) {
    const amount = this.controller.receiveDamage(event);
    if (amount) { this.mission.damage(amount); this.events.push({ type: 'health', id: `hit:${++this.healthSerial}`, amount, kind: 'damage' }); }
    if (this.controller.health <= 0) { this.mission.fail('Operative defeated before extraction.'); this.pool.clear(); this.neutral(); }
    return amount;
  }
  private addEnemy(spawn: EnemySpawn, stagger: number) {
    const enemy = new TacticalEnemy(spawn, this.navigation, stagger); this.enemies.push(enemy);
    const box = new Box3();
    this.targets.push({ id: spawn.id, team: 'security', box, headshotMultiplier: 1.75, alive: () => enemy.alive, damage: event => {
      const amount = enemy.damage(event);
      if (amount && !enemy.alive) {
        this.field.add(`${spawn.id}:weapon`, point3(enemy.x, enemy.y), { kind: 'weapon', weapon: ENEMY_DROPS[spawn.type] });
        this.field.add(`${spawn.id}:health`, point3(enemy.x + 22, enemy.y + 14), { kind: 'health', amount: HEALTH_BOXES.small });
      }
      return amount;
    } });
    this.occupants.push({ id: spawn.id, kind: 'cover', box, enabled: true });
  }
  private shoot(origin: Vector3, direction: Vector3, speed: number, life: number, range: number, damage: number, owner: string, team: 'security' | 'operative') {
    if (!this.pool.fire(origin, direction, speed, life, range, damage, owner, team)) return;
    this.events.push({ type: 'shot', origin: origin.toArray(), direction: direction.toArray(), speed, life, range, damage, owner });
  }
  private syncGeometry() {
    for (const solid of this.solids) {
      const original = this.blockersById.get(solid.id); if (original) solid.enabled = original.enabled;
      if (solid.id.startsWith('city-traffic-')) {
        const car = this.traffic.cars[Number(solid.id.slice(13))];
        const dimensions=vehicleCollisionDimensions(car.kind),w=dimensions.width,h=dimensions.height;
        const hx = Math.abs(car.dx) * car.length / 2 + Math.abs(car.dz) * w / 2,
          hz = Math.abs(car.dz) * car.length / 2 + Math.abs(car.dx) * w / 2;
        solid.box.set(new Vector3(car.x - hx, 0, car.z - hz), new Vector3(car.x + hx, h, car.z + hz));
        solid.oriented!.center.set(car.x, h / 2, car.z); solid.oriented!.half.set(w / 2, h / 2, VEHICLE_LENGTH[car.kind] / 2); solid.oriented!.yaw = Math.atan2(car.dx, car.dz);
        solid.enabled = Math.hypot(car.x - this.body.position.x, car.z - this.body.position.z) < 105;
      }
    }
    const setBox = (box: Box3, p: Vector3, radius: number,height=1.75) => box.set(new Vector3(p.x - radius, p.y, p.z - radius), new Vector3(p.x + radius, p.y + height, p.z + radius));
    setBox(this.targets[0].box, this.body.position, .34);
    for (const enemy of this.enemies) {
      const target = this.targets.find(t => t.id === enemy.spawn.id)!; setBox(target.box, point3(enemy.x, enemy.y), .36,1.8);
      this.occupants.find(s => s.id === enemy.spawn.id)!.enabled = enemy.alive;
    }
    for (const target of this.targets.filter(t => t.id.startsWith('vehicle-'))) {
      const car = this.traffic.cars[Number(target.id.slice(8))]; target.team = car === this.vehicles.current ? 'operative' : car.kind === 'police' ? 'security' : 'civilian';
    }
  }
  step(dt = SIMULATION_STEP) {
    if (dt !== SIMULATION_STEP) throw new Error('fixed_step_required');
    if (this.mission.state !== 'ACTIVE') return;
    const command = { ...this.command }; this.command.interact = this.command.dodge = this.command.jump = this.command.highJump = this.command.reload = false;
    this.aim.fromArray(command.aim); this.legacy.x = this.body.position.x / METRES; this.legacy.y = this.body.position.z / METRES;
    this.syncGeometry();
    if (this.vehicles.current) this.controller.stepMounted(dt);
    else {
      command.dodge = command.dodge && this.body.grounded && !this.loadout.busy;
      const interaction = this.controller.step(command, dt);
      if (interaction) {
        if (!this.campaign.interact(this.body.position)) { const item = this.field.nearby(this.body.position, this.solids); if (item) this.collect(item); }
      }
    }
    if (this.mission.state !== 'ACTIVE') return;
    const driving = { throttle: command.throttle, steer: command.steer, brake: command.brake,
      stickX: command.stickX, stickY: command.stickY, cameraYaw: command.cameraYaw };
    if (this.vehicles.current) { this.vehicles.step(dt, driving, this.solids, this.body.position); this.body.grounded = true; this.body.vertical = 0; }
    else {
      this.vehicles.step(dt, driving, this.solids, this.body.position);
      const scale = dodgeMotionScale(this.controller.dodgeRemaining, dt);
      const p=this.body.position,nearby=[...this.solids,...this.occupants].filter(s=>s.enabled&&s.box.min.x<p.x+2&&s.box.max.x>p.x-2&&s.box.min.z<p.z+2&&s.box.max.z>p.z-2);
      moveKinematic(this.body, this.controller.vx * METRES * dt * scale, this.controller.vy * METRES * dt * scale,
        dt, nearby, command.jump, command.jumpHeld, command.highJump);
    }
    this.legacy.x = this.body.position.x / METRES; this.legacy.y = this.body.position.z / METRES;
    this.traffic.step(dt, [{ x: this.body.position.x, z: this.body.position.z }, ...this.enemies.filter(e => e.alive).map(e => ({ x: e.x * METRES, z: e.y * METRES }))]);
    this.vehicles.scan(this.body.position, 28);
    this.police.step(dt, this.legacy, this.enemies.filter(e => e.spawn.id.startsWith('police-')).map(e => ({ x: e.x, y: e.y, alive: e.alive })));
    this.campaign.step(dt, this.body.position, this.enemies.filter(e => e.spawn.id.startsWith('site-guard-') && e.alive).length);
    const door = this.solids.find(s => s.id === 'mission-vault-door'); if (door) door.enabled = this.world.blockers.find(b => b.id === door.id)!.enabled;
    if(this.revision!==this.world.revision){this.revision=this.world.revision;this.navigation.rebuild();}
    const nearest = this.enemies.filter(e => e.alive).sort((a, b) => Math.hypot(a.x - this.legacy.x, a.y - this.legacy.y) - Math.hypot(b.x - this.legacy.x, b.y - this.legacy.y)).slice(0, Math.min(4, 2 + Math.floor(this.operation.assignment! / 3)));
    for (const enemy of this.enemies) {
      enemy.step(dt, { player: this.legacy, alive: this.controller.health > 0, permitted: nearest.includes(enemy) || enemy.spawn.id.startsWith('police-'), near: Math.hypot(enemy.x - this.legacy.x, enemy.y - this.legacy.y) < 1600, wanted: this.police.pursuingValuables }, (e, angle) => {
        const origin = point3(e.x, e.y, 1.22), direction = new Vector3(Math.cos(angle), 0, Math.sin(angle)), horizontal = Math.hypot(this.body.position.x - origin.x, this.body.position.z - origin.z), police = e.spawn.id.startsWith('police-');
        if (police) direction.set(this.body.position.x - origin.x + this.controller.vx * METRES * .09, this.body.position.y + 1.05 - origin.y, this.body.position.z - origin.z + this.controller.vy * METRES * .09).normalize();
        else { direction.y = (this.body.position.y + 1.05 - origin.y) / Math.max(.1, horizontal); direction.normalize(); }
        this.shoot(origin, direction, police ? 75 : 340 * METRES, 2, police ? 32 : 640 * METRES, e.config.damage, e.spawn.id, 'security');
      });
      for (const solid of this.solids.filter(s => s.enabled && s.id.startsWith('city-traffic-'))) { const hit = horizontalContact(enemy.x * METRES, enemy.y * METRES, .36, solid); if (hit) { enemy.x += hit.x * hit.depth / METRES; enemy.y += hit.z * hit.depth / METRES; } }
    }
    if (this.throwRelease >= 0) { this.throwRelease -= dt; if (this.throwRelease <= 0) { if (this.field.throw(this.body.position, this.aim, this.controller.health > 0)) { this.grenadesSpent++; this.events.push({ type: 'grenade' }); } this.throwRelease = -1; } }
    this.syncGeometry();
    this.field.step(dt, this.solids, this.targets.filter(t => !t.id.startsWith('vehicle-')), (p, radius) => { this.vehicles.blast(p, radius); this.police.alert(); });
    const fired = this.loadout.step(dt, command.fire && !this.vehicles.current, command.reload, this.controller.canAttack, command.touchRepeat);
    if (fired) {
      const origin = this.body.position.clone().add(new Vector3(0, 1.23, 0)), direction = this.aim.clone().sub(origin).normalize(), w = this.loadout.definition;
      if (w.kind === 'melee') { this.hits += meleeStrike(origin, direction, this.targets, this.solids, w.damage, w.range * METRES, this.loadout.shots); }
      else { this.firearmShots++; if (w.spread) direction.applyAxisAngle(new Vector3(0, 1, 0), this.loadout.current.controller.shotAngle(0)); this.shoot(origin, direction, this.loadout.current.id === 'pistol' ? 130 : 240, w.lifetime, w.range * METRES, w.damage, 'operative', 'operative'); }
      this.controller.attacked(); this.police.alert(); this.enemies.forEach(e => { e.hear(this.legacy); e.threat(this.legacy, { x: direction.x, y: direction.z }); });
    }
    this.pool.step(dt, this.solids, this.targets, (_p, damage, owner) => { if (damage > 0 && owner === 'operative') { this.hits++; this.firearmHits++; } });
    for (const event of this.vehicles.drainEvents()) {
      this.police.alert(); if (event.kind !== 'explosion') continue;
      const point = new Vector3(event.car.x, .65, event.car.z); this.vehicles.blast(point, 4.5, 75);
      const trapped = this.vehicles.current === event.car, distance = Math.hypot(point.x - this.body.position.x, point.z - this.body.position.z);
      if (trapped || distance < 5 && traceSolids(point, this.body.position.clone().sub(point).normalize(), this.solids.filter(s => s.id !== `city-traffic-${event.car.id}`), distance) >= distance - .1) {
        if (trapped) this.controller.vitality.invulnerable = 0;
        this.damage({ id: `vehicle:${++this.vehicleSerial}`, sourceId: 'vehicle', team: 'security', amount: trapped ? 200 : Math.round(85 * (1 - distance / 5)), angle: 0 });
      }
    }
    if (this.vehicles.current && (this.vehicles.current.fire ?? 0) > 0 && !this.vehicles.current.exploded) { this.burnAge += dt; if (this.burnAge >= .65) { this.burnAge = 0; this.damage({ id: `burn:${++this.vehicleSerial}`, sourceId: 'engine-fire', team: 'security', amount: 5, angle: 0 }); } } else this.burnAge = 0;
    this.mission.sample(this.loadout.shots, this.hits, this.enemies.filter(e => !e.alive).length); this.mission.step(dt);
    for (const id of this.mission.completed) if (!this.lastObjectives.has(id)) { this.lastObjectives.add(id); this.events.push({ type: 'checkpoint', id }); }
  }
  drainEvents() { return this.events.splice(0); }
  snapshot() {
    return { version: SIMULATION_VERSION, appearance:this.appearance, inputSequence: this.lastSequence, position: this.body.position.toArray(), vertical: this.body.vertical,
      grounded: this.body.grounded, health: this.controller.health, maxHealth: this.controller.maxHealth, mission: this.mission.snapshot(),
      loadout: this.loadout.snapshot(), field: this.field.snapshot(), campaign: this.campaign.snapshot, pursuit: this.police.snapshot,
      vehicle: this.vehicles.snapshot, activeFlags: [...this.world.active],
      enemies: this.enemies.map(e => ({ spawn: e.spawn, x: e.x, y: e.y, vx: e.vx, vy: e.vy, angle: e.angle, health: e.health.current,
        state: e.state, shots: e.shots, hurt: e.hurt, detection: e.detection, tactic: e.tactic, sprinting: e.sprinting })),
      cars: this.traffic.cars.map(c => ({ id: c.id, x: c.x, z: c.z, dx: c.dx, dz: c.dz, speed: c.speed, health: c.health,
        mode: c.mode, travelled: c.travelled, door: c.door, fire: c.fire, exploded: c.exploded, fuse: c.fuse })), trafficTime: this.traffic.time };
  }
  checkpoint() {
    return { version: SIMULATION_VERSION, missionId: this.missionId, seed: this.seed,
      controller: pack(this.controller, ['animations']), body: pack(this.body), mission: pack(this.mission, ['definition']),
      loadout: pack(this.loadout, ['slots']), slots: this.loadout.slots.map(s => s ? { id: s.id, collectionId:s.collectionId, state: pack(s.controller, ['definition']) } : null),
      field: pack(this.field), enemies: this.enemies.map(e => ({ spawn: e.spawn, state: pack(e, ['config', 'home', 'spawn', 'navigation', 'grid']) })),
      cars: this.traffic.cars.map(c => pack(c, ['route', 'lengths', 'total'])), trafficTime: this.traffic.time,
      vehicle: pack(this.vehicles, ['cars', 'current', 'nearby', 'events']), currentCar: this.vehicles.current?.id ?? null,
      police: pack(this.police, ['cars', 'grid', 'solids', 'units']), policeUnits: (this.police as State).units.map((u: State) => ({ ...pack(u, ['car']), carId: u.car.id })),
      campaign: pack(this.campaign, ['assignment', 'mission', 'world', 'vehicles', 'police', 'navigation']),
      world: { active: [...this.world.active], objects: pack(this.world.level.objects), blockers: this.world.blockers.map(b => [b.id, b.enabled]), extracted: this.world.extracted },
      stats: { hits: this.hits, firearmShots: this.firearmShots, firearmHits: this.firearmHits, grenadesSpent: this.grenadesSpent } };
  }
  restore(state: State, spent: number) {
    if (state.version !== SIMULATION_VERSION || state.missionId !== this.missionId || state.seed !== this.seed) throw new Error('checkpoint_version_mismatch');
    hydrate(this.controller, state.controller); hydrate(this.body, state.body); hydrate(this.mission, state.mission);
    hydrate(this.loadout, state.loadout);
    const slots = new Loadout(state.slots.map((s: State) => s?.id));
    state.slots.forEach((s:State,i:number)=>{if(s?.collectionId)slots.equipCollection(s.collectionId,[s.collectionId],i);});
    slots.slots.forEach((s, i) => { if (s) hydrate(s.controller, state.slots[i].state); this.loadout.slots[i] = s; });
    hydrate(this.field, state.field);
    for (const row of state.enemies) { let enemy = this.enemies.find(e => e.spawn.id === row.spawn.id); if (!enemy) { this.addEnemy(row.spawn, 0); enemy = this.enemies.at(-1)!; } hydrate(enemy, row.state); }
    state.cars.forEach((row: State, i: number) => hydrate(this.traffic.cars[i], row)); this.traffic.time = state.trafficTime;
    hydrate(this.vehicles, state.vehicle); this.vehicles.current = state.currentCar === null ? null : this.traffic.cars[state.currentCar];
    hydrate(this.police, state.police); (this.police as State).units = state.policeUnits.map((u: State) => ({ ...unpack(u), car: this.traffic.cars[u.carId] }));
    hydrate(this.campaign, state.campaign); this.world.active.clear(); state.world.active.forEach((id: string) => this.world.active.add(id));
    this.world.level.objects = unpack(state.world.objects); this.world.extracted = state.world.extracted;
    for (const [id, enabled] of state.world.blockers) { const blocker = this.world.blockers.find(b => b.id === id); if (blocker) blocker.enabled = enabled; }
    Object.assign(this, state.stats); this.field.quantity = Math.max(0, this.field.quantity - Math.max(0, spent - this.grenadesSpent)); this.grenadesSpent = spent;
    this.lastObjectives = new Set(this.mission.completed); this.neutral(); this.syncGeometry(); this.navigation.rebuild(); this.events.length = 0;
  }
}
export type AuthoritySnapshot = ReturnType<MissionSimulation['snapshot']>;
