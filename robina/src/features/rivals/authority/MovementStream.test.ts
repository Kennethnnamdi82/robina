import {describe,expect,it} from 'vitest';
import {MovementStream,packMovement,type MovementCommand} from './MovementStream';
const command:MovementCommand={x:1,y:0,aimX:1,aimY:0,aiming:false,sprint:false,dodge:false,
  jump:false,jumpHeld:false,highJump:false,throttle:0,steer:0,brake:false,stickX:0,stickY:0,cameraYaw:0};
describe('authoritative movement stream',()=>{
  it('consumes each step in order and acknowledges simulation, not packet arrival',()=>{
    const stream=new MovementStream(),frames=Array.from({length:12},(_,i)=>packMovement(i+1,{...command,x:i<6?1:-1}));
    stream.accept({epoch:0,frames});expect(stream.snapshot.ack).toBeNull();
    // Initial cushion is bounded even if the player stops sending inputs.
    for(let i=0;i<15;i++)stream.step();
    for(let i=0;i<12;i++){expect(stream.step().x).toBe(i<6?1:-1);expect(stream.snapshot.ack).toBe(i+1);}
  });
  it('does not repeat jump or dodge when holding an input across missing packets',()=>{
    const stream=new MovementStream();stream.accept({epoch:0,frames:[packMovement(1,{...command,dodge:true,jump:true,highJump:true})]});
    for(let i=0;i<6;i++)stream.step();
    expect(stream.step()).toMatchObject({dodge:true,jump:true,highJump:true});
    expect(stream.step()).toMatchObject({x:1,dodge:false,jump:false,highJump:false});
    stream.accept({epoch:0,frames:[packMovement(1,{...command,dodge:true,jump:true})]});
    expect(stream.step()).toMatchObject({dodge:false,jump:false});
  });
  it('invalidates in-flight movement on pause, timeout or vehicle transition',()=>{
    const stream=new MovementStream();stream.accept({epoch:0,frames:[packMovement(1,command)]});stream.reset();
    const epoch=stream.snapshot.epoch;expect(epoch).toBe(1);stream.reset();expect(stream.snapshot.epoch).toBe(epoch);
    stream.accept({epoch:0,frames:[packMovement(2,command)]});
    for(let i=0;i<30;i++)expect(stream.step().x).toBe(0);
    expect(stream.snapshot.ack).toBeNull();
    stream.accept({epoch,frames:[packMovement(1,{...command,x:-1})]});
    for(let i=0;i<6;i++)stream.step();expect(stream.step().x).toBe(-1);expect(stream.snapshot.ack).toBe(1);
  });
  it('client tick jumps cannot grant distance or skip authoritative time',()=>{
    const stream=new MovementStream();stream.accept({epoch:0,frames:[packMovement(1,command),packMovement(1000000,command)]});
    for(let i=0;i<6;i++)stream.step();
    for(let i=0;i<60;i++)stream.step();expect(stream.snapshot.ack).toBe(60);
    expect(stream.step()).not.toHaveProperty('fire');expect(stream.step()).not.toHaveProperty('damage');
  });
});
