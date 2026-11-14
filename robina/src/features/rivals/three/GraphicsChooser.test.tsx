import {afterEach,describe,it,expect,vi} from 'vitest';
import {cleanup,render,screen,fireEvent} from '@testing-library/react';
import {GraphicsChooser,GRAPHICS_KEY,readGraphicsQuality,saveGraphicsQuality} from './GraphicsChooser';
afterEach(()=>{cleanup();localStorage.removeItem(GRAPHICS_KEY);vi.restoreAllMocks();});
describe('visible graphics presets',()=>{
 it('offers Low, Medium and High and reports the chosen preset',()=>{const change=vi.fn();render(<GraphicsChooser value="balanced" onChange={change}/>);expect(screen.getByRole('button',{name:'MEDIUM graphics'}).getAttribute('aria-pressed')).toBe('true');for(const [label,value]of [['LOW','low'],['MEDIUM','balanced'],['HIGH','high']]){fireEvent.click(screen.getByRole('button',{name:label+' graphics'}));expect(change).toHaveBeenLastCalledWith(value);}});
 it('remembers manual choices and rejects stale invalid values',()=>{for(const value of ['low','balanced','high'] as const){saveGraphicsQuality(value);expect(readGraphicsQuality()).toBe(value);}localStorage.setItem(GRAPHICS_KEY,'ultra');expect(readGraphicsQuality()).toBe('high');});
 it('starts at full visual quality without silently downgrading touch devices',()=>{vi.spyOn(navigator,'hardwareConcurrency','get').mockReturnValue(2);Object.defineProperty(navigator,'maxTouchPoints',{value:2,configurable:true});expect(readGraphicsQuality()).toBe('high');saveGraphicsQuality('low');expect(readGraphicsQuality()).toBe('low');Object.defineProperty(navigator,'maxTouchPoints',{value:0,configurable:true});});
});
