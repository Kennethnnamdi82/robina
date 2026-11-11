import { useState } from 'react';
import { ArrowUpRight, Info, LockKeyhole, Wallet } from 'lucide-react';
import { BountyDialog, ExternalLink } from './BountyUI';
import { dateLabel, MIN_WITHDRAWAL, money, parseUSDC, pendingRewards, USDC, validBaseAddress, type BountySnapshot, type WithdrawInput } from './model';

export default function BountyWallet({ data, busy, onSaveAddress, onWithdraw }: {
  data: BountySnapshot; busy: boolean; onSaveAddress: (address: string) => Promise<string | null>;
  onWithdraw: (input: WithdrawInput) => Promise<string | null>;
}) {
  const [address, setAddress] = useState(data.wallet.address), [error, setError] = useState(''), [saved, setSaved] = useState(false);
  const [dialog, setDialog] = useState<HTMLElement | null>(null);
  const pending = data.withdrawals.some(w => w.status === 'requested' || w.status === 'processing');
  const eligible = data.wallet.availableMicros >= MIN_WITHDRAWAL && !pending;
  return <section className="rb-wallet rb-section" id="bounty-wallet" aria-labelledby="rb-wallet-title" tabIndex={-1}>
    <div className="rb-section-heading"><div><span className="rh-eyebrow">CREATOR EARNINGS / BASE</span><h2 id="rb-wallet-title">BOUNTY WALLET</h2></div><Wallet size={23}/></div>
    <div className="rb-balance"><span>AVAILABLE USDC BALANCE</span><strong>{money(data.wallet.availableMicros)}<small>USDC</small></strong><p>Demo balance · no real funds</p></div>
    <dl className="rb-wallet-stats"><div><dt>Total USDC Earned</dt><dd>{money(data.wallet.earnedMicros)}</dd></div><div><dt>Pending Rewards</dt><dd>{money(pendingRewards(data.submissions))}</dd></div><div><dt>Total Withdrawn</dt><dd>{money(data.wallet.withdrawnMicros)}</dd></div></dl>
    <p className="rb-fineprint">Pending includes submissions awaiting review or credit. It is not spendable or guaranteed. All amounts are USDC.</p>
    <form className="rb-address-form" noValidate onSubmit={async event => {
      event.preventDefault(); if (busy) return;
      if (!validBaseAddress(address)) { setError('Enter a non-zero Base address: 0x followed by 40 hexadecimal characters.'); return; }
      setError(''); const failure = await onSaveAddress(address); if (failure) setError(failure); else { setAddress(address.trim()); setSaved(true); }
    }}>
      <label className="rb-label">Base wallet address<input disabled={busy} value={address} maxLength={42} autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="0x…" onChange={event => { setAddress(event.target.value); setSaved(false); }} aria-describedby="rb-address-hint"/></label>
      <small id="rb-address-hint">Manual destination only. Use an address you control on Base. Format validation does not verify ownership or network. Never enter a seed phrase.</small>
      <button className="rh-secondary rb-wide" type="submit" disabled={busy || !address.trim()}>SAVE DEMO ADDRESS</button>
      {error && <p role="alert" className="rb-error">{error}</p>}{saved && <p role="status">Demo destination saved on this device.</p>}
    </form>
    <div className="rb-withdrawal-action"><span><LockKeyhole size={15}/>MINIMUM WITHDRAWAL / 5 USDC</span><button className="rh-primary rb-wide" disabled={busy || !eligible} onClick={event => setDialog(event.currentTarget)}>REQUEST WITHDRAWAL <ArrowUpRight size={17}/></button><small>{pending ? 'A demo withdrawal is already pending.' : !eligible ? 'You need at least 5 USDC available to request a withdrawal.' : 'Opens a demo request. No funds will be transferred.'}</small></div>
    <div className="rb-wallet-history"><h3>WITHDRAWAL HISTORY</h3>{!data.withdrawals.length ? <p className="rb-history-empty">No withdrawals yet. Your request history will appear here.</p> : <ol>{data.withdrawals.map(withdrawal => <li key={withdrawal.id}><div><strong>{money(withdrawal.amountMicros)} USDC</strong><span className="rb-status" data-status={withdrawal.status}>{withdrawal.status === 'requested' ? 'Requested' : withdrawal.status === 'processing' ? 'Processing' : withdrawal.status === 'paid' ? 'Paid' : 'Rejected'}</span></div><time dateTime={withdrawal.requestedAt}>{dateLabel(withdrawal.requestedAt)}</time><code>{withdrawal.address}</code>{withdrawal.reason && <p>{withdrawal.reason}</p>}{withdrawal.transactionUrl && <ExternalLink href={withdrawal.transactionUrl}>View transaction</ExternalLink>}</li>)}</ol>}</div>
    {dialog && <WithdrawalDialog available={data.wallet.availableMicros} initialAddress={address} trigger={dialog} busy={busy} onClose={() => setDialog(null)} onConfirm={async input => { const failure = await onWithdraw(input); if (!failure) { setAddress(input.address.trim()); setSaved(false); setDialog(null); } return failure; }}/>}
  </section>;
}

function WithdrawalDialog({ available, initialAddress, trigger, busy, onClose, onConfirm }: {
  available: number; initialAddress: string; trigger: HTMLElement; busy: boolean; onClose: () => void;
  onConfirm: (input: WithdrawInput) => Promise<string | null>;
}) {
  const [address, setAddress] = useState(initialAddress), [value, setValue] = useState(String(available / USDC));
  const [confirmed, setConfirmed] = useState(false), [error, setError] = useState('');
  return <BountyDialog title="REVIEW WITHDRAWAL" description="Phase 1 simulation only. No payment, wallet signature or blockchain transaction will take place." onClose={() => { if (!busy) onClose(); }} returnFocus={trigger}>
    <form noValidate onSubmit={async event => {
      event.preventDefault(); if (busy) return;
      const amountMicros = parseUSDC(value);
      if (!validBaseAddress(address)) { setError('Enter a valid non-zero Base wallet address.'); return; }
      if (amountMicros === null || amountMicros < MIN_WITHDRAWAL) { setError('Enter at least 5 USDC, with up to 6 decimal places.'); return; }
      if (amountMicros > available) { setError('This amount exceeds your available balance.'); return; }
      if (!confirmed) { setError('Confirm this is a demo request and check the destination.'); return; }
      setError(''); const failure = await onConfirm({ address, amountMicros, confirmed }); if (failure) setError(failure);
    }}><fieldset disabled={busy} className="rb-fields"><legend>DEMO WITHDRAWAL DETAILS</legend>
      <label className="rb-label">Amount (USDC)<input inputMode="decimal" value={value} onChange={event => setValue(event.target.value)}/></label><small>Available: {money(available)} USDC · Minimum: 5 USDC</small>
      <label className="rb-label">Destination on Base<input value={address} maxLength={42} autoCapitalize="none" autoCorrect="off" spellCheck={false} onChange={event => setAddress(event.target.value)}/></label>
      <label className="rb-check"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)}/><span>I checked the Base destination and understand that this is a demo request. No USDC will be sent.</span></label>
      {error && <p role="alert" className="rb-error">{error}</p>}
      <button className="rh-primary rb-wide" type="submit">{busy ? 'RECORDING…' : 'CONFIRM DEMO REQUEST'}<ArrowUpRight size={17}/></button>
    </fieldset></form><p className="rb-demo-note"><Info size={16}/>Requests reserve only a simulated balance. Completed payments will require the Phase 2 backend.</p>
  </BountyDialog>;
}
