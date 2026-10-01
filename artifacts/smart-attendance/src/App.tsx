import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Route, Switch, useLocation } from 'wouter';
import { CheckCircle2, X } from 'lucide-react';
import './app.css';

import { dataService, type Store } from './data';
import { Shell } from './components/Shell';

// Modular Page Components
import { LoginPage } from './pages/LoginPage';
import { OverviewPage } from './pages/OverviewPage';
import { AttendancePage } from './pages/AttendancePage';
import { SessionsPage } from './pages/SessionsPage';
import { LiveSessionPage } from './pages/LiveSessionPage';
import { VerifyPage } from './pages/VerifyPage';
import { StudentsPage } from './pages/StudentsPage';
import { StudentDetailPage } from './pages/StudentDetailPage';
import { TeachersPage } from './pages/TeachersPage';
import { ClassesPage } from './pages/ClassesPage';
import { SubjectsPage } from './pages/SubjectsPage';
import { EnrollmentsPage } from './pages/EnrollmentsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { SecurityPage } from './pages/SecurityPage';
import { AuditPage } from './pages/AuditPage';
import { ReportsPage } from './pages/ReportsPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { SettingsPage } from './pages/SettingsPage';
import { NotFoundPage } from './pages/NotFoundPage';

function useStore(): Store {
  return useSyncExternalStore(dataService.subscribe, dataService.get, dataService.get);
}

function Redirect({ path }: { path: string }) {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation(path);
  }, [path, setLocation]);
  return null;
}

export function App() {
  const store = useStore();
  const [location, setLocation] = useLocation();
  const [toast, setToast] = useState('');
  const isLogin = location === '/login';

  return (
    <div className={`app-shell ${store.settings.compact ? 'compact-mode' : ''}`}>
      {isLogin ? (
        <LoginPage store={store} onSignedIn={() => setLocation('/overview')} />
      ) : (
        <Shell store={store} onToast={setToast}>
          <Switch>
            <Route path="/" component={() => <Redirect path="/overview" />} />
            <Route path="/overview" component={() => <OverviewPage store={store} onToast={setToast} />} />
            <Route path="/attendance" component={() => <AttendancePage store={store} toast={setToast} />} />
            <Route path="/sessions" component={() => <SessionsPage store={store} toast={setToast} />} />
            <Route path="/session/live" component={() => <LiveSessionPage store={store} toast={setToast} />} />
            <Route path="/verify" component={() => <VerifyPage store={store} toast={setToast} />} />
            <Route path="/students" component={() => <StudentsPage store={store} toast={setToast} />} />
            <Route path="/students/:id" component={() => <StudentDetailPage store={store} toast={setToast} />} />
            <Route path="/teachers" component={() => <TeachersPage store={store} toast={setToast} />} />
            <Route path="/classes" component={() => <ClassesPage store={store} toast={setToast} />} />
            <Route path="/subjects" component={() => <SubjectsPage store={store} toast={setToast} />} />
            <Route path="/enrollments" component={() => <EnrollmentsPage store={store} toast={setToast} />} />
            <Route path="/analytics" component={() => <AnalyticsPage store={store} toast={setToast} />} />
            <Route path="/security" component={() => <SecurityPage store={store} toast={setToast} />} />
            <Route path="/audit" component={() => <AuditPage store={store} />} />
            <Route path="/reports" component={() => <ReportsPage store={store} toast={setToast} />} />
            <Route path="/notifications" component={() => <NotificationsPage store={store} />} />
            <Route path="/settings" component={() => <SettingsPage store={store} toast={setToast} />} />
            <Route component={NotFoundPage} />
          </Switch>
        </Shell>
      )}

      {toast && (
        <div className="toast-message" role="status" data-testid="status-toast">
          <CheckCircle2 size={17} />
          <span>{toast}</span>
          <button onClick={() => setToast('')} aria-label="Dismiss notification">
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}

export default App;