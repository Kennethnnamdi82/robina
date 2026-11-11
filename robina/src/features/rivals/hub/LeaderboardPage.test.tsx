import '@testing-library/jest-dom/vitest';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {afterEach,describe,expect,it} from 'vitest';
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
  it('keeps exhibition secondary, labelled fictional, searchable and sortable',()=>{
    render(<MemoryRouter><LeaderboardPage dossier={emptyDossier()}/></MemoryRouter>);expect(screen.getByText('SET THE FIRST BENCHMARK.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'EXHIBITION STANDINGS'}));expect(screen.getByText(/Exhibition players are fictional/)).toBeInTheDocument();
    const before=within(screen.getByRole('list')).getAllByRole('listitem').length;expect(before).toBeGreaterThan(3);
    fireEvent.change(screen.getByRole('combobox',{name:'Rank by'}),{target:{value:'best'}});expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(before);
    fireEvent.click(screen.getByRole('button',{name:'MY RECORDED RUNS'}));expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});
