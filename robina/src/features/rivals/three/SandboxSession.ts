import { createOperation,type Operation3D } from './Operations';
import { ArenaSession } from '../core/session';
import { GameAudio } from '../audio/GameAudio';
import { CombatAudio } from './CombatAudio';
import { CityAmbience } from './CityAmbience';
import type { CityWeather } from './LivingCityPlan';
/** All progression lives in memory. Never call the account/practice persistence adapter. */
export class SandboxSession extends ArenaSession {
  blocked = false;
  audio?: GameAudio;
  combatAudio?: CombatAudio;
  cityAudio?:CityAmbience;
  cityLighting:CityWeather='golden';
  onCityLighting?:(preset:CityWeather)=>void;
  /** Called synchronously by ENTER/RESTART, inside the browser's audio gesture. */
  startAudio() { const settings = this.getSnapshot().settings; this.audio ??= new GameAudio(settings,false); this.combatAudio ??= new CombatAudio(settings);this.cityAudio??=new CityAmbience(settings); this.combatAudio.configure(settings);this.cityAudio.configure(settings); }
  override dispose() { this.audio?.dispose(); this.combatAudio?.dispose();this.cityAudio?.dispose(); super.dispose(); }
  override canControl = () => { const s = this.getSnapshot(); return s.status === 'playing' && s.health > 0 && !s.hack && s.boss?.state !== 'INTRO' && !this.blocked; };
  constructor(options: ConstructorParameters<typeof ArenaSession>[0] = {},readonly operation:Operation3D=createOperation()) { super({...options,missionDefinition:operation.mission}); this.input.aimShoots = true; }
  block(value: boolean) { this.blocked = value; if (value) this.clearInput(); this.update({}); }
  override publishMission = () => {
    const mission = this.mission.snapshot(); this.update({ mission,practiceSaved: false });
    if (['SUCCESS','FAILED','ABANDONED'].includes(mission.state) && this.getSnapshot().status === 'playing') { this.pause(); this.update({ status: 'finished' }); }
  };
}
