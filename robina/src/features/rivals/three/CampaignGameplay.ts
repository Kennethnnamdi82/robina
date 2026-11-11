import { Vector3 } from 'three';
import { assignmentAt,type Assignment } from '../missions/assignments';
import type { MissionEngine } from '../missions/MissionEngine';
import type { WorldState } from '../world/WorldState';
import type { VehicleController } from './VehicleController';
import type { PolicePursuit } from './PolicePursuit';
import type { NavigationGrid,Point } from '../ai/navigation';
export class CampaignGameplay {
  readonly assignment:Assignment;carrying=false;cargoVehicle:number|null=null;message='';recovery=0;recoveredByPolice=false;
  holdProgress=0;holdActive=false;private holdEvent='';
  handoff:'none'|'waiting'|'complete'='none';guardsRemaining=0;
  readonly witness:Point;witnessMoving=false;witnessBoarded=false;private witnessPath:Point[]=[];private routeClock=0;
  constructor(index:number,readonly mission:MissionEngine,readonly world:WorldState,readonly vehicles:VehicleController,readonly police:PolicePursuit,private navigation:NavigationGrid){this.assignment=assignmentAt(index);this.witness={x:this.assignment.site.x*40,y:(this.assignment.site.z-2)*40};}
  step(dt:number,p:Vector3,livingGuards:number){
    if(this.mission.state==='FAILED'){this.recovery=Math.min(1,this.recovery+dt/2);return;}
    if(this.mission.state!=='ACTIVE')return;
    const a=this.assignment,car=this.vehicles.current,transport=this.vehicles.cars.find(c=>c.id===3);this.guardsRemaining=livingGuards;
    if(Math.hypot(p.x-a.site.x,p.z-a.site.z)<8&&(!a.bridge||Boolean(car))&&this.mission.event('site-entered')){if(a.id!=='reserve'&&a.id!=='archive')this.police.alert();this.message=a.bridge?'BRIDGE REACHED / DISMOUNT AND ELIMINATE THE ESCORT':a.id==='reserve'?'BANK OPEN / FIND THE MANAGER KEY / KEEP CIVILIANS SAFE':'SITE LOCATED / ACCESS PANEL OR SECURITY';}
    if(livingGuards===0)this.mission.event('site-secured');
    if(this.holdActive){
      const device=this.world.level.objects.find(o=>o.id===this.holdEvent);
      if(device&&Math.hypot(p.x-device.x*.025,p.z-device.y*.025)<6){
        this.holdProgress=Math.min(1,this.holdProgress+dt/(a.holdSeconds??12));this.message='HOLD THE SITE / '+Math.ceil((1-this.holdProgress)*(a.holdSeconds??12))+'s';
        if(this.holdProgress>=1){this.holdActive=false;this.mission.event(this.holdEvent);this.world.grantFlag(this.holdEvent);this.message='OPERATION COMPLETE / RECOVER THE OBJECTIVE';}
      }else this.message='PROCESS PAUSED / RETURN TO THE MARKED DEVICE';
    }
    if(a.id==='reserve'&&this.mission.completed.has('task-1')){const door=this.world.blockers.find(b=>b.id==='mission-vault-door');if(door?.enabled){door.enabled=false;this.world.revision++;}}
    if(a.convoy&&transport){
      for(const id of ['task-0','cargo-recovered']){const object=this.world.level.objects.find(o=>o.id===id);if(object){object.x=transport.x*40;object.y=transport.z*40;}}
      if((transport.health??200)<=0){this.mission.fail('The required cargo transport was destroyed.');return;}
      if(car===transport)this.mission.event('task-0');
    }
    if(this.carrying){
      if(a.vehicleDelivery&&car&&(!a.convoy||car.id===3)&&['van','lorry','tanker','bus'].includes(car.kind))this.cargoVehicle=car.id;
      if(this.cargoVehicle!==null&&(this.vehicles.cars.find(c=>c.id===this.cargoVehicle)?.health??0)<=0){this.mission.fail('The recovered shipment was destroyed with its transport.');return;}
      if(a.hostage){const d=Math.hypot(this.witness.x*.025-p.x,this.witness.y*.025-p.z);if(car&&d<4)this.witnessBoarded=true;if(!car&&this.witnessBoarded){this.witness.x=p.x*40;this.witness.y=p.z*40;this.witnessBoarded=false;}if(this.witnessBoarded){this.witness.x=p.x*40;this.witness.y=p.z*40;}else if(d>1.6){this.routeClock-=dt;if(this.routeClock<=0){this.witnessPath=this.navigation.path(this.witness,{x:p.x*40,y:p.z*40});this.routeClock=.8;}while(this.witnessPath.length&&Math.hypot(this.witnessPath[0].x-this.witness.x,this.witnessPath[0].y-this.witness.y)<12)this.witnessPath.shift();const goal=this.witnessPath[0];if(goal){const x=goal.x-this.witness.x,y=goal.y-this.witness.y,length=Math.hypot(x,y);this.navigation.move(this.witness,x/length*Math.min(length,150*dt),y/length*Math.min(length,150*dt));this.witnessMoving=true;}}else this.witnessMoving=false;}
      if(Math.hypot(p.x-a.extraction.x,p.z-a.extraction.z)<6&&!this.police.active)this.mission.event('extraction-approach');
    }
  }
  get destination(){const id=this.mission.snapshot().activeId,car=this.vehicles.cars.find(c=>c.id===3);return this.assignment.convoy&&car&&(id==='task-0'||id==='recover')?{x:car.x*40,y:car.z*40}:undefined;}
  interact(p:Vector3){
    if(this.mission.state!=='ACTIVE')return false;
    const activeId=this.mission.snapshot().activeId,objective=this.mission.definition.objectives.find(o=>o.id===activeId);
    const object=objective&&this.world.level.objects.find(o=>o.id===objective.event);if(!object||!objective||!this.world.reachable(object,{x:p.x*40,y:p.z*40}))return false;
    if(this.assignment.bridge&&objective.id==='security'){this.message='ELIMINATE THE BRIDGE SECURITY TEAM / '+this.guardsRemaining+' REMAINING';return true;}
    if(this.assignment.convoy&&objective.id==='task-0'&&this.vehicles.current?.id!==3){this.message='ENTER THE MARKED TRANSPORT TO INTERCEPT IT';return true;}
    if(objective.id==='extract'){
      if(!this.carrying){this.message='RECOVER THE OBJECTIVE FIRST';return true;}
      if(this.police.active){this.message='EXTRACTION COMPROMISED / BREAK POLICE LINE OF SIGHT';return true;}
      if(this.assignment.vehicleDelivery&&(this.cargoVehicle===null||this.vehicles.current?.id!==this.cargoVehicle)){this.message='DELIVER THE LOADED CARGO VEHICLE';return true;}
      if(this.assignment.hostage&&Math.hypot(this.witness.x*.025-p.x,this.witness.y*.025-p.z)>4){this.message='WAIT FOR YOUR WITNESS';return true;}
      if(this.assignment.bossHandoff){this.handoff='waiting';this.message='THE BROKER / HAND OVER THE CASE TO COLLECT YOUR SHARE';return true;}
      if(this.mission.event('extraction')){this.world.extracted=true;this.carrying=false;this.police.end();this.message='EXTRACTION CONFIRMED';}return true;
    }
    if(objective.id==='recover'){this.carrying=true;this.police.alert(true);}
    if(objective.id==='task-'+this.assignment.holdTask){if(!this.holdActive){this.holdActive=true;this.holdProgress=0;this.holdEvent=object.id;this.police.alert(true);}this.message='PROCESS STARTED / DEFEND THIS POSITION';return true;}
    if(objective.id.startsWith('task-'))this.police.alert();
    this.mission.event(object.id);this.world.grantFlag(object.id);this.message=objective.title.toUpperCase()+' / CONFIRMED';return true;
  }
  completeHandoff(){
    if(this.handoff!=='waiting'||!this.carrying||this.police.active||this.mission.snapshot().activeId!=='extract')return false;
    if(!this.mission.event('extraction'))return false;
    this.handoff='complete';this.world.extracted=true;this.carrying=false;this.police.end();this.message='THE BROKER ACCEPTED THE DELIVERY / YOUR SHARE IS PAID';return true;
  }
  get snapshot(){return{carrying:this.carrying,cargoVehicle:this.cargoVehicle,message:this.message,handoff:this.handoff,guardsRemaining:this.guardsRemaining,holdActive:this.holdActive,holdProgress:this.holdProgress,holdSeconds:this.assignment.holdSeconds??0,recovery:this.recovery,recoveredByPolice:this.recoveredByPolice,witness:this.assignment.hostage?{...this.witness,boarded:this.witnessBoarded}:null};}
}
