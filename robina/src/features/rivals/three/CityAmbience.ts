import type { GameSettings } from '../core/settings';
/** Quiet generated traffic/wind bed, no downloads. Four bounded oscillators
 * share one optional context and obey the game's mute/pause/volume settings. */
export class CityAmbience {
  private context?:AudioContext;private master?:GainNode;private engine?:OscillatorNode;private horn?:GainNode;private paused=false;private disposed=false;private lastHorn=-30;
  constructor(private settings:GameSettings){document.addEventListener('pointerdown',this.unlock);document.addEventListener('keydown',this.unlock);}
  private unlock=()=>{
    if(this.disposed||this.settings.muted||this.paused)return;
    try{if(!this.context){
      const ctx=this.context=new AudioContext(),out=this.master=ctx.createGain();out.connect(ctx.destination);
      const noise=ctx.createBuffer(1,ctx.sampleRate*3,ctx.sampleRate),data=noise.getChannelData(0);let smooth=0;
      for(let i=0;i<data.length;i++){smooth=(smooth+(Math.random()*2-1)*.03)/1.03;data[i]=smooth;}
      const source=ctx.createBufferSource();source.buffer=noise;source.loop=true;const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=1100;const gain=ctx.createGain();gain.gain.value=.18;source.connect(filter);filter.connect(gain);gain.connect(out);source.start();
      this.engine=ctx.createOscillator();this.engine.type='triangle';this.engine.frequency.value=48;const engineGain=ctx.createGain();engineGain.gain.value=.018;this.engine.connect(engineGain);engineGain.connect(out);this.engine.start();
      this.horn=ctx.createGain();this.horn.gain.value=0;this.horn.connect(out);for(const frequency of [350,440]){const osc=ctx.createOscillator();osc.type='sine';osc.frequency.value=frequency;osc.connect(this.horn);osc.start();}
    }void this.context.resume().catch(()=>{});this.volume();}catch{/* Audio never gates gameplay. */}
  };
  private volume(){if(this.context&&this.master)this.master.gain.setTargetAtTime(this.paused||this.settings.muted?0:this.settings.masterVolume*this.settings.sfxVolume,this.context.currentTime,.15);}
  configure(settings:GameSettings){this.settings=settings;this.volume();if(!settings.muted)this.unlock();}
  pause(paused:boolean){this.paused=paused;this.volume();if(!paused)this.unlock();}
  update(time:number,speed:number,distance:number,waiting:boolean){
    const ctx=this.context;if(!ctx||ctx.state!=='running'||this.paused||this.settings.muted)return;
    this.engine?.frequency.setTargetAtTime(38+speed*7,ctx.currentTime,.3);
    if(waiting&&distance<25&&time-this.lastHorn>19&&this.horn){this.lastHorn=time;const gain=.027/(1+distance*.15);this.horn.gain.cancelScheduledValues(ctx.currentTime);this.horn.gain.setValueAtTime(0,ctx.currentTime);this.horn.gain.linearRampToValueAtTime(gain,ctx.currentTime+.025);this.horn.gain.setValueAtTime(gain,ctx.currentTime+.14);this.horn.gain.linearRampToValueAtTime(0,ctx.currentTime+.22);}
  }
  dispose(){this.disposed=true;document.removeEventListener('pointerdown',this.unlock);document.removeEventListener('keydown',this.unlock);void this.context?.close().catch(()=>{});}
}
