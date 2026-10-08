import * as T from 'three';
type Particle = { mesh: T.Mesh; velocity: T.Vector3; life: number; duration: number };
type Trace = { line: T.Line; life: number; positions: Float32Array };
export class CombatEffects {
  root = new T.Group(); readonly muzzleLight = new T.PointLight(0xffbc6a, 0, 5); private particles: Particle[] = []; private traces: Trace[] = []; private cursor = 0; private traceCursor = 0;
  constructor() {
    this.root.add(this.muzzleLight);
    const geometry = new T.BoxGeometry(.035, .035, .035);
    for (let i = 0; i < 100; i++) {
      const mesh = new T.Mesh(geometry, new T.MeshBasicMaterial({ color: 0xffc482, transparent: true })); mesh.visible = false; this.root.add(mesh);
      this.particles.push({ mesh, velocity: new T.Vector3(), life: 0, duration: 1 });
    }
    for (let i = 0; i < 32; i++) {
      const positions = new Float32Array(6), geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.BufferAttribute(positions, 3));
      const line = new T.Line(geometry, new T.LineBasicMaterial({ color: 0xffd6a0, transparent: true, opacity: .7 })); line.frustumCulled = false; line.visible = false; this.root.add(line);
      this.traces.push({ line, positions, life: 0 });
    }
  }
  tracer(start: T.Vector3, end: T.Vector3, enemy = false) {
    const trace = this.traces[this.traceCursor++ % this.traces.length]; start.toArray(trace.positions, 0); end.toArray(trace.positions, 3);
    trace.line.geometry.attributes.position.needsUpdate = true; (trace.line.material as T.LineBasicMaterial).color.setHex(enemy ? 0xd57750 : 0xffd8a0);
    trace.life = .08; trace.line.visible = true;
  }
  impact(position: T.Vector3, flesh = false, count = 8) {
    for (let i = 0; i < count; i++) {
      const particle = this.particles[this.cursor++ % this.particles.length]; particle.mesh.position.copy(position);
      particle.velocity.set((Math.random() - .5) * 4, Math.random() * 3, (Math.random() - .5) * 4);
      particle.life = particle.duration = .15 + Math.random() * .35; particle.mesh.visible = true; particle.mesh.scale.setScalar(flesh ? 1.7 : 1);
      (particle.mesh.material as T.MeshBasicMaterial).color.setHex(flesh ? 0xae6550 : 0xffc479);
    }
  }
  shell(position: T.Vector3, direction: T.Vector3) {
    const p = this.particles[this.cursor++ % this.particles.length]; p.mesh.position.copy(position); p.velocity.copy(direction).multiplyScalar(2.5); p.velocity.y = 1.8;
    p.life = p.duration = .65; p.mesh.visible = true; p.mesh.scale.set(1, 1, 2.5); (p.mesh.material as T.MeshBasicMaterial).color.setHex(0xb69558);
  }
  flash(position: T.Vector3) { this.muzzleLight.position.copy(position); this.muzzleLight.intensity = 8; }
  update(dt: number) {
    this.muzzleLight.intensity = Math.max(0, this.muzzleLight.intensity - dt * 120);
    for (const p of this.particles) if (p.life > 0) { p.life -= dt; p.mesh.position.addScaledVector(p.velocity, dt); p.velocity.y -= dt * 9; p.mesh.rotation.x += dt * 9; (p.mesh.material as T.MeshBasicMaterial).opacity = Math.max(0, p.life / p.duration); p.mesh.visible = p.life > 0 && p.mesh.position.y > 0; }
    for (const t of this.traces) if (t.life > 0) { t.life -= dt; t.line.visible = t.life > 0; }
  }
}
