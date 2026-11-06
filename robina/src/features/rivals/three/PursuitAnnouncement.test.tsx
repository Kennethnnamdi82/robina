import {cleanup,render,screen} from '@testing-library/react';
import {afterEach,describe,expect,it} from 'vitest';
import type {Diagnostics3D} from './RaidRuntime';
import {PursuitAnnouncement} from './PursuitAnnouncement';

afterEach(cleanup);
describe('nonvisual pursuit announcements',()=>{
  it('does not render the obstructing instruction card during normal exploration',()=>{
    const view=render(<PursuitAnnouncement/>);
    expect(screen.getByRole('status').textContent).toBe('');
    expect(view.container.querySelector('aside,.r3-dispatch')).toBeNull();
  });
  it('preserves police radio announcements without a visual panel',()=>{
    const metrics={pursuit:{active:true,units:3,evading:2}} as Diagnostics3D;
    render(<PursuitAnnouncement metrics={metrics}/>);
    expect(screen.getByRole('status').textContent).toBe('POLICE RESPONSE / 3 UNITS / BREAKING CONTACT');
    expect(screen.getByRole('status').className).toBe('r3-announcement');
  });
});
