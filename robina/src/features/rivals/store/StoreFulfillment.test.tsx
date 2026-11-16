import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {payments,type StoreSnapshot} from '@/services/payments';
import {StoreIdentity} from './StoreIdentity';
import StorePage from './StorePage';
import SeasonRewards from './SeasonRewards';
import FounderIdentity from './FounderIdentity';
vi.mock('@/services/payments',async original=>({...await original<typeof import('@/services/payments')>(),payments:{store:vi.fn(),checkout:vi.fn(),check:vi.fn(),equip:vi.fn(),claim:vi.fn()}}));
const state:StoreSnapshot={ownedIds:[],equippedIds:[],grenadeBalance:5,recoveryUntil:null,serverTime:new Date().toISOString(),spendingBlocked:false,purchases:[],configured:true,environment:'sandbox',catalog:[{id:'starter',name:'STARTER SOLDIER PACK',kind:'bundle',cents:599,currency:'USD',enabled:true},{id:'urban',name:'URBAN SOLDIER',kind:'character',cents:299,currency:'USD',enabled:true}]};
function mount(child:React.ReactNode,path='/store/bundles'){return render(<StoreIdentity.Provider value="test-player"><MemoryRouter initialEntries={[path]}>{child}</MemoryRouter></StoreIdentity.Provider>);}
beforeEach(()=>{sessionStorage.clear();vi.resetAllMocks();vi.mocked(payments.store).mockResolvedValue(state);});afterEach(cleanup);
describe('completed collection fulfillment UI',()=>{
  it('loads the real catalog and offers pack checkout, delivery confirmation and equip',async()=>{
    const pending={id:'0123456789abcdef01234567',sku:'starter',name:'STARTER SOLDIER PACK',cents:599,currency:'USD' as const,environment:'sandbox' as const,status:'pending' as const,createdAt:new Date().toISOString()};
    vi.mocked(payments.checkout).mockResolvedValue(pending);vi.mocked(payments.check).mockResolvedValue({...pending,status:'fulfilled'});vi.mocked(payments.equip).mockResolvedValue({});
    mount(<StorePage/>);await waitFor(()=>expect(payments.store).toHaveBeenCalled());fireEvent.click(screen.getByRole('button',{name:'Details for STARTER SOLDIER PACK'}));
    const review=await screen.findByRole('button',{name:'REVIEW SELECTION'});expect(review.hasAttribute('disabled')).toBe(false);fireEvent.click(review);
    const confirm=await screen.findByRole('button',{name:/CONFIRM \/ CONTINUE/});await waitFor(()=>expect(confirm.hasAttribute('disabled')).toBe(false));fireEvent.click(confirm);await screen.findByText('PAYMENT STATUS / PENDING');
    fireEvent.click(screen.getByRole('button',{name:'CHECK PAYMENT STATUS'}));await screen.findByText('PURCHASE CONFIRMED');fireEvent.click(screen.getByRole('button',{name:'EQUIP PACK CONTENTS'}));await waitFor(()=>expect(payments.equip).toHaveBeenCalledWith('starter',undefined));
  },15000);
  it('equips an owned soldier through the authenticated outfit slot',async()=>{
    vi.mocked(payments.store).mockResolvedValue({...state,ownedIds:['urban']});vi.mocked(payments.equip).mockResolvedValue({});mount(<StorePage/>,'/inventory');
    fireEvent.click(await screen.findByRole('button',{name:'Details for URBAN SOLDIER'}));fireEvent.click(screen.getByRole('button',{name:'EQUIP FOR NEXT DEPLOYMENT'}));await waitFor(()=>expect(payments.equip).toHaveBeenCalledWith('urban','outfit'));
  });
  it('shows founder identity only from the server-owned equipped selection',async()=>{
    const view=mount(<FounderIdentity/>);await waitFor(()=>expect(payments.store).toHaveBeenCalled());expect(screen.queryByLabelText('Verified founder identity')).toBeNull();
    vi.mocked(payments.store).mockResolvedValue({...state,ownedIds:['founder'],appearance:{identity:'founder'}});fireEvent(window,new Event('focus'));await screen.findByLabelText('Verified founder identity');view.unmount();
  });
  it('claims unlocked free rewards and keeps premium rewards locked without a pass',async()=>{
    vi.mocked(payments.store).mockResolvedValue({...state,season:{_id:'season-a',name:'Owner campaign',startsAt:new Date().toISOString(),endsAt:new Date(Date.now()+86400000).toISOString(),status:'published',wins:1,hasPass:false,free:[{id:'one',sku:'urban',wins:1,claimed:false}],premium:[{id:'one',sku:'urban',wins:1,claimed:false}]}});vi.mocked(payments.claim).mockResolvedValue({claimed:true});
    mount(<SeasonRewards onOpen={()=>{}}/>);fireEvent.click(await screen.findByRole('button',{name:'CLAIM REWARD'}));await waitFor(()=>expect(payments.claim).toHaveBeenCalledWith('season-a','free','one'));expect(screen.getByRole('button',{name:'PREMIUM PASS REQUIRED'}).hasAttribute('disabled')).toBe(true);
  });
});
