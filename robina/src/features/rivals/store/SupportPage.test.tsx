import {cleanup,fireEvent,render,screen,waitFor,act} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import SupportPage from './SupportPage';
import {supportAmount} from './support';
import {PurchaseHistory} from './PurchaseHistory';
import {StoreIdentity} from './StoreIdentity';
import {payments,type StoreSnapshot} from '@/services/payments';
vi.mock('@/services/payments',async original=>({...await original<typeof import('@/services/payments')>(),payments:{store:vi.fn(),support:vi.fn(),check:vi.fn()},refreshStore:vi.fn()}));
const snapshot:StoreSnapshot={ownedIds:[],equippedIds:[],grenadeBalance:5,recoveryUntil:null,serverTime:new Date().toISOString(),spendingBlocked:false,purchases:[],configured:true,environment:'sandbox',catalog:[{id:'support',name:'SUPPORT THE DEVELOPER',cents:100,currency:'USD',kind:'support',enabled:true}]};
beforeEach(()=>{sessionStorage.clear();vi.mocked(payments.store).mockResolvedValue(snapshot);});
afterEach(()=>{cleanup();vi.useRealTimers();vi.clearAllMocks();});
it('accepts exact USD cents and rejects floats, exponents, zero and excess precision',()=>{
  for(const [input,expected]of [['5',500],['12.34',1234],['0.01',1],['10000',1000000]] as const)expect(supportAmount(input)).toBe(expected);
  for(const input of ['0','-1','1.001','1e3','Infinity','10000.01','abc'])expect(supportAmount(input)).toBeNull();
});
it('requires an explicit review and confirmation before creating custom support checkout',async()=>{
  vi.mocked(payments.support).mockResolvedValue({id:'0123456789abcdef01234567',sku:'support',name:'SUPPORT THE DEVELOPER',cents:1234,currency:'USD',environment:'sandbox',status:'pending',createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString(),checkoutUrl:'https://checkout.bachs.io/c/support'});
  render(<StoreIdentity.Provider value="support-wallet"><MemoryRouter><SupportPage/></MemoryRouter></StoreIdentity.Provider>);
  fireEvent.change(screen.getByLabelText('YOUR AMOUNT / USD'),{target:{value:'12.34'}});
  await waitFor(()=>expect(screen.getByRole('button',{name:'REVIEW YOUR SUPPORT'}).hasAttribute('disabled')).toBe(false));
  fireEvent.click(screen.getByRole('button',{name:'REVIEW YOUR SUPPORT'}));expect(payments.support).not.toHaveBeenCalled();
  const confirm=await screen.findByRole('button',{name:/CONFIRM \/ CONTINUE TO BACHS/});await waitFor(()=>expect(confirm.hasAttribute('disabled')).toBe(false));fireEvent.click(confirm);
  await waitFor(()=>expect(payments.support).toHaveBeenCalledWith(1234,expect.any(String)));expect(await screen.findByRole('button',{name:'CONTINUE PAYMENT'})).toBeTruthy();expect(screen.queryByText('THANK YOU FOR YOUR SUPPORT')).toBeNull();
});
it('counts down ten minutes, removes abandoned checkouts and preserves paid receipts',()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-16T12:00:00Z'));
  const account={ownedIds:[],equippedIds:[],grenadeBalance:5,equipment:[],serverTime:new Date().toISOString(),purchases:[{id:'pending-order',product:'Pending MP5',price:3,date:'Today',status:'pending',createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString()},{id:'paid-order',product:'Confirmed support',price:10,date:'Yesterday',status:'fulfilled',createdAt:'2026-11-15T12:00:00Z'}]};
  render(<MemoryRouter><PurchaseHistory account={account}/></MemoryRouter>);expect(screen.getByRole('timer').textContent).toContain('10:00');expect(screen.getByRole('link',{name:'CONTINUE PAYMENT'}).getAttribute('href')).toBe('/store/payment-return?order=pending-order');
  act(()=>vi.advanceTimersByTime(600001));expect(screen.queryByText('Pending MP5')).toBeNull();expect(screen.getByText('Confirmed support')).toBeTruthy();
});
