import '@testing-library/jest-dom/vitest';
import {cleanup,render,screen} from '@testing-library/react';
import {afterEach,expect,it} from 'vitest';
import {MissionLifeStatus} from './MissionLifeStatus';
afterEach(cleanup);
it('ignores recovery dates left by an older server and never displays a death countdown',()=>{
  const {container}=render(<MissionLifeStatus recoveryUntil="2099-11-14T12:00:00Z"/>);
  expect(container).toBeEmptyDOMElement();
});
it('preserves the separate reconnect message without imposing a death wait',()=>{
  render(<MissionLifeStatus recoveryUntil="2099-11-14T12:00:00Z" reconnecting/>);
  expect(screen.getByRole('status')).toHaveTextContent('Reconnecting to your operation.');
  expect(screen.getByRole('status')).toHaveTextContent('five minutes from your last checkpoint');
});
