import type { NavigationGrid,Point } from '../ai/navigation';
/** Throttled route search; a camera change never invalidates world navigation. */
export class MissionNavigation {
  route:Point[]=[];distance=0;goal:Point|undefined;private age=1;private key='';
  constructor(private foot:NavigationGrid,private vehicle:NavigationGrid){}
  update(dt:number,player:Point,goal:Point|undefined,driving:boolean){
    if(!goal){this.route=[];this.distance=0;this.goal=undefined;return;}
    this.goal={x:goal.x,y:goal.y};
    this.age+=dt;const key=[Math.floor(goal.x/32),Math.floor(goal.y/32),driving].join(':');
    if(this.age<.65&&key===this.key)return;this.age=0;this.key=key;
    this.route=(driving?this.vehicle:this.foot).path(player,goal);
    this.distance=0;let previous=player;for(const point of this.route){this.distance+=Math.hypot(point.x-previous.x,point.y-previous.y)*.025;previous=point;}
  }
}
