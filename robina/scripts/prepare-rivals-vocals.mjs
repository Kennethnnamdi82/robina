import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
const source=process.argv[2];if(!source)throw Error('Pass the extracted HaelDB source directory');
const results=[];
for(const [file,id,maximum]of [['3grunt1.wav','vocal-hurt',.7],['3yell9.wav','vocal-death-0',1.8],['3yell8.wav','vocal-death-1',1.5]]){
 const bytes=readFileSync(path.join(source,file));let channels=0,rate=0,bits=0,pcm,format=0;
 for(let i=12;i+8<=bytes.length;){const size=bytes.readUInt32LE(i+4),key=bytes.toString('ascii',i,i+4);if(key==='fmt '){format=bytes.readUInt16LE(i+8);channels=bytes.readUInt16LE(i+10);rate=bytes.readUInt32LE(i+12);bits=bytes.readUInt16LE(i+22);}if(key==='data')pcm=bytes.subarray(i+8,i+8+size);i+=8+size+(size%2);}
 if(format!==1||bits!==16||!pcm||!channels)throw Error('Expected signed 16-bit PCM: '+file);
 const mono=new Float32Array(pcm.length/(channels*2));for(let i=0;i<mono.length;i++)for(let c=0;c<channels;c++)mono[i]+=pcm.readInt16LE((i*channels+c)*2)/(32768*channels);
 let start=0,end=mono.length;while(start<end&&Math.abs(mono[start])<.025)start++;while(end>start&&Math.abs(mono[end-1])<.025)end--;
 start=Math.max(0,start-Math.floor(rate*.012));end=Math.min(end+Math.floor(rate*.025),mono.length,start+Math.floor(rate*maximum));
 let peak=.01;for(let i=start;i<end;i++)peak=Math.max(peak,Math.abs(mono[i]));
 const targetRate=22050,frames=Math.ceil((end-start)/rate*targetRate),out=Buffer.alloc(44+frames*2);
 out.write('RIFF');out.writeUInt32LE(out.length-8,4);out.write('WAVEfmt ',8);out.writeUInt32LE(16,16);out.writeUInt16LE(1,20);out.writeUInt16LE(1,22);out.writeUInt32LE(targetRate,24);out.writeUInt32LE(targetRate*2,28);out.writeUInt16LE(2,32);out.writeUInt16LE(16,34);out.write('data',36);out.writeUInt32LE(frames*2,40);
 for(let i=0;i<frames;i++){const t=start+i*rate/targetRate,index=Math.floor(t),v=(mono[index]??0)*(1-t+index)+(mono[index+1]??0)*(t-index),fade=Math.min(1,i/(targetRate*.008),(frames-i-1)/(targetRate*.02));out.writeInt16LE(Math.round(Math.max(-1,Math.min(1,v/peak*.8*fade))*32767),44+i*2);}
 writeFileSync('public/assets/rivals/combat3d/audio/'+id+'.wav',out);results.push({id,file,sourceSHA256:createHash('sha256').update(bytes).digest('hex'),bytes:out.length,seconds:frames/targetRate});
}
console.log(JSON.stringify(results,null,2));
