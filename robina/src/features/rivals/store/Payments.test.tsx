import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {StrictMode} from 'react';
import PurchaseDialog from './PurchaseDialog';
import {StoreIdentity} from './StoreIdentity';
import {findProduct} from './catalog';
import {payments,type PaymentOrder,type StoreSnapshot} from '@/services/payments';
vi.mock('@/services/payments',async importOriginal=>({...await importOriginal<typeof import('@/services/payments')>(),payments:{store:vi.fn(),checkout:vi.fn(),check:vi.fn(),order:vi.fn(),equip:vi.fn(),claim:vi.fn()},paymentError:()=> 'Payment unconfirmed. Check the same order.',refreshStore:vi.fn(),STORE_CHANGED:'rivals:store-changed'}));
const pending:PaymentOrder={id:'0123456789abcdef01234567',sku:'mp5',name:'MP5',cents:300,currency:'USD',environment:'sandbox',status:'pending',checkoutUrl:'https://checkout.bachs.io/c/test',createdAt:'2026-11-14T12:00:00Z'};
const snapshot:StoreSnapshot={ownedIds:[],equippedIds:[],grenadeBalance:5,recoveryUntil:null,serverTime:'2026-11-14T12:00:00Z',spendingBlocked:false,purchases:[],configured:true,environment:'sandbox',catalog:[{id:'mp5',name:'MP5',cents:300,currency:'USD',kind:'weapon',enabled:true},{id:'urban',name:'Urban Soldier',cents:299,currency:'USD',kind:'character',enabled:false,reason:'Not released.'},{id:'grenades-10',name:'10 grenades',cents:300,currency:'USD',kind:'grenades',enabled:true}]};
function mount(sku='mp5',orderId?:string,identity='wallet-a'){
  return render(<StoreIdentity.Provider value={identity}><MemoryRouter><PurchaseDialog product={findProduct(sku)!} orderId={orderId} onClose={()=>{}}/></MemoryRouter></StoreIdentity.Provider>);
}
beforeEach(()=>{sessionStorage.clear();vi.resetAllMocks();vi.mocked(payments.store).mockResolvedValue(snapshot);vi.mocked(payments.checkout).mockResolvedValue(pending);vi.mocked(payments.check).mockResolvedValue(pending);});
afterEach(cleanup);
describe('real Bachs purchase UI',()=>{
  it('requires confirmation and shows pending until the server confirms fulfillment',async()=>{
    mount();expect(payments.checkout).not.toHaveBeenCalled();
    const confirm=await screen.findByRole('button',{name:/CONFIRM \/ CONTINUE TO BACHS/});await waitFor(()=>expect(confirm.hasAttribute('disabled')).toBe(false));
    fireEvent.click(confirm);await screen.findByText('PAYMENT STATUS / PENDING');expect(screen.queryByText('PURCHASE CONFIRMED')).toBeNull();
    vi.mocked(payments.check).mockResolvedValue({...pending,status:'fulfilled',checkoutUrl:null});
    fireEvent.click(screen.getByRole('button',{name:'CHECK PAYMENT STATUS'}));await screen.findByText('PURCHASE CONFIRMED');
    expect(screen.getByRole('button',{name:'EQUIP FOR NEXT DEPLOYMENT'})).toBeTruthy();expect(payments.checkout).toHaveBeenCalledTimes(1);
  });
  it('uses one retry key when checkout times out and never reports false success',async()=>{
    vi.mocked(payments.checkout).mockRejectedValue(new Error('request_timeout'));mount();
    const confirm=await screen.findByRole('button',{name:/CONFIRM \/ CONTINUE TO BACHS/});await waitFor(()=>expect(confirm.hasAttribute('disabled')).toBe(false));
    fireEvent.click(confirm);await screen.findByRole('alert');await waitFor(()=>expect(confirm.hasAttribute('disabled')).toBe(false));fireEvent.click(confirm);
    await waitFor(()=>expect(payments.checkout).toHaveBeenCalledTimes(2));
    expect(vi.mocked(payments.checkout).mock.calls[0][1]).toBe(vi.mocked(payments.checkout).mock.calls[1][1]);expect(screen.queryByText('PURCHASE CONFIRMED')).toBeNull();
  });
  it('refreshing or returning from checkout checks the original order, never creates another',async()=>{
    sessionStorage.setItem('rivals:checkout:wallet-a:mp5',JSON.stringify({key:'same-stable-key-123456789',id:pending.id}));mount();
    await screen.findByText('PAYMENT STATUS / PENDING');expect(payments.check).toHaveBeenCalledWith(pending.id);expect(payments.checkout).not.toHaveBeenCalled();
  });
  it('does not present success for a cancelled redirect or a verification error',async()=>{
    vi.mocked(payments.check).mockRejectedValue(new Error('verification_unconfirmed'));mount('mp5',pending.id);
    await screen.findByRole('alert');expect(screen.queryByText('PURCHASE CONFIRMED')).toBeNull();expect(payments.checkout).not.toHaveBeenCalled();
  });
  it('disables nonfunctional products and unavailable payment configuration',async()=>{
    const view=mount('urban');await screen.findByText('Not released.');expect(screen.getByRole('button',{name:/CONFIRM \/ CONTINUE/}).hasAttribute('disabled')).toBe(true);view.unmount();
    vi.mocked(payments.store).mockResolvedValue({...snapshot,configured:false});mount();await screen.findByText('Checkout is not configured yet.');expect(screen.getByRole('button',{name:/CONFIRM \/ CONTINUE/}).hasAttribute('disabled')).toBe(true);expect(payments.checkout).not.toHaveBeenCalled();
  });
  it('a confirmed grenade pack can be purchased again only as a new explicit purchase',async()=>{
    vi.mocked(payments.check).mockResolvedValue({...pending,sku:'grenades-10',status:'fulfilled'});mount('grenades-10',pending.id);
    await screen.findByText('10 grenades added to your inventory.');expect(payments.checkout).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'BUY ANOTHER PACK'}));
    expect(screen.getByText('CONFIRM YOUR PURCHASE')).toBeTruthy();expect(payments.checkout).not.toHaveBeenCalled();
  });
  it('does not reuse another account’s retry state',async()=>{
    sessionStorage.setItem('rivals:checkout:wallet-a:mp5',JSON.stringify({key:'previous-account-123456789',id:pending.id}));mount('mp5',undefined,'wallet-b');
    await screen.findByText('CONFIRM YOUR PURCHASE');expect(payments.check).not.toHaveBeenCalled();
  });
  it('restores an existing order under StrictMode without getting stuck in checking',async()=>{
    render(<StrictMode><StoreIdentity.Provider value="wallet-a"><MemoryRouter><PurchaseDialog product={findProduct('mp5')!} orderId={pending.id} onClose={()=>{}}/></MemoryRouter></StoreIdentity.Provider></StrictMode>);
    await screen.findByText('PAYMENT STATUS / PENDING');await waitFor(()=>expect(screen.getByRole('button',{name:'CHECK PAYMENT STATUS'}).hasAttribute('disabled')).toBe(false));expect(payments.checkout).not.toHaveBeenCalled();
  });
});
