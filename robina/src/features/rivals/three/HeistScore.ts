import type {GameSettings} from '../core/settings';

/** Original four-bar, 112 BPM D-minor score: analogue bass, suspended pads,
 * kick/snare/hi-hat groove and a separately mixed pursuit ostinato. Generated
 * once, not on a frame timer; no copyrighted recordings or network payload. */
export function composeHeistScore(sampleRate=22050){
  const seconds=16*60/112,length=Math.ceil(seconds*sampleRate),left=new Float32Array(length),right=new Float32Array(length),tension=new Float32Array(length);
  const roots=[73.416,58.27,65.406,55],arp=[0,7,12,7,3,7,10,7];let seed=7321,previous=0;
  for(let i=0;i<length;i++){
    const time=i/sampleRate,beat=time*112/60,bar=Math.min(3,Math.floor(beat/4)),root=roots[bar],quarter=beat%1,half=(beat*2)%1,sixteenth=(beat*4)%1;
    seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;const noise=(seed>>>0)/2147483648-1,high=noise-previous;previous=noise;
    const kickTime=(beat%2)*60/112,kick=Math.sin(2*Math.PI*(46*kickTime+2.8*(1-Math.exp(-kickTime*28))))*Math.exp(-kickTime*15)*.46;
    const snareTime=((beat+1)%2)*60/112,snare=(noise*.18+Math.sin(snareTime*2*Math.PI*185)*.11)*Math.exp(-snareTime*22);
    const hat=high*.025*Math.exp(-sixteenth*23),bassPhase=time*root*2*Math.PI;
    const bass=(Math.sin(bassPhase)+.27*Math.sin(bassPhase*2)+.12*Math.sin(bassPhase*3))*Math.exp(-half*3.2)*.17;
    const padEnvelope=Math.min(1,(beat%4)*5,(4-beat%4)*5),pad=(Math.sin(bassPhase*2)+Math.sin(bassPhase*2*1.189207)+Math.sin(bassPhase*3))*.038*padEnvelope;
    const note=root*4*2**(arp[Math.floor(beat*2)%8]/12),pulse=Math.sin(2*Math.PI*note*time)*Math.exp(-half*7)*.09;
    const edge=Math.max(0,Math.min(1,time/.025,(seconds-time)/.025)),mix=kick+snare+hat+bass+pad;
    left[i]=Math.tanh(mix)*.88*edge;right[i]=Math.tanh(mix-pad*.3+Math.sin(bassPhase*3+.18)*.012)*.88*edge;
    tension[i]=Math.tanh(pulse+Math.sin(bassPhase*4)*Math.exp(-quarter*8)*.055)*edge;
  }
  return{sampleRate,seconds,left,right,tension};
}

export class HeistScore {
  private master:GainNode;private pursuit:GainNode;private sources:AudioBufferSourceNode[]=[];
  private alert=false;private paused=false;private settings:GameSettings;private level=0;
  constructor(private context:AudioContext,settings:GameSettings){
    this.settings=settings;this.master=context.createGain();this.pursuit=context.createGain();this.master.connect(context.destination);this.pursuit.connect(this.master);this.pursuit.gain.value=0;
    const score=composeHeistScore(),base=context.createBuffer(2,score.left.length,score.sampleRate),alert=context.createBuffer(1,score.tension.length,score.sampleRate);
    base.getChannelData(0).set(score.left);base.getChannelData(1).set(score.right);alert.getChannelData(0).set(score.tension);
    const start=context.currentTime+.02;
    for(const [buffer,bus]of [[base,this.master],[alert,this.pursuit]] as const){const source=context.createBufferSource();source.buffer=buffer;source.loop=true;source.connect(bus);source.start(start);this.sources.push(source);}
    this.configure(settings);
  }
  configure(settings:GameSettings){this.settings=settings;this.level=this.paused||settings.muted?0:settings.masterVolume*settings.musicVolume*.7;this.master.gain.setTargetAtTime(this.level,this.context.currentTime,.08);}
  setAlert(active:boolean){if(this.alert===active)return;this.alert=active;this.pursuit.gain.setTargetAtTime(active?1:0,this.context.currentTime,.7);}
  duck(){if(!this.level)return;const now=this.context.currentTime;this.master.gain.cancelScheduledValues(now);this.master.gain.setTargetAtTime(this.level*.35,now,.008);this.master.gain.setTargetAtTime(this.level,now+.12,.1);}
  pause(paused:boolean){this.paused=paused;this.configure(this.settings);}
  dispose(){for(const source of this.sources){source.stop();source.disconnect();}this.sources=[];this.pursuit.disconnect();this.master.disconnect();}
}
