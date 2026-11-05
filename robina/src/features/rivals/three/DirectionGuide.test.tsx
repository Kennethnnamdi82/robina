import { cleanup,render,screen } from '@testing-library/react';
import { afterEach,describe,it,expect } from 'vitest';
import { DirectionGuide } from './DirectionGuide';
import type { Diagnostics3D } from './RaidRuntime';
afterEach(cleanup);
describe('stable objective bearing',()=>{
  it('takes the short two-degree turn across north instead of spinning 358 degrees',()=>{
    const metrics=(degrees:number)=>({navigation:{goal:{x:400,y:400},route:[],distance:12,bearing:degrees*Math.PI/180}} as Diagnostics3D);
    const view=render(<DirectionGuide metrics={metrics(179)}/>);view.rerender(<DirectionGuide metrics={metrics(-179)}/>);
    expect(screen.getByRole('img',{name:'Red direction arrow'}).style.transform).toBe('rotate(181deg)');
  });
});
