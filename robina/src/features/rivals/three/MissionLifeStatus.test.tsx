import '@testing-library/jest-dom/vitest';
import {act,cleanup,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {MissionLifeStatus} from './MissionLifeStatus';
afterEach(()=>{cleanup();vi.useRealTimers();});
it('shows a two-hour countdown and automatically displays recovered eligibility',()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-14T10:00:00Z'));
  render(<MissionLifeStatus recoveryUntil="2026-11-14T12:00:00Z"/>);
  expect(screen.getByRole('status')).toHaveTextContent('02:00:00');
  act(()=>{vi.advanceTimersByTime(3000);});expect(screen.getByRole('status')).toHaveTextContent('01:59:57');
  act(()=>{vi.advanceTimersByTime(7200000);});expect(screen.getByRole('status')).toHaveTextContent('Life recovered');
});
