import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ArrowUpRight, Badge, Bomb, Box, Check, ChevronRight, CircleHelp, Clock3, Cross, Crown, Equal, History, Layers3, LockKeyhole, PackageOpen, Search, Shield, ShoppingBag, SlidersHorizontal, Sparkles, Target } from 'lucide-react';
import { EQUIPMENT } from '../three/Loadout';
import { CATALOG, CATEGORIES, findProduct, money, referenceStats, collectionStats, type Category, type Product, type StoreAccount } from './catalog';
import ProductArt from './ProductArt';
import ProductDialog from './ProductDialog';
import PurchaseDialog from './PurchaseDialog';
import RecoveryPanel from './RecoveryPanel';
import SoldierEditions from './SoldierEditions';
import {modelArt} from './modelAssets';
import './store.css';
import './exchange.css';
import './command-store.css';

const ICONS = [Sparkles, Target, Bomb, Cross, Shield, SlidersHorizontal, Sparkles, Layers3, Badge, Crown, PackageOpen, History];
const routeFor = (id: Category) => id === 'inventory' ? '/inventory' : id === 'history' ? '/purchase-history' : '/store/' + id;
const COPY: Partial<Record<Category,[string,string]>> = {
  weapons:['THE ARMORY','Six distinct platforms — rotate the models and inspect every detail'],
  grenades:['MAKE AN ENTRANCE','Field hardware — from compact essentials to a complete supply package'],
  health:['STAY IN THE FIGHT','Field medicine and recovery selections — clear choices, no hidden promises'],
  characters:['BUILT TO STAND APART','Distinct uniforms, armor and headgear — one uncompromised playing field'],
  cosmetics:['YOUR WEAPON / YOUR MARK','Seven photographed finishes — the studio shows the finish you select'],
  effects:['OWN THE MOMENT','Expression and light studies for your signature exit'],
  bundles:['MORE THAN A UNIFORM','A complete visual identity — matching outfit, finish and signature'],
  season:['THE NEXT CHAPTER','Explore the collection’s free and premium reward showcase'],
  founder:['HERE FROM THE START','A field-ready identity for the operatives who were here first'],
  inventory:['YOUR FIELD LOCKER','Your collection and issued mission equipment, kept clearly separate'],
  history:['EVERY PURCHASE / CLEAR','Confirmed orders belong here — browsing never creates a transaction'],
};

export default function StorePage({ reduced = false, account,review=false }: { reduced?: boolean; account?: StoreAccount;review?:boolean }) {
  const { pathname } = useLocation();
  const requested = pathname === '/inventory' ? 'inventory' : pathname === '/purchase-history' ? 'history' : pathname.split('/')[2] || 'featured';
  const category = CATEGORIES.some(([id]) => id === requested) ? requested as Category : 'featured';
  const [query, setQuery] = useState(''), [sort, setSort] = useState('curated'), [selected, selectProduct] = useState<Product | null>(null), [purchase, setPurchase] = useState<Product | null>(null);
  const [compare, setCompare] = useState<string[]>([]), [comparing, setComparing] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  const setSelected = (p: Product | null) => { if (p && !document.activeElement?.closest('[role="dialog"]')) opener.current = document.activeElement as HTMLElement; selectProduct(p); };
  const closeDetails = () => { setSelected(null); requestAnimationFrame(() => { if (opener.current?.isConnected) opener.current.focus(); }); };
  const closePurchase = () => { setPurchase(null); requestAnimationFrame(() => { if (opener.current?.isConnected) opener.current.focus(); }); };
  useEffect(() => { setQuery(''); selectProduct(null); setPurchase(null); setComparing(false); }, [pathname]);
  const matches = CATALOG.filter(p => p.category === category && (p.name + ' ' + p.subtitle).toLowerCase().includes(query.toLowerCase()));
  const products = [...matches].sort((a, b) => sort === 'low' ? a.price - b.price : sort === 'high' ? b.price - a.price : 0);
  const title = COPY[category];
  const toggleCompare = (id: string) => setCompare(old => old.includes(id) ? old.filter(i => i !== id) : [...old.slice(-1), id]);
  const openPurchase = (p: Product) => { setSelected(null); setPurchase(p); };
  return <div className="rs-store" data-reduced={reduced}>
    <header className="rs-masthead"><div><Link to="/" className="rs-back"><ArrowLeft size={14}/> BACK TO LOBBY</Link><span className="rs-kicker">RIVALS / QUARTERMASTER</span><h1 tabIndex={-1}>THE EXCHANGE</h1></div><div className="rs-masthead-meta"><ShoppingBag size={20}/><span>CURATED FOR OPERATIVES<small>OPERATIVE SUPPLY</small></span></div></header>
    <div className="rs-layout"><aside className="rs-sidebar"><span className="rs-nav-heading">THE COLLECTION</span><nav aria-label="Store categories">{CATEGORIES.map(([id, label], i) => { const Icon = ICONS[i]; return <NavLink key={id} end to={routeFor(id)} className={() => category === id ? 'active' : ''}><Icon size={16}/><span>{label}</span><ChevronRight size={12}/></NavLink>; })}</nav><div className="rs-sidebar-note"><Shield size={18}/><strong>STYLE IS A SIGNATURE</strong><p>Equipment — identity — a signature of your own</p></div></aside>
      <div className="rs-content">
        <div className="rs-preview-strip"><span><i/> THE COLLECTION</span><p>Inspect the complete looks and hardware — checkout is not enabled</p><CircleHelp size={15}/></div>
        {category === 'featured' ? <>
          <section className="rs-hero"><div className="rs-hero-text"><span className="rs-kicker">THE COMMAND COLLECTION / EDITION 02</span><h2>PRESENCE.<br/><em>WITHOUT<br/>COMPROMISE.</em></h2><p>Layered ceramic armor. Sealed optics.<br/>A silhouette that speaks for itself.</p><button className="rs-primary" onClick={() => setSelected(findProduct('legend')!)}>EXPLORE COLLECTION <ArrowUpRight size={18}/></button><span className="rs-hero-price">{money(19.99)} <small>COMMANDER / FOUR-PIECE COLLECTION</small></span></div><ProductArt product={findProduct('legend')!} large/><span className="rs-hero-caption">PHANTOM COMMAND / SIGNATURE EDITION</span></section>
          <SoldierEditions onInspect={setSelected}/>
          <div className="rs-feature-links"><Link to="/store/weapons"><Target size={22}/><span>THE ARMORY<small>Supplied models / 360° inspection</small></span><ArrowUpRight size={16}/></Link><Link to="/store/characters"><Shield size={22}/><span>OPERATIVE IDENTITY<small>Eight complete field uniforms</small></span><ArrowUpRight size={16}/></Link><Link to="/store/founder"><Crown size={22}/><span>FOUNDER COLLECTION<small>A signature from the start</small></span><ArrowUpRight size={16}/></Link></div>
          <SectionTitle title="FIELD ESSENTIALS" note="SUPPLIED HARDWARE / STUDIO INSPECTION" to="/store/weapons"/>
          <div className="rs-product-grid">{['m4a1', 'mp5', 'grenades-20', 'first-aid'].map(id => <Card key={id} product={findProduct(id)!} onOpen={setSelected} account={account}/>)}</div>
          <SectionTitle title="MAKE YOUR MARK" note="IDENTITY WITHOUT ADVANTAGE" to="/store/characters"/>
          <div className="rs-product-grid">{['shadow', 'cyber', 'crimson', 'golden'].map(id => <Card key={id} product={findProduct(id)!} onOpen={setSelected} account={account}/>)}</div>
          <section className="rs-editorial"><div><span className="rs-kicker">FOUNDER COLLECTION / FIELD EDITION</span><h2>NOT JUST ANOTHER<br/>NAME IN THE CITY</h2><p>A pale field uniform, graphite carrier and numbered insignia. An identity for those who were here first.</p><Link to="/store/founder">MEET THE FOUNDER COLLECTION <ArrowRight size={16}/></Link></div><Crown size={130} strokeWidth={.6}/></section>
        </> : <>
          <header className="rs-category-heading"><span className="rs-kicker">QUARTERMASTER / {CATEGORIES.find(([id]) => id === category)?.[1].toUpperCase()}</span><h2>{title?.[0]}</h2><p>{title?.[1]}</p></header>
          {category==='characters'&&<SoldierEditions onInspect={setSelected}/>}
          {category === 'inventory' ? <Inventory account={account} onOpen={setSelected}/> : category === 'history' ? <PurchaseHistory account={account}/> : category === 'season' ? <Season onOpen={setSelected}/> : category === 'founder' ? <Founder onOpen={setSelected}/> : <>
            {category === 'grenades' && <div className="rs-balance-panel"><Bomb size={28}/><div><span>CURRENT GRENADE BALANCE</span><strong>{account?.grenadeBalance ?? '—'}</strong><small>{account?.grenadeBalance === 0 ? 'OUT OF GRENADES' : account?.grenadeBalance == null ? 'Mission supply is managed in the field' : 'Your supplied collection balance'}</small></div><Link className="rs-secondary" to="#rs-products">REFILL GRENADES <ArrowRight size={15}/></Link><p>Field stock stays with your mission — collection browsing does not allocate supplies</p></div>}
            {category === 'health' && <><div className="rs-medical-intro"><HeartStatus/><div><span className="rs-kicker">EXISTING FIELD MEDICINE</span><h3>100 HP / MAKE IT COUNT</h3><p>Find first-aid kits and medical supplies in the city — paid recovery options are coming soon</p><Link className="rs-text-link" to="/recovery">RECOVERY OPTIONS <ArrowUpRight size={15}/></Link></div></div></>}
            <div className="rs-toolbar"><label className="rs-search"><Search size={16}/><input aria-label="Search store products" placeholder="Find your next signature…" value={query} onChange={e => setQuery(e.target.value)}/></label><label className="rs-sort">SORT<select aria-label="Sort store products" value={sort} onChange={e => setSort(e.target.value)}><option value="curated">Curated</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option></select></label><span>{products.length} ITEMS</span></div>
            {category === 'weapons' && <div className="rs-compare-intro"><Equal size={17}/><span>COMPARE TWO PLATFORMS <small>Inspect collection specs alongside current field configurations</small></span><button className="rs-secondary" disabled={compare.length !== 2} onClick={() => setComparing(v => !v)}>{comparing ? 'HIDE' : 'VIEW'} COMPARISON ({compare.length}/2)</button></div>}
            {comparing && <Comparison ids={compare}/>}
            <div className="rs-product-grid" id="rs-products">{products.map(p => <Card key={p.id} product={p} onOpen={setSelected} account={account} comparing={category === 'weapons' ? compare.includes(p.id) : undefined} onCompare={toggleCompare}/>)}</div>
            {!products.length && <div className="rs-empty" role="status"><Search size={30}/><h3>NO MATCHING SIGNATURES</h3><p>Try a different name or clear the search</p><button className="rs-secondary" onClick={() => setQuery('')}>CLEAR SEARCH</button></div>}
            {category === 'health' && <RecoveryPanel review={review}/>}
          </>}
        </>}
        <footer className="rs-store-footer"><Shield size={16}/><p>THE EXCHANGE / RIVALS<small>Collection showroom — checkout is not enabled and no payment is taken</small></p><Link to="/settings">ACCESSIBILITY & SETTINGS <ArrowUpRight size={13}/></Link></footer>
      </div>
    </div>
    {selected && <ProductDialog key={selected.id} product={selected} onClose={closeDetails} onSelect={setSelected} onPurchase={openPurchase} account={account} reduced={reduced}/>}
    {purchase && <PurchaseDialog key={purchase.id} product={purchase} onClose={closePurchase} review={review}/>}
  </div>;
}
function HeartStatus() { return <div className="rs-hp-mark"><Cross size={37} strokeWidth={1}/><span>100<small>HP / REFERENCE</small></span></div>; }
function SectionTitle({ title, note, to }: { title: string; note: string; to: string }) { return <div className="rs-section-title"><div><span className="rs-kicker">{note}</span><h2>{title}</h2></div><Link to={to}>VIEW ALL <ArrowUpRight size={15}/></Link></div>; }
function Card({ product: p, onOpen, account, comparing, onCompare }: { product: Product; onOpen: (p: Product) => void; account?: StoreAccount; comparing?: boolean; onCompare?: (id: string) => void }) {
  const owned = account?.ownedIds.includes(p.id), equipped = account?.equippedIds.includes(p.id);
  return <article className="rs-card" style={{ '--rs-accent': p.accent } as CSSProperties}>
    <button className="rs-card-art" onClick={() => onOpen(p)} aria-label={'Preview ' + p.name}><ProductArt product={p}/><span className="rs-card-view">INSPECT <ArrowUpRight size={14}/></span></button>
    <div className="rs-card-body"><div className="rs-card-meta"><span>{p.category === 'weapons' ? p.subtitle : p.category.toUpperCase()}</span><span className="rs-badge">{equipped ? 'EQUIPPED' : owned ? 'OWNED' : 'SHOWROOM'}</span></div><h3>{p.name}</h3><p>{p.quantity ? p.quantity + ' grenades / supply package' : p.art === 'character' ? p.description.split(' — ')[0] : p.art === 'bundle' ? (p.includes?.length ?? 0) + '-piece signature collection' : p.model ? '360° studio inspection' : 'Signature presentation'}</p><div className="rs-card-bottom"><div><strong>{p.price ? money(p.price) : 'IN THE FIELD'}</strong><small>{p.price ? 'USD / COLLECTION' : 'NOT FOR SALE'}</small></div><button onClick={() => onOpen(p)} aria-label={'Details for ' + p.name}>DETAILS <ArrowRight size={14}/></button></div>{comparing !== undefined && <button className="rs-compare-toggle" aria-pressed={comparing} onClick={() => onCompare?.(p.id)}>{comparing ? <Check size={13}/> : <Equal size={13}/>} {comparing ? 'SELECTED FOR COMPARISON' : 'COMPARE PLATFORM'}</button>}</div>
  </article>;
}
function Comparison({ ids }: { ids: string[] }) {
  return <section className="rs-comparison" aria-label="Weapon comparison"><header><Equal size={18}/><h3>SIDE BY SIDE</h3><span>COLLECTION CONFIGURATIONS</span></header><div>{ids.map(id => {
    const p=findProduct(id)!;
    return <article key={id}><h3>{p.name}</h3><strong>{money(p.price)} <small>SHOWROOM</small></strong><p>Collection platform: {p.proposed?.magazine} rounds · {p.proposed?.ammo}</p>
      <h4>PREMIUM CONFIGURATION</h4><dl>{collectionStats(id).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      {p.reference&&<details><summary>ISSUED {p.reference.toUpperCase()} REFERENCE</summary><dl>{referenceStats(p.reference).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></details>}
    </article>;
  })}</div></section>;
}
function Inventory({ account, onOpen }: { account?: StoreAccount; onOpen: (p: Product) => void }) {
  const [filter, setFilter] = useState('all'), [query, setQuery] = useState('');
  const owned = CATALOG.filter(p => account?.ownedIds.includes(p.id) && (filter === 'all' || p.category === filter) && p.name.toLowerCase().includes(query.toLowerCase()));
  return <><section className="rs-inventory-summary"><div><PackageOpen size={24}/><span>VERIFIED COLLECTION<strong>{account ? account.ownedIds.length : '—'}</strong><small>{account ? 'Supplied ownership records' : 'No purchased items'}</small></span></div><div><Bomb size={24}/><span>GRENADES<strong>{account?.grenadeBalance ?? '—'}</strong><small>Collection balance</small></span></div><div><Shield size={24}/><span>EQUIPPED COLLECTION ITEMS<strong>{account ? account.equippedIds.length : '—'}</strong><small>Your equipped collection</small></span></div></section>
    <div className="rs-toolbar"><label className="rs-search"><Search size={16}/><input aria-label="Search inventory" placeholder="Search collection…" value={query} onChange={e => setQuery(e.target.value)}/></label><label className="rs-sort">CATEGORY<select aria-label="Inventory category" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All collections</option>{CATEGORIES.filter(([id]) => !['featured', 'history', 'inventory', 'health', 'founder'].includes(id)).map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select></label></div>
    {owned.length ? <div className="rs-product-grid">{owned.map(p => <Card key={p.id} product={p} onOpen={onOpen} account={account}/>)}</div> : <div className="rs-empty"><PackageOpen size={37} strokeWidth={1}/><span className="rs-kicker">YOUR COLLECTION STARTS WITH REAL OWNERSHIP</span><h3>{account ? 'NO MATCHING OWNED ITEMS' : 'YOUR COLLECTION IS EMPTY'}</h3><p>{account ? 'Try another filter or explore the collection' : 'Purchased items will appear here once available — your existing mission equipment is listed below'}</p><Link className="rs-secondary" to="/store">EXPLORE THE EXCHANGE <ArrowRight size={16}/></Link></div>}
    <div className="rs-section-title"><div><span className="rs-kicker">ISSUED KIT / NOT PAID OWNERSHIP</span><h2>{account?.equipment.length ? 'CURRENT SUPPLIED EQUIPMENT' : 'EXISTING MISSION STARTER KIT'}</h2></div></div>
    <div className="rs-issued-kit">{(account?.equipment.length?account.equipment:(['rifle','pistol','knife'] as const).map(id=>({id,ammo:EQUIPMENT[id].magazine,reserve:EQUIPMENT[id].reserve}))).map((slot,i)=><article key={slot.id}><span>SLOT / 0{i+1}</span>
      {slot.id==='knife'?<svg className="rs-issued-art" viewBox="0 0 300 120" role="img" aria-label="Issued field knife"><path d="m40 83 153-49 63 4-61 39-75 7-11 18-18-2 4-19-35 17Z" fill="#a8b8c4"/><path d="m121 73 79-28 39-4-48 27Z" fill="#d8e2e9"/><path d="m42 83 60-18 10 13-65 20Z" fill="#435664"/></svg>:<img className="rs-issued-art" src={modelArt(slot.id)} alt={EQUIPMENT[slot.id].name+' issued weapon'}/>}<h3>{EQUIPMENT[slot.id].name}</h3><p>{EQUIPMENT[slot.id].kind==='melee'?'Melee · no ammunition':`${slot.ammo} / ${slot.reserve} ${account?.equipment.length?'current':'starting'} ammunition`}</p><small>{account?.equipment.length?'SUPPLIED EQUIPMENT SNAPSHOT':'EXISTING CONFIG REFERENCE · NOT A LIVE SESSION'}</small><button disabled>{i===0?'PRIMARY':i===1?'SIDEARM':'MELEE'} · GAME-MANAGED</button></article>)}</div><p className="rs-fineprint">Loadout and field pickups remain managed by gameplay — Store equipment controls do not overwrite your current mission</p>
  </>;
}
function PurchaseHistory({ account }: { account?: StoreAccount }) { return account?.purchases.length ? <div className="rs-receipts">{account.purchases.map(p => <article key={p.id}><History size={20}/><div><h3>{p.product}</h3><small>{p.date} · {p.id}</small></div><span>{p.status.toUpperCase()}</span><strong>{money(p.price)}</strong></article>)}</div> : <div className="rs-empty"><History size={40} strokeWidth={1}/><span className="rs-kicker">PURCHASE HISTORY</span><h3>NO PURCHASES YET</h3><p>Your confirmed purchases will appear here — browsing the collection does not create a purchase</p><Link className="rs-secondary" to="/store">BACK TO THE COLLECTION <ArrowRight size={16}/></Link></div>; }
function Season({onOpen}:{onOpen:(p:Product)=>void}) {
  const tracks=[{name:'FREE TRACK',items:['first-aid','grenades-10','desert','salute','urban']},{name:'PREMIUM TRACK',items:['cyber','frost','midnight','protocol','golden']}];
  return <><section className="rs-season-hero"><div><span className="rs-kicker">SEASON COLLECTION / REWARD SHOWCASE</span><h2>EVERY JOB<br/>A NEW CHAPTER</h2><p>Explore the identities and hardware in the collection</p><button className="rs-primary" onClick={()=>onOpen(findProduct('pass')!)}>INSPECT PREMIUM PASS <ArrowRight size={17}/></button><small>$6.99 / SEASON COLLECTION</small></div><ProductArt product={findProduct('golden')!} large/></section>
    <div className="rs-section-title"><div><span className="rs-kicker">THE COLLECTION / SELECT TO INSPECT</span><h2>THE REWARD SHOWCASE</h2></div></div>
    <div className="rs-reward-tracks">{tracks.map(track=><section key={track.name}><header><Badge size={17}/><h3>{track.name}</h3><small>COLLECTION SHOWCASE</small></header><div>{track.items.map((id,i)=>{const p=findProduct(id)!;return <button key={id} onClick={()=>onOpen(p)}><span>TIER / {String(i+1).padStart(2,'0')}</span><ProductArt product={p}/><strong>{p.name}</strong><small>INSPECT REWARD <ArrowUpRight size={12}/></small></button>;})}</div></section>)}</div>
    <p className="rs-fineprint">Reward showcase only — no season is activated, no payment is taken and browsing never grants rewards</p></>;
}
function Founder({ onOpen }: { onOpen: (p: Product) => void }) { const p = findProduct('founder')!; return <><section className="rs-founder"><div><span className="rs-kicker">FOUNDER COLLECTION / FIELD EDITION</span><Crown size={45} strokeWidth={1}/><h2>MAKE YOUR<br/><em>FIRST MARK</em></h2><p>For those who see the city before the rest<br/>A visual identity built around the beginning</p><strong>{money(p.price)} <small>USD / COLLECTION</small></strong><button className="rs-primary" onClick={() => onOpen(p)}>EXPLORE FOUNDER PACK <ArrowRight size={18}/></button><small>COLLECTION SHOWROOM / NO PAYMENT TAKEN</small></div><ProductArt product={p} large/></section><div className="rs-founder-rewards">{[[Shield, 'FOUNDER COSTUME'], [Badge, 'PROFILE BADGE'], [Crown, 'FOUNDER TITLE'], [Box, 'PROFILE BORDER'], [Sparkles, 'VICTORY ANIMATION']].map(([Icon, name]) => { const Mark = Icon as typeof Shield; return <article key={String(name)}><Mark size={29} strokeWidth={1}/><h3>{String(name)}</h3><small>FOUNDER SIGNATURE</small></article>; })}</div></>; }
