import React, { useState } from 'react';
import { Link } from 'wouter';
import {
  Check, Bell, ShieldCheck, AlertTriangle, FileBarChart2, CalendarDays, ArrowRight,
} from 'lucide-react';
import type { Store, Notification } from '../data';
import { dataService } from '../data';
import { Button, Card, EmptyState, PageHeader } from '../components';
import { since } from '../utils';

interface NotificationsPageProps {
  store: Store;
}

export function NotificationRow({ notification }: { notification: Notification }) {
  return (
    <button
      className={`notification-row ${notification.read ? 'is-read' : ''}`}
      onClick={() => dataService.markNotificationRead(notification.id)}
      data-testid={`button-notification-${notification.id}`}
    >
      <span className={`notification-type-icon type-${notification.category.toLowerCase().replace(' ', '-')}`}>
        {notification.category === 'Security' ? (
          <ShieldCheck size={17} />
        ) : notification.category === 'Early warning' ? (
          <AlertTriangle size={17} />
        ) : notification.category === 'Reports' ? (
          <FileBarChart2 size={17} />
        ) : (
          <CalendarDays size={17} />
        )}
      </span>
      <span className="notification-content">
        <span className="notification-topline">
          <b>{notification.title}</b>
          <span>{since(notification.time)}</span>
        </span>
        <small>{notification.body}</small>
        <span className="notification-category">{notification.category}</span>
      </span>
      {!notification.read && <i className="unread-dot" />}
      <span className="sr-only">{notification.read ? 'Read' : 'Mark as read'}</span>
    </button>
  );
}

export function NotificationsPage({ store }: NotificationsPageProps) {
  const [filter, setFilter] = useState('all');
  const notifications = store.notifications.filter(n => filter === 'all' || (filter === 'unread' && !n.read));

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="CAMPUS COMMUNICATIONS & ALERTS"
        title="Notifications & Security Alerts"
        description="Real-time alerts regarding anti-proxy flags, 75% early support warnings, and lecture session updates across CHARUSAT."
        actions={
          <Button variant="secondary" onClick={() => dataService.markAllNotificationsRead()} testId="button-mark-all-read">
            <Check size={15} /> Mark all read
          </Button>
        }
      />

      <div className="notifications-toolbar">
        <div className="segmented-control">
          <button onClick={() => setFilter('all')} className={filter === 'all' ? 'selected' : ''} data-testid="button-notification-all">
            All <span>{store.notifications.length}</span>
          </button>
          <button onClick={() => setFilter('unread')} className={filter === 'unread' ? 'selected' : ''} data-testid="button-notification-unread">
            Unread <span>{store.notifications.filter(n => !n.read).length}</span>
          </button>
        </div>
        <span>Newest notifications first</span>
      </div>

      <Card className="notifications-card">
        {notifications.length ? (
          notifications.map(notification => (
            <NotificationRow key={notification.id} notification={notification} />
          ))
        ) : (
          <EmptyState title="All caught up" body="There are no unread notifications in your inbox." />
        )}
      </Card>

      <div className="notification-preferences">
        <span className="preference-icon"><Bell size={17} /></span>
        <span>
          <b>Notification Delivery Rules</b>
          <small>Configure which operational alerts trigger immediate notifications in workspace settings.</small>
        </span>
        <Link href="/settings" className="text-link">Settings <ArrowRight size={14} /></Link>
      </div>
    </div>
  );
}
