export function MissionLifeStatus({ reconnecting }: { recoveryUntil?: string | null; reconnecting?: boolean }) {
  if (reconnecting) return <aside className="r3-life-status" role="status">Reconnecting to your operation. Recovery is available for five minutes from your last checkpoint.</aside>;
  return null;
}
