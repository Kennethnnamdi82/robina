import { createOperation,type Operation3D } from './Operations';
import { ArenaSession } from '../core/session';
import { GameAudio } from '../audio/GameAudio';
import { CombatAudio } from './CombatAudio';
import { CityAmbience } from './CityAmbience';
import type { CityWeather } from './LivingCityPlan';
import { createPlayerEconomy, type PlayerEconomy } from '../progression/PlayerEconomy';
/** Fictional campaign rewards use the profile-local economy, never account/bounty APIs. */
export class SandboxSession extends ArenaSession {
  blocked = false;
  revivePending=false;reviveSerial=0;
  audio?: GameAudio;
  combatAudio?: CombatAudio;
  cityAudio?:CityAmbience;
  cityLighting:CityWeather='golden';
  onCityLighting?:(preset:CityWeather)=>void;
  /** Called synchronously by ENTER/RESTART, inside the browser's audio gesture. */
  startAudio() { const settings = this.getSnapshot().settings; this.audio ??= new GameAudio(settings,false); this.combatAudio ??= new CombatAudio(settings);this.cityAudio??=new CityAmbience(settings); this.combatAudio.configure(settings);this.cityAudio.configure(settings); }
  override dispose() { this.audio?.dispose(); this.combatAudio?.dispose();this.cityAudio?.dispose(); super.dispose(); }
  override canControl = () => { const s = this.getSnapshot(); return s.status === 'playing' && s.health > 0 && !s.hack && s.boss?.state !== 'INTRO' && !this.blocked&&!this.revivePending; };
  constructor(options: ConstructorParameters<typeof ArenaSession>[0] = {},readonly operation:Operation3D=createOperation(),readonly economy:PlayerEconomy=createPlayerEconomy(null)) { super({...options,missionDefinition:operation.mission}); this.input.aimShoots = true; }
  offerRevive(){if(this.revivePending)return;this.revivePending=true;this.reviveSerial++;this.pause();this.update({health:0});}
  block(value: boolean) { this.blocked = value; if (value) this.clearInput(); this.update({}); }
  override publishMission = () => {
    const mission = this.mission.snapshot();
    if(mission.state==='SUCCESS'&&this.operation.assignment!==undefined)this.economy.award(mission.runId,this.operation.assignment);
    this.update({ mission,practiceSaved: false });
    if (['SUCCESS','FAILED','ABANDONED'].includes(mission.state) && ['playing','paused'].includes(this.getSnapshot().status)) { this.revivePending=false;this.pause(); this.update({ status: 'finished' }); }
  };
}
