import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import StorePage from './StorePage';
import RecoveryPanel, { RECOVERY_STATES } from './RecoveryPanel';
import PurchaseDialog, { PURCHASE_STATES } from './PurchaseDialog';
import { CATALOG, CATEGORIES, findProduct, referenceStats, type StoreAccount } from './catalog';
import { EQUIPMENT } from '../three/Loadout';
const empty: StoreAccount = { ownedIds: [], equippedIds: [], grenadeBalance: 0, equipment: [], purchases: [] };
function at(path = '/store', account?: StoreAccount) { return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="*" element={<StorePage account={account}/>}/></Routes></MemoryRouter>); }
beforeEach(() => { localStorage.clear(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe('frontend-only premium Exchange', () => {
  it('has the entire requested catalog without duplicate IDs or unsupported discounts', () => {
    expect(CATEGORIES).toHaveLength(12); expect(new Set(CATALOG.map(p => p.id)).size).toBe(CATALOG.length);
    expect(CATALOG.filter(p => p.category === 'weapons').map(p => p.price)).toEqual([3, 5, 7, 10, 15, 20]);
    expect(CATALOG.filter(p => p.category === 'characters')).toHaveLength(8);
    expect(CATALOG.filter(p => p.category === 'cosmetics')).toHaveLength(7);
    expect(CATALOG.filter(p => p.category === 'effects')).toHaveLength(12);
    expect(CATALOG.filter(p => p.category === 'bundles')).toHaveLength(4);
    for (const p of CATALOG) for (const id of p.includes ?? []) expect(findProduct(id)).toBeDefined();
    expect(findProduct('grenades-100')).toMatchObject({ quantity: 100, price: 10 });
  });
  it('opens all twelve dedicated category pages without fetching or changing gameplay', () => {
    const network = vi.spyOn(globalThis, 'fetch'), storage = vi.spyOn(Storage.prototype, 'setItem'); at();
    const nav = screen.getByRole('navigation', { name: 'Store categories' });
    for (const [, label] of CATEGORIES) fireEvent.click(within(nav).getByRole('link', { name: label }));
    expect(screen.getByText('NO PURCHASES YET')).toBeTruthy();
    expect(network).not.toHaveBeenCalled(); expect(storage).not.toHaveBeenCalled();
  }, 30000);
  it('filters and sorts the armory and handles empty search results', () => {
    at('/store/weapons'); expect(screen.getAllByRole('button', { name: /^Details for/ })).toHaveLength(6);
    fireEvent.change(screen.getByLabelText('Sort store products'), { target: { value: 'high' } });
    expect(screen.getAllByRole('button', { name: /^Details for/ })[0].getAttribute('aria-label')).toBe('Details for ELITE TACTICAL RIFLE');
    fireEvent.change(screen.getByLabelText('Search store products'), { target: { value: 'no-such-model' } });
    expect(screen.getByText('NO MATCHING SIGNATURES')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'CLEAR SEARCH' }));
    expect(screen.getAllByRole('button', { name: /^Details for/ })).toHaveLength(6);
  });
  it('compares actual references without replacing their stats with suggested specifications', () => {
    at('/store/weapons'); const toggles = screen.getAllByRole('button', { name: 'COMPARE PLATFORM' });
    fireEvent.click(toggles[0]); fireEvent.click(toggles[1]);
    fireEvent.click(screen.getByRole('button', { name: 'VIEW COMPARISON (2/2)' }));
    const compare = screen.getByRole('region', { name: 'Weapon comparison' });
    expect(within(compare).getByText('Catalog concept: 30 rounds · 7.62mm')).toBeTruthy();
    expect(within(compare).getByText('12')).toBeTruthy();
    expect(referenceStats('rifle')).toContainEqual(['Magazine', String(EQUIPMENT.rifle.magazine)]);
  });
  it('opens missing-model details as unavailable and offers only purchase previews', () => {
    at('/store/weapons'); fireEvent.click(screen.getByRole('button', { name: 'Details for M4A1' }));
    const dialog = screen.getByRole('dialog'); expect(within(dialog).getByText(/Combat statistics unavailable/)).toBeTruthy();
    expect(within(dialog).queryByRole('button', { name: 'INSPECT IN 3D' })).toBeNull();
    expect(within(dialog).getByText('COMING SOON')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'PREVIEW PURCHASE' }));
    expect(screen.getByText('PAYMENT PREVIEW / NO CHARGES')).toBeTruthy();
  });
  it('shows grenade exhaustion and proposed free allocation without creating grenades', () => {
    const storage = vi.spyOn(Storage.prototype, 'setItem'); at('/store/grenades', empty);
    expect(screen.getByText('OUT OF GRENADES')).toBeTruthy(); expect(screen.getByRole('link', { name: 'REFILL GRENADES' })).toBeTruthy();
    expect(screen.getByText(/Planned starter allocation: 5/)).toBeTruthy(); expect(storage).not.toHaveBeenCalled();
  });
  it('keeps the inventory honest and distinguishes issued mission equipment from paid ownership', () => {
    at('/inventory'); expect(screen.getByText('YOUR COLLECTION IS EMPTY')).toBeTruthy();
    expect(screen.getByText('EXISTING MISSION STARTER KIT')).toBeTruthy();
    expect(screen.getByText('12 / 120 starting ammunition')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'PRIMARY · GAME-MANAGED' }).hasAttribute('disabled')).toBe(true);
  });
  it('can display supplied ownership, equipment and receipts without inventing equipment mutations', () => {
    const account = { ...empty, ownedIds: ['cyber'], equippedIds: ['cyber'], equipment: [{ id: 'pistol' as const, ammo: 4, reserve: 22 }], purchases: [{ id: 'receipt-from-service', product: 'CYBER PHANTOM', price: 5.99, date: '2026-11-05', status: 'verified' as const }] };
    const view = at('/inventory', account); fireEvent.click(screen.getByRole('button', { name: 'Details for CYBER PHANTOM' }));
    expect(screen.getByRole('button', { name: 'UNEQUIP · COMING SOON' }).hasAttribute('disabled')).toBe(true); view.unmount();
    at('/purchase-history', account); expect(screen.getByText('VERIFIED')).toBeTruthy(); expect(screen.getByText(/receipt-from-service/)).toBeTruthy();
  });
  it('keeps seasonal rewards as locked templates and invents no active season', () => {
    at('/store/season'); expect(screen.getByText('SEASON ANNOUNCEMENT SOON')).toBeTruthy(); expect(screen.getAllByText('COMING SOON').filter(n=>n.closest('.rs-reward-tracks'))).toHaveLength(10);
    expect(screen.queryByRole('button', { name: /CLAIM/ })).toBeNull();
  });
  it('supports every purchase state manually without payment calls, receipts or entitlement persistence', () => {
    const network = vi.spyOn(globalThis, 'fetch'), storage = vi.spyOn(Storage.prototype, 'setItem');
    render(<PurchaseDialog review product={findProduct('ak47')!} onClose={() => {}}/>);
    fireEvent.click(screen.getByRole('button', { name: /Base USDC/ }));
    fireEvent.click(screen.getByRole('button', { name: 'PREVIEW CONFIRMATION' })); expect(screen.getByText('PAYMENT PROCESSING')).toBeTruthy();
    const select = screen.getByRole('combobox');
    for (const state of PURCHASE_STATES) fireEvent.change(select, { target: { value: state } });
    fireEvent.change(select, { target: { value: 'successful' } }); expect(screen.getByText(/No purchase occurred/)).toBeTruthy();
    expect(network).not.toHaveBeenCalled(); expect(storage).not.toHaveBeenCalled(); expect(localStorage.length).toBe(0);
  });
  it('renders all recovery states without starting a timer, changing HP or restricting entry', () => {
    const network = vi.spyOn(globalThis, 'fetch'), storage = vi.spyOn(Storage.prototype, 'setItem');
    render(<MemoryRouter><RecoveryPanel review/></MemoryRouter>);
    for (const state of RECOVERY_STATES) fireEvent.change(screen.getByLabelText('Recovery preview state'), { target: { value: state } });
    expect(screen.getByText(/Recovery unconfirmed.*Do not assume/)).toBeTruthy();
    expect(screen.getByText(/STATIC SAMPLE/)).toBeTruthy(); expect(screen.getByText(/gameplay is not locked/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'REVIVE NOW — $2' }));
    expect(screen.getByText('PAYMENT PREVIEW / NO CHARGES')).toBeTruthy();
    expect(storage).not.toHaveBeenCalled(); expect(network).not.toHaveBeenCalled();
  });
  it('does not mount any WebGL contexts until an explicit 3D inspection request', () => {
    const gl = vi.spyOn(HTMLCanvasElement.prototype, 'getContext'); at('/store/characters');
    fireEvent.click(screen.getByRole('button', { name: 'Details for CYBER PHANTOM' })); expect(gl).not.toHaveBeenCalled();
  });
});
