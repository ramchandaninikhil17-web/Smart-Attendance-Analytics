import React, { useState } from 'react';
import { Link } from 'wouter';
import { ArrowRight, Fingerprint, LockKeyhole, QrCode, ShieldCheck, Database, Check } from 'lucide-react';
import type { Role, Store } from '../data';
import { dataService } from '../data';
import { Button } from '../components';
import { roles } from '../utils';

interface LoginPageProps {
  store: Store;
  onSignedIn: () => void;
}

export function LoginPage({ store, onSignedIn }: LoginPageProps) {
  const [role, setRole] = useState<Role>(store.currentUser.role);
  const [message, setMessage] = useState('');

  const getRoleEmail = (r: Role) => {
    switch (r) {
      case 'Student':
        return '22dcse001@charusat.edu.in';
      case 'Teacher':
        return 'trushit.ce@charusat.ac.in';
      case 'Administrator':
      default:
        return 'amit.ganatra@charusat.ac.in';
    }
  };

  const getRoleDisplayName = (r: Role) => {
    switch (r) {
      case 'Student':
        return 'Aarav Patel (22DCSE001)';
      case 'Teacher':
        return 'Prof. Trushit Upadhyaya';
      case 'Administrator':
      default:
        return 'Dr. Amit Ganatra (Principal/Dean)';
    }
  };

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    dataService.switchRole(role);
    setMessage(`Authenticated as ${role} (${getRoleDisplayName(role)}). Loading workspace...`);
    setTimeout(onSignedIn, 300);
  };

  const handleQuickSelect = (r: Role) => {
    setRole(r);
    dataService.switchRole(r);
    setMessage(`Switched to ${r} session.`);
    setTimeout(onSignedIn, 250);
  };

  return (
    <div className="login-screen">
      <div className="login-aside">
        <Link href="/login" className="brand-lockup login-brand">
          <span className="brand-symbol"><span /></span>
          <span><strong>CHARUSAT</strong><small>SMART ATTENDANCE & ANALYTICS</small></span>
        </Link>
        <div className="login-story">
          <div className="eyebrow">CHAROTAR UNIVERSITY OF SCIENCE AND TECHNOLOGY</div>
          <h1>Precision Presence,<br /><em>Verified Integrity.</em></h1>
          <p>
            Enterprise anti-proxy attendance engineered for CHARUSAT campus cohorts across CSPIT, DEPSTAR, and CMPICA institutes.
          </p>
          <div className="login-stat-row">
            <div><b>50+</b><span>enrolled students</span></div>
            <div><b>15s</b><span>dynamic QR rotation</span></div>
            <div><b>100%</b><span>anti-proxy fidelity</span></div>
          </div>
        </div>
        <div className="login-side-foot">
          <span>{store.settings.campus}</span>
          <span>Changa Campus · NAAC A+ Accredited</span>
        </div>
        <div className="login-art">
          <div className="art-ring art-ring-one" />
          <div className="art-ring art-ring-two" />
          <div className="art-center"><span>CU</span><small>CHARUSAT ENTERPRISE</small></div>
          <div className="art-caption"><span className="art-indicator" /><span>Anti-Proxy Guard Active</span></div>
          <div className="art-percent">88<sup>%</sup><small>campus attendance</small></div>
        </div>
      </div>

      <div className="login-form-side">
        <div className="login-form-box">
          <span className="login-kicker">CHARUSAT SECURE SSO GATEWAY</span>
          <h2>Sign in to Campus Portal</h2>
          <p className="login-subtitle">Select an institutional role to explore the live attendance workflows.</p>
          
          {message && <div className="inline-notice">{message}</div>}

          {/* Quick Role Selection Badges */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '16px' }}>
            {roles.map(r => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                style={{
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: role === r ? '2px solid #187667' : '1px solid #dcd7ce',
                  background: role === r ? '#e8f4f1' : '#ffffff',
                  color: role === r ? '#187667' : '#576763',
                  fontWeight: role === r ? 600 : 500,
                  fontSize: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  textAlign: 'center',
                }}
              >
                {r === 'Administrator' ? 'Dean / Admin' : r === 'Teacher' ? 'Faculty' : 'Student'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSignIn} className="login-form">
            <label className="form-field">
              <span>Account Identity</span>
              <input
                type="email"
                value={getRoleEmail(role)}
                readOnly
                data-testid="input-login-email"
                style={{ background: '#faf9f6', cursor: 'default' }}
              />
            </label>

            <label className="form-field">
              <span>Assigned Member</span>
              <input
                type="text"
                value={getRoleDisplayName(role)}
                readOnly
                style={{ background: '#faf9f6', cursor: 'default' }}
              />
            </label>

            <Button type="submit" className="login-submit" testId="button-demo-sign-in">
              Continue as {role} <ArrowRight size={16} />
            </Button>
          </form>

          {/* Security Architecture Trust Chips */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '16px' }}>
            <div style={{ padding: '8px', borderRadius: '6px', background: '#f6f4ee', textAlign: 'center', fontSize: '11px' }}>
              <QrCode size={14} style={{ color: '#187667', margin: '0 auto 4px' }} />
              <div style={{ fontWeight: 600 }}>15s QR</div>
              <small style={{ color: '#889490' }}>Rolling OTP</small>
            </div>
            <div style={{ padding: '8px', borderRadius: '6px', background: '#f6f4ee', textAlign: 'center', fontSize: '11px' }}>
              <Fingerprint size={14} style={{ color: '#187667', margin: '0 auto 4px' }} />
              <div style={{ fontWeight: 600 }}>WebAuthn</div>
              <small style={{ color: '#889490' }}>FIDO2 Passkey</small>
            </div>
            <div style={{ padding: '8px', borderRadius: '6px', background: '#f6f4ee', textAlign: 'center', fontSize: '11px' }}>
              <Database size={14} style={{ color: '#187667', margin: '0 auto 4px' }} />
              <div style={{ fontWeight: 600 }}>Audit Log</div>
              <small style={{ color: '#889490' }}>SHA-256 Stamp</small>
            </div>
          </div>

          <div className="local-demo-note" style={{ marginTop: '16px' }}>
            <LockKeyhole size={15} />
            <span>
              <b>Enterprise FIDO2 & Anti-Proxy Simulation</b>
              <small>Simulates complete institutional single sign-on, Wi-Fi subnet validation, and hardware token checks.</small>
            </span>
          </div>

          <div className="login-divider"><span>OR LAUNCH DIRECT STUDENT VERIFICATION</span></div>
          
          <Link href="/verify" className="login-verify-link" data-testid="link-student-verification">
            <Fingerprint size={16} /> Student Passkey & QR Verification Scanner <ArrowRight size={14} />
          </Link>
        </div>

        <div className="login-bottom-note">
          CHARUSAT · Charotar University of Science & Technology · Changa, Anand, Gujarat 388421
        </div>
      </div>
    </div>
  );
}
