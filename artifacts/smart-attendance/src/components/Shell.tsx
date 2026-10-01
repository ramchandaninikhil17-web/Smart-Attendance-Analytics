import React, { useState, useEffect, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import {
  Menu, Search, Bell, ChevronDown, Check, MoreHorizontal, LogOut, CircleHelp, Fingerprint, ArrowRight,
  type LucideIcon,
} from 'lucide-react';
import type { Store, Role } from '../data';
import { dataService } from '../data';
import { mainNav, peopleNav, operationsNav, allNav, roles } from '../utils';
import { HelpModal } from './HelpModal';

interface ShellProps {
  store: Store;
  children: ReactNode;
  onToast: (message: string) => void;
}

export function Shell({ store, children, onToast }: ShellProps) {
  const [path, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [roleOpen, setRoleOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const unread = store.notifications.filter(n => !n.read).length;
  const active = allNav.find(item => item.href === path)?.href ?? (path.startsWith('/students/') ? '/students' : path);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        const input = document.querySelector<HTMLInputElement>('[data-testid="input-global-search"]');
        input?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const navSection = (title: string, items: { label: string; href: string; icon: LucideIcon }[]) => (
    <div className="nav-section">
      <div className="nav-caption">{title}</div>
      {items.map(item => {
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={`nav-link ${active === item.href ? 'is-active' : ''}`}
            data-testid={`link-nav-${item.label.toLowerCase().replaceAll(' ', '-')}`}
          >
            <Icon size={17} />
            <span>{item.label}</span>
            {item.href === '/notifications' && unread > 0 && <span className="nav-count">{unread}</span>}
          </Link>
        );
      })}
    </div>
  );

  return (
    <div className="workspace">
      {mobileOpen && <button className="mobile-shade" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />}
      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <Link href="/overview" className="brand-lockup" data-testid="link-brand">
          <span className="brand-symbol"><span /></span>
          <span><strong>CHARUSAT</strong><small>SMART ATTENDANCE & ANALYTICS</small></span>
        </Link>
        <div className="campus-switch">
          <div className="campus-monogram">C</div>
          <div>
            <b>{store.settings.campus}</b>
            <small>Changa · CSPIT / DEPSTAR / CMPICA</small>
          </div>
          <ChevronDown size={14} />
        </div>
        <nav className="side-nav" aria-label="Primary navigation">
          {navSection('Core Platform', mainNav)}
          {navSection('Campus Directory', peopleNav)}
          {navSection('Security & Compliance', operationsNav)}
          <div className="nav-section">
            <div className="nav-caption">Student In-Person Verification</div>
            <Link
              href="/verify"
              onClick={() => setMobileOpen(false)}
              className={`nav-link ${active === '/verify' ? 'is-active' : ''}`}
              data-testid="link-nav-verify-attendance"
            >
              <Fingerprint size={17} />
              <span>Verify attendance</span>
            </Link>
          </div>
        </nav>
        <div className="sidebar-bottom">
          <button
            type="button"
            className="help-card"
            style={{ width: '100%', cursor: 'pointer', border: '1px solid rgba(255,255,255,.08)', textAlign: 'left' }}
            onClick={() => setHelpOpen(true)}
            data-testid="button-help-center"
          >
            <div className="help-icon"><CircleHelp size={16} /></div>
            <div><b>Anti-Proxy Architecture</b><span>Protocol & Guide</span></div>
            <ArrowRight size={14} />
          </button>
          <button
            className="profile-row"
            onClick={() => setRoleOpen(!roleOpen)}
            data-testid="button-role-menu"
            aria-expanded={roleOpen}
          >
            <span className="avatar avatar-sidebar">{store.currentUser.avatar}</span>
            <span className="profile-copy">
              <b>{store.currentUser.name}</b>
              <small>{store.currentUser.role}</small>
            </span>
            <MoreHorizontal size={18} />
          </button>
          {roleOpen && (
            <div className="role-menu">
              <div className="role-menu-label">Switch CHARUSAT Role View</div>
              {roles.map(role => (
                <button
                  key={role}
                  onClick={() => {
                    dataService.switchRole(role);
                    setRoleOpen(false);
                    onToast(`Switched view to ${role}`);
                  }}
                  data-testid={`button-switch-role-${role.toLowerCase()}`}
                >
                  <span>{role}</span>
                  {store.currentUser.role === role && <Check size={15} />}
                </button>
              ))}
              <button className="signout-item" onClick={() => setLocation('/login')}>
                <LogOut size={14} /> Exit session
              </button>
            </div>
          )}
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <button
            className="icon-button mobile-menu-button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            data-testid="button-open-navigation"
          >
            <Menu size={19} />
          </button>
          <div className="breadcrumb">
            <span>CHARUSAT</span>
            <span className="breadcrumb-slash">/</span>
            <b>{allNav.find(item => item.href === active)?.label ?? (path.startsWith('/students/') ? 'Student profile' : 'Workspace')}</b>
          </div>
          <div className="topbar-right">
            <form
              className="top-search"
              onSubmit={e => {
                e.preventDefault();
                if (search.trim()) setLocation(`/students?search=${encodeURIComponent(search.trim())}`);
              }}
            >
              <Search size={15} />
              <input
                aria-label="Search students by CHARUSAT ID or name"
                placeholder="Search students (e.g. 22DCSE001)..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                data-testid="input-global-search"
              />
              <kbd>⌘ K</kbd>
            </form>
            <Link
              href="/notifications"
              className="top-icon-wrap"
              aria-label={`Notifications, ${unread} unread`}
              data-testid="link-top-notifications"
            >
              <Bell size={18} />
              {unread > 0 && <i />}
            </Link>
            <button
              className="top-user"
              onClick={() => setRoleOpen(!roleOpen)}
              data-testid="button-top-user"
              aria-label="User menu"
            >
              <span className="avatar">{store.currentUser.avatar}</span>
              <ChevronDown size={13} />
            </button>
          </div>
        </header>

        <main className="content-area">
          <div className="page-enter">{children}</div>
        </main>

        <footer className="app-footer">
          <span>CHARUSAT · Charotar University of Science & Technology · Changa</span>
          <span>
            <span className="footer-dot" />
            15s Rotating Dynamic QR · FIDO2 WebAuthn Passkeys · Active Anti-Proxy Protection
          </span>
        </footer>
      </div>

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
