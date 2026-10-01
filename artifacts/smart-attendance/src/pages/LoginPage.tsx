import React, { useState } from 'react';
import { Link } from 'wouter';
import { ArrowRight, Fingerprint, LockKeyhole, QrCode, Database, AlertTriangle } from 'lucide-react';
import type { Store } from '../data';
import { Button } from '../components';
import { loginWithBackend, fetchCurrentUser } from '../api';
import { dataService } from '../data';

interface LoginPageProps {
  store: Store;
  onSignedIn: () => void;
}

export function LoginPage({ store, onSignedIn }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const result = await loginWithBackend(email, password);
      
      if (result.success && result.data?.user) {
        // Backend determines role
        const role = result.data.user.role === 'ADMIN' ? 'Administrator' : 
                     result.data.user.role === 'TEACHER' ? 'Teacher' : 'Student';
        
        setMessage(`Authenticated as ${role}. Loading workspace...`);
        
        // Update local mock store for hybrid compatibility if needed
        dataService.switchRole(role);
        
        setTimeout(onSignedIn, 300);
      } else {
        setError(result.error || result.message || 'Login failed. Please check your credentials.');
      }
    } catch (err: any) {
      setError('An error occurred during login.');
    } finally {
      setLoading(false);
    }
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
          <span>Changa Campus - NAAC A+ Accredited</span>
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
          <p className="login-subtitle">Enter your university email and password to continue.</p>
          
          {message && <div className="inline-notice">{message}</div>}
          
          {error && (
            <div className="form-error" role="alert" style={{ marginBottom: 16 }}>
              <AlertTriangle size={15} /> {error}
            </div>
          )}

          <form onSubmit={handleSignIn} className="login-form">
            <label className="form-field">
              <span>University Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="id@charusat.edu.in"
                required
                data-testid="input-login-email"
              />
            </label>

            <label className="form-field">
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </label>

            <Button type="submit" className="login-submit" testId="button-demo-sign-in" disabled={loading}>
              {loading ? 'Authenticating...' : 'Sign In'} <ArrowRight size={16} />
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

          <div className="login-divider"><span>OR LAUNCH DIRECT STUDENT VERIFICATION</span></div>
          
          <Link href="/verify" className="login-verify-link" data-testid="link-student-verification">
            <Fingerprint size={16} /> Student Passkey & QR Verification Scanner <ArrowRight size={14} />
          </Link>
        </div>

        <div className="login-bottom-note">
          CHARUSAT - Charotar University of Science & Technology - Changa, Anand, Gujarat 388421
        </div>
      </div>
    </div>
  );
}
