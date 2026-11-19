import {expect,it} from 'vitest';
import {NavigationGrid} from './navigation';
import {segmentBox,type Blocker} from '../combat/geometry';
class OriginalGrid extends NavigationGrid{
  override rebuild(){
    const free=Reflect.get(this,'free') as Uint8Array;
    for(let y=0;y<this.height;y++)for(let x=0;x<this.width;x++)free[y*this.width+x]=Number(!this.blockers.some(box=>box.enabled&&segmentBox((x+.5)*this.tile,(y+.5)*this.tile,0,0,box,this.radius)===0));
  }
}
it('produces identical occupancy and paths to the original grid, including boundary contacts and gate changes',()=>{
  let seed=42;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
  for(const radius of [0,18,46,92]){
    const blockers:Blocker[]=Array.from({length:45},(_,id)=>({id:String(id),x:random()*1400-100,y:random()*1400-100,width:random()*120+1,height:random()*120+1,enabled:random()>.2}));
    blockers.push({id:'exact-boundary',x:16,y:48,width:32,height:32,enabled:true});
    const grid=new NavigationGrid(40,38,32,blockers,radius),original=new OriginalGrid(40,38,32,blockers,radius);
    for(let round=0;round<2;round++){
      expect(Reflect.get(grid,'free')).toEqual(Reflect.get(original,'free'));
      for(let n=0;n<8;n++){const from={x:random()*1280,y:random()*1216},to={x:random()*1280,y:random()*1216};expect(grid.path(from,to)).toEqual(original.path(from,to));}
      blockers[0].enabled=!blockers[0].enabled;blockers[blockers.length-1].enabled=false;grid.rebuild();original.rebuild();
    }
  }
});
