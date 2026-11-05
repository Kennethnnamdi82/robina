import { clearSight, type NavigationGrid,type Point } from '../ai/navigation';
/** Throttled route search; a camera change never invalidates world navigation. */
export class MissionNavigation {
  route:Point[]=[];distance=0;goal:Point|undefined;private age=4;private key='';private origin?:Point;
  constructor(private foot:NavigationGrid,private vehicle:NavigationGrid){}
  update(dt:number,player:Point,goal:Point|undefined,driving:boolean){
    if(!goal){this.route=[];this.distance=0;this.goal=undefined;this.key='';this.origin=undefined;return;}
    this.goal={x:goal.x,y:goal.y};
    this.age+=Math.max(0,dt);const key=[Math.floor(goal.x/32),Math.floor(goal.y/32),driving].join(':'),grid=driving?this.vehicle:this.foot;
    // Advance a stable corridor instead of aiming at a grid cell already behind
    // the player until the next BFS. Camera orientation is not navigation state.
    while(this.route.length&&this.origin){const next=this.route[0],dx=next.x-this.origin.x,dy=next.y-this.origin.y,length=dx*dx+dy*dy;
      const passed=length>0&&((player.x-this.origin.x)*dx+(player.y-this.origin.y)*dy)/length>=1;
      if(Math.hypot(next.x-player.x,next.y-player.y)>22&&!passed)break;this.origin=this.route.shift();}
    const offRoute=this.route[0]&&!clearSight(player,this.route[0],grid.blockers,grid.radius);
    if(key!==this.key||offRoute||(!this.route.length&&Math.hypot(goal.x-player.x,goal.y-player.y)>28)||this.age>=4){
      this.age=0;this.key=key;this.origin={...player};const raw=clearSight(player,goal,grid.blockers,grid.radius)?[{...goal}]:grid.path(player,goal),smooth:Point[]=[];let from=player,index=0;
      while(index<raw.length){let furthest=index;for(let j=index+1;j<raw.length;j++){if(!clearSight(from,raw[j],grid.blockers,grid.radius))break;furthest=j;}const point=raw[furthest];smooth.push(point);from=point;index=furthest+1;}
      if(clearSight(from,goal,grid.blockers,grid.radius))smooth.push({...goal});
      this.route=smooth.filter((p,i)=>Math.hypot(p.x-(i?smooth[i-1].x:player.x),p.y-(i?smooth[i-1].y:player.y))>1);
    }
    this.distance=0;let previous=player;for(const point of this.route){this.distance+=Math.hypot(point.x-previous.x,point.y-previous.y)*.025;previous=point;}
  }
  get next(){return this.route[0]??this.goal;}
}
