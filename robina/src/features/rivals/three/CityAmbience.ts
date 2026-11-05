import type { GameSettings } from '../core/settings';
import {HeistScore} from './HeistScore';
/** Quiet generated traffic/wind bed, no downloads. Four bounded oscillators
 * share one optional context and obey the game's mute/pause/volume settings. */
export class CityAmbience {
  private context?:AudioContext;private master?:GainNode;private engine?:OscillatorNode;private engineGain?:GainNode;private rolling?:GainNode;private horn?:GainNode;private paused=false;private disposed=false;private lastHorn=-30;
  private crashNoise?:AudioBuffer;
  private score?:HeistScore;
  constructor(private settings:GameSettings){document.addEventListener('pointerdown',this.unlock);document.addEventListener('keydown',this.unlock);}
  private unlock=()=>{
    if(this.disposed||this.settings.muted||this.paused)return;
    try{if(!this.context){
      const ctx=this.context=new AudioContext(),out=this.master=ctx.createGain();out.connect(ctx.destination);
      const noise=ctx.createBuffer(1,ctx.sampleRate*3,ctx.sampleRate),data=noise.getChannelData(0);let smooth=0;
      for(let i=0;i<data.length;i++){smooth=(smooth+(Math.random()*2-1)*.03)/1.03;data[i]=smooth;}
      const source=ctx.createBufferSource();source.buffer=noise;source.loop=true;const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=1100;const gain=ctx.createGain();gain.gain.value=.18;source.connect(filter);filter.connect(gain);gain.connect(out);source.start();
      this.engine=ctx.createOscillator();this.engine.frequency.value=48;
      const real=new Float32Array(16),imag=new Float32Array(16);for(let i=1;i<16;i++)imag[i]=(i%2?.65:1)/i**1.25;
      this.engine.setPeriodicWave(ctx.createPeriodicWave(real,imag));const engineGain=this.engineGain=ctx.createGain();engineGain.gain.value=.012;const engineFilter=ctx.createBiquadFilter();engineFilter.type='lowpass';engineFilter.frequency.value=850;this.engine.connect(engineFilter);engineFilter.connect(engineGain);engineGain.connect(out);this.engine.start();
      const tire=ctx.createBiquadFilter();tire.type='bandpass';tire.frequency.value=430;tire.Q.value=.5;this.rolling=ctx.createGain();this.rolling.gain.value=0;source.connect(tire);tire.connect(this.rolling);this.rolling.connect(out);
      this.crashNoise=ctx.createBuffer(1,ctx.sampleRate*.75,ctx.sampleRate);const crash=this.crashNoise.getChannelData(0);let seed=419;for(let i=0;i<crash.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const t=i/ctx.sampleRate;crash[i]=(seed/0xffffffff*2-1)*Math.exp(-t*9);}
      this.horn=ctx.createGain();this.horn.gain.value=0;this.horn.connect(out);for(const frequency of [350,440]){const osc=ctx.createOscillator();osc.type='sine';osc.frequency.value=frequency;osc.connect(this.horn);osc.start();}
    }if(this.settings.musicVolume>0&&!this.score)this.score=new HeistScore(this.context,this.settings);void this.context.resume().catch(()=>{});this.volume();}catch{/* Audio never gates gameplay. */}
  };
  private volume(){if(this.context&&this.master)this.master.gain.setTargetAtTime(this.paused||this.settings.muted?0:this.settings.masterVolume*this.settings.sfxVolume,this.context.currentTime,.15);}
  configure(settings:GameSettings){this.settings=settings;this.volume();this.score?.configure(settings);if(!settings.muted)this.unlock();}
  pause(paused:boolean){this.paused=paused;this.volume();this.score?.pause(paused);if(paused)void this.context?.suspend().catch(()=>{});else this.unlock();}
  duck(){this.score?.duck();}
  update(time:number,speed:number,distance:number,waiting:boolean,alert=false,driving?:{speed:number;throttle:number}){
    const ctx=this.context;if(!ctx||ctx.state!=='running'||this.paused||this.settings.muted)return;
    this.score?.setAlert(alert);const velocity=Math.abs(driving?.speed??speed),load=Math.min(1,Math.abs(driving?.throttle??0));
    this.engine?.frequency.setTargetAtTime(driving?45+velocity*5.2+load*18:38+velocity*3,ctx.currentTime,.12);
    this.engineGain?.gain.setTargetAtTime(driving?.065+load*.015:.012/(1+distance*.1),ctx.currentTime,.15);
    this.rolling?.gain.setTargetAtTime(driving?Math.min(.15,velocity*.007):0,ctx.currentTime,.2);
    if(waiting&&distance<25&&time-this.lastHorn>19&&this.horn){this.lastHorn=time;const gain=.027/(1+distance*.15);this.horn.gain.cancelScheduledValues(ctx.currentTime);this.horn.gain.setValueAtTime(0,ctx.currentTime);this.horn.gain.linearRampToValueAtTime(gain,ctx.currentTime+.025);this.horn.gain.setValueAtTime(gain,ctx.currentTime+.14);this.horn.gain.linearRampToValueAtTime(0,ctx.currentTime+.22);}
  }
  crash(speed:number,distance=0,pan=0){
    const ctx=this.context;if(!ctx||!this.master||!this.crashNoise||this.paused||this.settings.muted||ctx.state!=='running')return;
    const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain(),stereo=ctx.createStereoPanner();source.buffer=this.crashNoise;filter.type='lowpass';filter.frequency.value=1800;gain.gain.value=Math.min(.7,speed*.045)/(1+distance*.15);stereo.pan.value=Math.max(-.9,Math.min(.9,pan));source.connect(filter);filter.connect(gain);gain.connect(stereo);stereo.connect(this.master);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();stereo.disconnect();};source.start();
  }
  dispose(){this.disposed=true;document.removeEventListener('pointerdown',this.unlock);document.removeEventListener('keydown',this.unlock);this.score?.dispose();void this.context?.close().catch(()=>{});}
}
