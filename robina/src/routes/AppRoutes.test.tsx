import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ isLoggedIn: false, isAdmin: false, isAuthLoading: false }));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("@/pages/LoginPage", () => ({ default: () => <h1>Sign in to RIVALS</h1> }));
vi.mock("@/pages/GamingRoute", () => ({ default: () => <h1>RIVALS game menu</h1>,gameEngine:(search:string)=>new URLSearchParams(search).get('engine')==='2d'?'2d':'3d' }));
vi.mock("@/features/rivals/hub/GameHub", () => ({ default: () => <h1>RIVALS game menu</h1> }));
vi.mock("@/pages/AdminLoginPage", () => ({ default: () => <h1>Owner sign in</h1> }));
vi.mock('@/features/rivals/admin/AdminBountyPage', () => ({ default: () => <h1>Standalone bounty operations</h1> }));
import AppRoutes from "./AppRoutes";

function Location() {
  const { pathname, search } = useLocation();
  return <div data-testid="location">{pathname}{search}</div>;
}
function AppAt({ path }: { path: string }) {
  return <MemoryRouter initialEntries={[path]}><AppRoutes /><Location /></MemoryRouter>;
}
beforeEach(() => { Object.assign(auth, { isLoggedIn: false, isAdmin: false, isAuthLoading: false }); localStorage.clear(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("game-only public entry", () => {
  it('protects standalone bounty administration from players and anonymous visitors', async () => {
    auth.isLoggedIn = true;
    render(<AppAt path="/admin/bounties/withdrawals"/>);
    expect(await screen.findByRole('heading', {name:'Owner sign in'})).toBeTruthy();
    expect(screen.getByTestId('location').textContent).toBe('/admin/login');
  });
  it('opens standalone bounty administration directly for authenticated owners', async () => {
    auth.isLoggedIn = auth.isAdmin = true;
    render(<AppAt path="/admin/bounties"/>);
    expect(await screen.findByRole('heading', {name:'Standalone bounty operations'})).toBeTruthy();
    expect(screen.getByTestId('location').textContent).toBe('/admin/bounties');
  });
  it("shows only login at the main link, then the game immediately when authenticated", async () => {
    const app = render(<AppAt path="/" />);
    expect(screen.getByRole("heading", { name: "Sign in to RIVALS" })).toBeTruthy();
    auth.isLoggedIn = true;
    app.rerender(<AppAt path="/" />);
    expect(await screen.findByRole("heading", { name: "RIVALS game menu" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Sign in to RIVALS" })).toBeNull();
    auth.isLoggedIn = false;
    app.rerender(<AppAt path="/" />);
    expect(screen.getByRole("heading", { name: "Sign in to RIVALS" })).toBeTruthy();
  });
  it.each(["/tasks", "/auto-claim", "/marketplace", "/gaming"])("redirects %s to the game, not a mining page", async path => {
    auth.isLoggedIn = true;
    render(<AppAt path={path} />);
    expect(await screen.findByRole("heading", { name: "RIVALS game menu" })).toBeTruthy();
    expect(screen.getByTestId("location").textContent).toBe("/");
  });
  it.each(['/rank','/store','/store/weapons','/inventory','/purchase-history','/recovery'])("does not let %s bypass login", async path => {
    render(<AppAt path={path} />);
    expect(await screen.findByRole("heading", { name: "Sign in to RIVALS" })).toBeTruthy();
    expect(screen.queryByText("RIVALS game menu")).toBeNull();
    expect(screen.getByTestId("location").textContent).toBe(path);
  });
  it("preserves existing game query settings on redirects", async () => {
    auth.isLoggedIn = true;
    render(<AppAt path="/gaming?engine=2d" />);
    await waitFor(() => expect(screen.getByTestId("location").textContent).toBe("/?engine=2d"));
  });
  it("waits for session restoration without flashing a mining page or game", () => {
    auth.isAuthLoading = true;
    render(<AppAt path="/" />);
    expect(screen.getByRole("status").textContent).toContain("Restoring");
    expect(screen.getByRole("heading",{name:"Welcome to RIVALS"})).toBeTruthy();
    expect(screen.queryByRole("heading",{name:"Sign in to RIVALS"})).toBeNull();
  });
  it.each(["/ref/player123", "/r/player123", "/?ref=player123", "/gaming?r=player123"])("keeps referral attribution for %s without an extra page", async path => {
    render(<AppAt path={path} />);
    await waitFor(() => expect(localStorage.getItem("basedrop_ref")).toBe("player123"));
    expect(await screen.findByRole("heading", { name: "Sign in to RIVALS" })).toBeTruthy();
  });
  it("still opens when referral storage is blocked", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Storage blocked"); });
    render(<AppAt path="/ref/player123" />);
    expect(await screen.findByRole("heading", { name: "Sign in to RIVALS" })).toBeTruthy();
  });
  it.each(["/admin/users", "/admin/tasks", "/admin/seasons", "/admin/payments", "/admin/ranking", "/admin/analytics", "/admin/activity"])("retires %s without exposing an old dashboard", async path => {
    auth.isLoggedIn = true;
    render(<AppAt path={path} />);
    expect(await screen.findByRole("heading", { name: "RIVALS game menu" })).toBeTruthy();
    expect(screen.getByTestId("location").textContent).toBe("/");
  });
  it("keeps retired dashboard links behind normal game login", async () => {
    render(<AppAt path="/admin/users" />);
    expect(await screen.findByRole("heading", { name: "Sign in to RIVALS" })).toBeTruthy();
    expect(screen.getByTestId("location").textContent).toBe("/");
  });
  it("preserves the owner login screen", async () => {
    render(<AppAt path="/admin/login" />);
    expect(await screen.findByRole("heading", { name: "Owner sign in" })).toBeTruthy();
  });
  it("routes authenticated owners back to RIVALS instead of the retired dashboard", async () => {
    auth.isLoggedIn = auth.isAdmin = true;
    render(<AppAt path="/admin/users" />);
    expect(await screen.findByRole("heading", { name: "RIVALS game menu" })).toBeTruthy();
    expect(screen.getByTestId("location").textContent).toBe("/");
  });
});
