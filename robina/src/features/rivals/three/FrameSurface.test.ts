import {describe,it,expect,vi} from 'vitest';
import {FrameSurface} from './FrameSurface';
import {AdaptiveResolution} from './AdaptiveResolution';

describe('uninterrupted camera presentation',()=>{
 it('resizes before drawing and never clears a completed world/weapon frame',()=>{
  const events:string[]=[],surface=new FrameSurface({setDrawingBufferSize:()=>events.push('resize')},()=>events.push('projection'));
  const draw=()=>{events.push('world');events.push('weapon');};
  surface.present(844,390,1,draw);surface.present(844,390,.75,draw);
  expect(events).toEqual(['resize','projection','world','weapon','resize','projection','world','weapon']);
  expect(events[events.length-1]).toBe('weapon');
 });
 it('does not clear the buffer for duplicate layout/resize notifications',()=>{
  const resize=vi.fn(),layout=vi.fn(),draw=vi.fn(),surface=new FrameSurface({setDrawingBufferSize:resize},layout);
  for(let i=0;i<10;i++)surface.present(844,390,1,draw);
  expect(resize).toHaveBeenCalledTimes(1);expect(layout).toHaveBeenCalledTimes(1);expect(draw).toHaveBeenCalledTimes(10);
 });
 it('preserves the existing image while the host is hidden or has invalid dimensions',()=>{
  const resize=vi.fn(),layout=vi.fn(),draw=vi.fn(),surface=new FrameSurface({setDrawingBufferSize:resize},layout);
  surface.present(844,390,1,draw);
  for(const dimensions of [[0,0,1],[844,0,1],[844,390,0],[NaN,390,1]])expect(surface.present(...dimensions as [number,number,number],draw)).toBe(false);
  expect(resize).toHaveBeenCalledTimes(1);expect(draw).toHaveBeenCalledTimes(1);
 });
 it('keeps every adaptive step fully rendered during sustained overload and recovery',()=>{
  const events:string[]=[],budget=new AdaptiveResolution(1,1),surface=new FrameSurface({setDrawingBufferSize:()=>events.push('resize')},()=>events.push('layout'));
  let scale=1;
  for(let i=0;i<1000;i++){
   const next=budget.sample(i<8?2:1/60);if(next!==undefined)scale=next;
   surface.present(844,390,scale,()=>events.push('render'));
   expect(events[events.length-1]).toBe('render');
  }
  expect(events.filter(e=>e==='resize').length).toBeGreaterThan(2);
  for(let i=0;i<events.length;i++)if(events[i]==='resize')expect(events.slice(i,i+3)).toEqual(['resize','layout','render']);
 });
});
