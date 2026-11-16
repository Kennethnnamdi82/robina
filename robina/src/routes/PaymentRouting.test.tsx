import {cleanup,render,screen} from '@testing-library/react';
import {MemoryRouter,Routes,Route,Navigate,useLocation} from 'react-router-dom';
import {afterEach,it,expect,vi} from 'vitest';
const auth=vi.hoisted(()=>({isLoggedIn:true,isAdmin:false,isAuthLoading:false}));
vi.mock('@/context/AuthContext',()=>({useAuth:()=>auth}));
vi.mock('@/pages/LoginPage',()=>({default:()=> <h1>Normal sign in</h1>}));
vi.mock('@/pages/GamingRoute',()=>({default:()=>null,gameEngine:()=> '3d'}));
// Keep the hub's actual descendant route boundary: an exact parent route
// consumes the payment-return path and used to send every receipt to the lobby.
vi.mock('@/features/rivals/hub/GameHub',()=>({default:()=> <Routes><Route path="store/*" element={<h1>Saved checkout</h1>}/><Route path="support" element={<h1>Support the developer</h1>}/><Route path="/" element={<h1>Lobby</h1>}/><Route path="*" element={<Navigate to="/" replace/>}/></Routes>}));
import AppRoutes from './AppRoutes';
function Location(){const location=useLocation();return <output data-testid="location">{location.pathname+location.search}</output>;}
afterEach(cleanup);
it('preserves the saved order URL instead of consuming it above the hub and redirecting to home',async()=>{
  render(<MemoryRouter initialEntries={['/store/payment-return?order=0123456789abcdef01234567']}><AppRoutes/><Location/></MemoryRouter>);
  expect(await screen.findByRole('heading',{name:'Saved checkout'})).toBeTruthy();expect(screen.getByTestId('location').textContent).toContain('?order=0123456789abcdef01234567');expect(screen.queryByText('Lobby')).toBeNull();
});
it('opens the support page through existing authenticated game navigation',async()=>{
  render(<MemoryRouter initialEntries={['/support']}><AppRoutes/></MemoryRouter>);expect(await screen.findByRole('heading',{name:'Support the developer'})).toBeTruthy();
});
