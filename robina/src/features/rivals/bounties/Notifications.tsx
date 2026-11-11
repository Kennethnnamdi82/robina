import { Bell, CheckCheck, CheckCircle2, CircleDollarSign, Clock3, Radio, XCircle } from 'lucide-react';
import { dateLabel, type BountyNotification, type NotificationKind } from './model';
const ICONS = { published: Radio, received: Clock3, approved: CheckCircle2, rejected: XCircle, credited: CircleDollarSign, withdrawal: Bell } satisfies Record<NotificationKind, typeof Bell>;

export default function Notifications({ notifications, busy, onRead }: { notifications: BountyNotification[]; busy: boolean; onRead: () => void }) {
  return <section className="rb-section rb-notifications" aria-labelledby="rb-notifications-title">
    <div className="rb-section-heading"><div><span className="rh-eyebrow">CONTRACT INTELLIGENCE</span><h2 id="rb-notifications-title">NOTIFICATIONS</h2></div><button className="rb-text-button" disabled={busy || !notifications.some(n => !n.read)} onClick={onRead}><CheckCheck size={15}/>MARK ALL READ</button></div>
    {!notifications.length ? <div className="rb-empty"><Bell size={25}/><h3>ALL QUIET FOR NOW</h3><p>New contracts, submission reviews, reward credits and withdrawal updates will appear here.</p></div> : <ol className="rb-notification-list">{notifications.map(notification => {
      const Icon = ICONS[notification.kind];
      return <li key={notification.id} data-unread={!notification.read}><Icon size={19}/><div><strong>{notification.title}{!notification.read && <span className="sr-only"> (unread)</span>}</strong><p>{notification.message}</p><time dateTime={notification.createdAt}>{dateLabel(notification.createdAt)}</time></div>{!notification.read && <i aria-hidden="true"/>}</li>;
    })}</ol>}
  </section>;
}
