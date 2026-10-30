import { segmentBox, type Blocker } from '../combat/geometry';
import { THE_LAUNCH, wallBlockers, type LevelDefinition, type WorldObject } from './level';

export interface InteractionEvent { serial: number; objectId: string; kind: WorldObject['kind']; active: boolean }
/** Reusable local object state, range/line-of-sight guards, explicit prerequisites. */
export class WorldState {
  readonly active = new Set<string>();
  readonly blockers: Blocker[];
  readonly events: InteractionEvent[] = [];
  revision = 0; extracted = false;
  private validatedHacks = new Set<string>();
  occupants: readonly { x: number; y: number }[] = [];
  authorizeHack(id: string) { this.validatedHacks.add(id); }
  grantFlag(id: string) { if (!this.active.has(id)) { this.active.add(id); this.revision++; } }
  missing(object: WorldObject) { return [...(object.requires ? [object.requires] : []), ...(object.requiresAll ?? [])].filter(id => !this.active.has(id)); }
  constructor(readonly level: LevelDefinition = THE_LAUNCH) {
    this.blockers = [ ...wallBlockers(level),
      ...level.props.filter(p => p.solid).map(p => ({ id: p.id, x: p.x, y: p.y + 5, width: p.solid!.width, height: p.solid!.height, enabled: true })),
      ...level.objects.filter(o => o.kind === 'door').map(o => ({ id: o.id, x: o.x, y: o.y, width: o.width!, height: o.height!, enabled: true })),
      ...level.objects.filter(o => o.solid).map(o => ({ id: o.id, x: o.x, y: o.y + 5, width: o.solid!.width, height: o.solid!.height, enabled: true })),
    ];
  }
  reachable(object: WorldObject, actor: { x: number; y: number }) {
    if (Math.hypot(object.x - actor.x, object.y - actor.y) > object.range) return false;
    const dx = object.x - actor.x, dy = object.y - actor.y;
    return !this.blockers.some(box => box.enabled && box.id !== object.id && segmentBox(actor.x, actor.y, dx, dy, box) < .92);
  }
  nearest(actor: { x: number; y: number }) {
    let nearest: WorldObject | null = null, distance = Infinity;
    for (const object of this.level.objects) {
      if (object.kind === 'collectible' && object.requires && !this.active.has(object.requires)) continue;
      if (object.kind === 'collectible' && this.active.has(object.id) || !this.reachable(object, actor)) continue;
      const d = (object.x - actor.x) ** 2 + (object.y - actor.y) ** 2;
      if (d < distance) { nearest = object; distance = d; }
    }
    return nearest;
  }
  description(object: WorldObject) {
    if (object.id === 'vault-gate' && this.blockers.some(b => b.id === 'guardian-lockdown' && b.enabled)) return 'GUARDIAN LOCKDOWN / Defeat the Guardian to release this exit.';
    const missing = this.missing(object);
    if (missing.length) return object.kind === 'extraction' ? 'Recover the Vault Core and defeat the Guardian before extracting.' : object.requires === 'vault' ? 'Open central vault access first.' : 'LOCKED / Required: ' + missing.map(id => ({ 'sector-console': 'sector hack', 'relay-a': 'relay A', 'relay-b': 'relay B', 'timed-access': 'phase link', 'guardian-defeated': 'Guardian defeat' }[id] ?? id)).join(' + ');
    const active = this.active.has(object.id);
    if (object.hack && !active) return 'Interact to isolate the terminal and match its access sequence. Combat pauses during hacking.';
    if (object.timed) return 'Timed phase link: activate WEST, then EAST within 3.5 seconds while OPEN. Check SECURITY LINK in the HUD.';
    if (object.id.startsWith('relay-')) return active ? 'RELAY ONLINE / Access latch retained.' : 'Interact to activate this vault access relay. Both relays are required.';
    if (object.kind === 'door') return active ? 'Open. Interact to close; occupied doors cannot close.' : 'Closed. Interact to open.';
    if (object.id === 'insertion-uplink') return active ? 'Local uplink active.' : 'Local uplink in standby.';
    if (object.kind === 'switch') return active ? 'Live-fire lane ACTIVE. Security pulses travel north. Interact to disable.' : 'Live-fire lane OFF. Interact to enable damage training.';
    if (object.kind === 'vault') return active ? 'Vault access open. Recover the core at the pedestal.' : 'Access authorized. Interact to open the vault.';
    if (object.kind === 'extraction') return this.extracted ? 'Extraction recorded locally. No competitive rewards.' : 'Core detected. Interact to complete THE LAUNCH.';
    if (object.id === 'med-station') return 'One field charge restores up to 25 HP. Cannot revive.';
    if (object.kind === 'collectible') return 'Interact to recover the training core.';
    return active ? 'Sector access authorized.' : 'Interact to authorize restricted sector access.';
  }
  interact(object: WorldObject, actor: { x: number; y: number }, health = 100): InteractionEvent | null {
    if (object.id === 'vault-gate' && this.blockers.some(b => b.id === 'guardian-lockdown' && b.enabled)) return null;
    if (health <= 0 || !this.reachable(object, actor) || this.missing(object).length || object.timed || object.hack && !this.validatedHacks.has(object.id)) return null;
    if (object.id === 'med-station' && (health >= 100 || health <= 0)) return null;
    const door = this.blockers.find(box => box.id === object.id && object.kind === 'door');
    if (door && this.active.has(object.id) && [actor, ...this.occupants].some(point => segmentBox(point.x, point.y, 0, 0, door, 20) === 0)) return null;
    if (object.kind === 'collectible' && this.active.has(object.id)) return null;
    if (object.kind === 'extraction') { if (this.extracted) return null; this.extracted = true; }
    if (object.kind === 'door' || object.kind === 'switch' || object.id === 'insertion-uplink') {
      if (this.active.has(object.id)) this.active.delete(object.id); else this.active.add(object.id);
    } else this.active.add(object.id);
    if (door) door.enabled = !this.active.has(object.id);
    if (object.kind === 'vault') { const solid = this.blockers.find(box => box.id === object.id); if (solid) solid.enabled = false; }
    const event = { serial: ++this.revision, objectId: object.id, kind: object.kind, active: this.active.has(object.id) };
    this.events.push(event); if (this.events.length > 32) this.events.shift();
    return event;
  }
}
