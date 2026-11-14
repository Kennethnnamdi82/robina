import { useEffect, useState } from 'react';

export function MissionLifeStatus({ recoveryUntil, reconnecting }: { recoveryUntil?: string | null; reconnecting?: boolean }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => { if (!recoveryUntil) return;setNow(Date.now()); const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, [recoveryUntil]);
  if (reconnecting) return <aside className="r3-life-status" role="status">Reconnecting to your operation. Recovery is available for five minutes from your last checkpoint.</aside>;
  if (!recoveryUntil) return null;
  const seconds = Math.max(0, Math.ceil((new Date(recoveryUntil).getTime() - now) / 1000));
  const clock = [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(value => String(value).padStart(2, '0')).join(':');
  return <aside className="r3-life-status" role="status">{seconds ? <>OPERATIVE RECOVERING · {clock}<small>New missions unlock when recovery ends.</small></> : 'Life recovered. You can deploy again.'}</aside>;
}
