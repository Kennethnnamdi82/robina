import '@testing-library/jest-dom/vitest';
import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {afterEach,describe,expect,it,vi} from 'vitest';
const leaderboard = vi.hoisted(() => vi.fn());
vi.mock('@/services/missions', () => ({ missionsApi: { leaderboard } }));
import LeaderboardPage from './LeaderboardPage';
import {emptyDossier,OPERATIONS,type HeistRecord} from './model';
afterEach(cleanup);
const run=(id:string,venue:number,seconds:number,state:HeistRecord['state']='SUCCESS'):HeistRecord=>({runId:id,venue,seconds,state,finishedAt:1000,completed:6,mandatory:6,objectives:[],kills:3,shots:12,hits:6});
describe('focused leaderboard',()=>{
  it('defaults to actual personal results and groups repeat runs by contract',()=>{
    const dossier={...emptyDossier(),records:[run('a',0,150),run('b',0,100),run('c',1,200),run('fail',2,100,'FAILED')]};
    render(<MemoryRouter><LeaderboardPage dossier={dossier}/></MemoryRouter>);
    const rows=within(screen.getByRole('list',{name:'Personal contract rankings'})).getAllByRole('listitem');expect(rows).toHaveLength(2);expect(rows[0]).toHaveTextContent(OPERATIONS[0].name);expect(rows[0]).toHaveTextContent('01:40');
    expect(screen.queryByText('NIGHTFALL')).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox',{name:'Search leaderboard'}),{target:{value:OPERATIONS[1].name}});expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(1);
    fireEvent.change(screen.getByRole('textbox',{name:'Search leaderboard'}),{target:{value:'not a contract'}});expect(screen.getByText('TRY ANOTHER SEARCH')).toBeInTheDocument();
  });
  it('shows only verified backend results, with no fictional fixtures',async()=>{
    leaderboard.mockResolvedValue({items:[{missionId:'assignment-reserve',score:9550,durationSeconds:300,verifiedAt:'2026-01-01T00:00:00Z',player:'0x1234…5678'}]});
    render(<MemoryRouter><LeaderboardPage dossier={emptyDossier()}/></MemoryRouter>);expect(screen.getByText('SET THE FIRST BENCHMARK.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'VERIFIED STANDINGS'}));
    await waitFor(()=>expect(screen.getByText('0x1234…5678')).toBeInTheDocument());
    expect(screen.queryByText('NIGHTFALL')).not.toBeInTheDocument();
    expect(within(screen.getByRole('list',{name:'Verified mission rankings'})).getAllByRole('listitem')).toHaveLength(1);
    fireEvent.change(screen.getByRole('combobox',{name:'Rank by'}),{target:{value:'best'}});
    fireEvent.click(screen.getByRole('button',{name:'MY RECORDED RUNS'}));expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});
