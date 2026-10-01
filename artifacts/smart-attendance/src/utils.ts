import type { Store, Role } from './data';
import {
  LayoutDashboard,
  ClipboardCheck,
  CalendarDays,
  Activity,
  GraduationCap,
  Users,
  BookOpen,
  ListChecks,
  Plus,
  ShieldCheck,
  LockKeyhole,
  FileBarChart2,
  Bell,
  Settings,
  Fingerprint,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const mainNav: NavItem[] = [
  { label: 'Overview', href: '/overview', icon: LayoutDashboard },
  { label: 'Attendance', href: '/attendance', icon: ClipboardCheck },
  { label: 'Sessions', href: '/sessions', icon: CalendarDays },
  { label: 'Analytics', href: '/analytics', icon: Activity },
];

export const peopleNav: NavItem[] = [
  { label: 'Students', href: '/students', icon: GraduationCap },
  { label: 'Teachers', href: '/teachers', icon: Users },
  { label: 'Classes', href: '/classes', icon: BookOpen },
  { label: 'Subjects', href: '/subjects', icon: ListChecks },
  { label: 'Enrollments', href: '/enrollments', icon: Plus },
];

export const operationsNav: NavItem[] = [
  { label: 'Security', href: '/security', icon: ShieldCheck },
  { label: 'Audit trail', href: '/audit', icon: LockKeyhole },
  { label: 'Reports', href: '/reports', icon: FileBarChart2 },
  { label: 'Notifications', href: '/notifications', icon: Bell },
  { label: 'Settings', href: '/settings', icon: Settings },
];

export const allNav: NavItem[] = [
  ...mainNav,
  ...peopleNav,
  ...operationsNav,
  { label: 'Verify attendance', href: '/verify', icon: Fingerprint },
];

export const roles: Role[] = ['Administrator', 'Teacher', 'Student'];

export const attendanceColors = ['#187667', '#d39c48', '#d76c60', '#718293'];

export const fmtTime = (date: string) =>
  new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(new Date(date));

export const fmtDate = (date: string) =>
  new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(date));

export const since = (date: string) => {
  const minutes = Math.max(1, Math.floor((Date.now() - new Date(date).getTime()) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

export const initials = (name: string) =>
  name
    .split(' ')
    .slice(0, 2)
    .map(x => x[0])
    .join('')
    .toUpperCase();

export const getClass = (store: Store, id: string) => store.classes.find(c => c.id === id);

export const getTeacher = (store: Store, id: string) => store.teachers.find(t => t.id === id);

export const presentCount = (session: Store['sessions'][number]) =>
  session.attendanceRecords.filter(r => r.status === 'Present' || r.status === 'Late').length;

export const classLabel = (store: Store, id: string) => {
  const c = getClass(store, id);
  return c ? `${c.name} · ${c.section}` : 'Unassigned';
};

export const formatGreetingName = (fullName: string) => {
  if (fullName.startsWith('Dr.')) {
    const parts = fullName.split(' ');
    return parts.length > 2 ? `Dr. ${parts.slice(1).join(' ')}` : fullName;
  }
  if (fullName.startsWith('Prof.')) {
    const parts = fullName.split(' ');
    return parts.length > 2 ? `Prof. ${parts.slice(1).join(' ')}` : fullName;
  }
  return fullName.split(' ')[0];
};

export function toneForStatus(status: string): 'green' | 'amber' | 'red' | 'blue' | 'neutral' | 'muted' {
  if (['Present', 'Active', 'Completed', 'Reviewed', 'Verified', 'On track'].includes(status)) return 'green';
  if (['Late', 'At risk', 'Needs review', 'Paused', 'Medium', 'Warning'].includes(status)) return 'amber';
  if (['Absent', 'High', 'Critical'].includes(status)) return 'red';
  if (['Live', 'Info'].includes(status)) return 'blue';
  if (['Excused'].includes(status)) return 'neutral';
  return 'muted';
}

export function downloadFile(content: string, name: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
