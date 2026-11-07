import type {GameSettings} from '../core/settings';

export const HEIST_SCORE = {title:'BLACKOUT',bpm:128,bars:8} as const;

/** Original eight-bar cinematic/industrial cue. A D pedal, minor-second
 * tension, low strings and a repeating rhythmic motif replace the bright,
 * constantly changing arpeggio. Pursuit adds double-time percussion/strings,
 * not an unrelated song. Rendered once; no downloads or per-frame synth work. */
export function composeHeistScore(sampleRate=22050){
  const {bpm,bars}=HEIST_SCORE,seconds=bars*4*60/bpm,length=Math.ceil(seconds*sampleRate),left=new Float32Array(length),right=new Float32Array(length),tension=new Float32Array(length);
  const beatSeconds=60/bpm,root=36.70809599,motif=[0,0,12,7,0,1,12,7],hits=[1,0,0,.55,0,0,1,0,1,0,.55,0,0,0,.8,0];let seed=7321,previous=0;
  for(let i=0;i<length;i++){
    const time=i/sampleRate,beat=time/beatSeconds,bar=Math.min(bars-1,Math.floor(beat/4)),quarter=beat%1,eighth=(beat*2)%1,sixteenth=(beat*4)%1;
    seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;const noise=(seed>>>0)/2147483648-1,high=noise-previous;previous=noise;
    const kickTime=quarter*beatSeconds,kick=Math.sin(2*Math.PI*(42*kickTime+2.2*(1-Math.exp(-kickTime*35))))*Math.exp(-kickTime*19)*.43*(Math.floor(beat)%4===3?.6:1);
    const snareTime=((beat+1)%2)*beatSeconds,snare=(noise*.2+Math.sin(snareTime*2*Math.PI*167)*.14)*Math.exp(-snareTime*20);
    const bassPhase=time*root*2*Math.PI,sidechain=.5+.5*(1-Math.exp(-quarter*8));
    const bass=(Math.sin(bassPhase)+.3*Math.sin(bassPhase*2)+.12*Math.sin(bassPhase*3))*sidechain*.24;
    // One harmonic field throughout, with dissonance swelling only at the
    // end of the phrase. Local note phase prevents arbitrary attack jumps.
    const swell=Math.sin(Math.PI*(beat%8)/8)**2,dissonance=bar>=6?.025*swell:0;
    const drone=(Math.sin(bassPhase*2)+.45*Math.sin(bassPhase*3)+.25*Math.sin(bassPhase*2.378414))*.052;
    const suspense=Math.sin(bassPhase*4.237852)*dissonance;
    const note=root*4*2**(motif[Math.floor(beat*2)%8]/12),phase=2*Math.PI*note*eighth*beatSeconds/2;
    const bow=(Math.sin(phase)+.32*Math.sin(phase*2)+.13*Math.sin(phase*3))*Math.min(1,eighth*30)*Math.exp(-eighth*5.5);
    const lowPulse=bow*.075*(Math.floor(beat*2)%8===5?.6:1);
    const metal=high*.019*Math.exp(-sixteenth*24);
    const tomTime=sixteenth*beatSeconds/4,tom=Math.sin(2*Math.PI*(79*tomTime+.8*(1-Math.exp(-tomTime*50))))*Math.exp(-tomTime*30)*hits[Math.floor(beat*4)%16]*.2;
    const rush=noise*.027*(beat%4>3?(beat%1)**2:0);
    const edge=Math.max(0,Math.min(1,time/.025,(seconds-time)/.025)),mix=kick+snare+bass+drone+lowPulse+suspense;
    left[i]=Math.tanh(mix+metal)*.7*edge;right[i]=Math.tanh(mix-metal*.5+Math.sin(bassPhase*3+.22)*.014)*.7*edge;
    tension[i]=Math.tanh(bow*.24+tom+high*.037*Math.exp(-sixteenth*28)+rush)*.38*edge;
  }
  return{...HEIST_SCORE,sampleRate,seconds,left,right,tension};
}

export class HeistScore {
  private master:GainNode;private pursuit:GainNode;private sources:AudioBufferSourceNode[]=[];
  private alert=false;private paused=false;private settings:GameSettings;private level=0;
  constructor(private context:AudioContext,settings:GameSettings){
    this.settings=settings;this.master=context.createGain();this.master.gain.value=0;this.pursuit=context.createGain();this.master.connect(context.destination);this.pursuit.connect(this.master);this.pursuit.gain.value=0;
    const score=composeHeistScore(),base=context.createBuffer(2,score.left.length,score.sampleRate),alert=context.createBuffer(1,score.tension.length,score.sampleRate);
    base.getChannelData(0).set(score.left);base.getChannelData(1).set(score.right);alert.getChannelData(0).set(score.tension);
    const start=context.currentTime+.02;
    for(const [buffer,bus]of [[base,this.master],[alert,this.pursuit]] as const){const source=context.createBufferSource();source.buffer=buffer;source.loop=true;source.connect(bus);source.start(start);this.sources.push(source);}
    this.configure(settings);
  }
  configure(settings:GameSettings){this.settings=settings;this.level=this.paused||settings.muted?0:settings.masterVolume*settings.musicVolume*.7;this.master.gain.setTargetAtTime(this.level,this.context.currentTime,.08);}
  setAlert(active:boolean){if(this.alert===active)return;this.alert=active;this.pursuit.gain.setTargetAtTime(active?1:0,this.context.currentTime,.7);}
  duck(){if(!this.level)return;const now=this.context.currentTime;this.master.gain.cancelScheduledValues(now);this.master.gain.setTargetAtTime(this.level*.6,now,.008);this.master.gain.setTargetAtTime(this.level,now+.07,.08);}
  pause(paused:boolean){this.paused=paused;this.configure(this.settings);}
  dispose(){for(const source of this.sources){source.stop();source.disconnect();}this.sources=[];this.pursuit.disconnect();this.master.disconnect();}
}
