import React, { useState } from 'react';
import { Link } from 'wouter';
import {
  Camera, KeyRound, Smartphone, Fingerprint, Check, CheckCircle2,
  AlertTriangle, ShieldCheck, LockKeyhole, ArrowRight,
} from 'lucide-react';
import type { Store } from '../data';
import { dataService } from '../data';
import { Badge, Button, Card } from '../components';
import { classLabel, initials, fmtTime } from '../utils';

interface VerifyPageProps {
  store: Store;
  toast: (message: string) => void;
}

export function VerifyPage({ store, toast }: VerifyPageProps) {
  const [step, setStep] = useState<'method' | 'passkey' | 'success'>('method');
  const [mode, setMode] = useState<'qr' | 'code'>('qr');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);

  const active = store.sessions.find(s => s.status === 'Live' || s.status === 'Paused');
  const student = store.students[0]; // Aarav Patel
  const alreadyCheckedIn = active?.attendanceRecords.some(r => r.studentId === student?.id && r.status === 'Present');

  // Trigger camera scan simulation
  const handleSimulateScan = () => {
    if (!active) {
      setError('No live session is currently open in your department.');
      return;
    }
    setIsScanning(true);
    setError('');
    setTimeout(() => {
      setIsScanning(false);
      setCode(active.code);
      setStep('passkey');
    }, 1800);
  };

  const handleManualCodeSubmit = () => {
    setError('');
    if (!active) {
      setError('There is no active lecture session right now.');
      return;
    }
    if (code.replace(/\s/g, '') !== active.code.replace(/\s/g, '')) {
      setError('Invalid session code. Check the classroom screen for the current 15s rotating code.');
      return;
    }
    setStep('passkey');
  };

  const handleBiometricAuth = () => {
    setAuthenticating(true);
    setTimeout(() => {
      setAuthenticating(false);
      if (active && student) {
        dataService.confirmStudentPresence(active.id, student.id, 'Passkey (WebAuthn)');
      }
      setStep('success');
      toast('CHARUSAT Biometric passkey verified! Attendance recorded.');
    }, 1500);
  };

  return (
    <div className="verify-page">
      <div className="verify-nav">
        <Link href="/overview" className="brand-lockup">
          <span className="brand-symbol"><span /></span>
          <span><strong>CHARUSAT</strong><small>SMART ATTENDANCE & ANALYTICS</small></span>
        </Link>
        <Badge tone="blue">CHARUSAT STUDENT VERIFICATION PORTAL</Badge>
      </div>

      <div className="verify-layout">
        <div className="verify-main">
          <div className="verify-breadcrumb">
            <span>Classroom Check-In</span>
            <span>/</span>
            <b>Anti-Proxy Protocol</b>
          </div>

          <div className="verify-heading">
            <span className="verify-step-label">
              STEP {step === 'method' ? '01' : step === 'passkey' ? '02' : '03'} <span>OF 03</span>
            </span>
            <h1>
              {step === 'success'
                ? 'Attendance confirmed.'
                : step === 'passkey'
                ? 'WebAuthn passkey verification.'
                : 'Confirm classroom presence.'}
            </h1>
            <p>
              {step === 'success'
                ? 'Your in-person attendance is cryptographically signed and stored in this local session.'
                : step === 'passkey'
                ? 'Verify your biometric identity with your device hardware passkey to finalize check-in.'
                : 'Scan the 15-second rotating QR code projected in class, or enter the synchronized code.'}
            </p>
          </div>

          {/* STEP 1: QR Scanner / Code Entry */}
          {step === 'method' && (
            <Card className="verify-form-card">
              <div className="verify-user-ident">
                <span className="avatar avatar-large">{initials(student?.name ?? 'Aarav Patel')}</span>
                <div>
                  <small style={{ fontSize: '9px', color: '#7a8682', fontWeight: 600 }}>CONFIRMING PRESENCE FOR</small>
                  <b style={{ display: 'block', fontSize: '13px' }}>{student?.name ?? 'Aarav Patel'}</b>
                  <small style={{ color: '#889592' }}>{student?.studentId ?? '22DCSE001'} · {classLabel(store, student?.classId ?? 'c1')}</small>
                </div>
              </div>

              {alreadyCheckedIn && (
                <div className="inline-notice" style={{ background: '#eaf4ef', color: '#1a6857', border: '1px solid #c2e2d5' }}>
                  <CheckCircle2 size={16} /> You have already verified attendance for today's active session.
                </div>
              )}

              {/* Mode Toggle: Camera Scanner vs 6-digit Code */}
              <div className="verify-method-toggle">
                <button
                  type="button"
                  className={mode === 'qr' ? 'selected' : ''}
                  onClick={() => setMode('qr')}
                  data-testid="button-mode-qr"
                >
                  <Camera size={16} /> Camera QR scanner
                </button>
                <button
                  type="button"
                  className={mode === 'code' ? 'selected' : ''}
                  onClick={() => setMode('code')}
                  data-testid="button-mode-code"
                >
                  <KeyRound size={16} /> 6-digit security code
                </button>
              </div>

              {mode === 'qr' ? (
                <div style={{ textAlign: 'center', marginTop: 12 }}>
                  <div className="camera-scanner">
                    <div className="scanner-overlay">
                      <div className="scanner-corner top-left" />
                      <div className="scanner-corner top-right" />
                      <div className="scanner-corner bottom-left" />
                      <div className="scanner-corner bottom-right" />
                      <div className="scanner-laser" />
                    </div>
                    <Smartphone size={56} color="#2b4744" />
                    <div className="scanner-status">
                      {isScanning ? 'Decoding rotating QR token...' : 'Align classroom QR code'}
                    </div>
                  </div>
                  <Button
                    onClick={handleSimulateScan}
                    disabled={isScanning}
                    className="full-width"
                    testId="button-scan-qr"
                  >
                    <Camera size={16} /> {isScanning ? 'Scanning...' : 'Scan classroom QR code'}
                  </Button>
                  <p style={{ fontSize: 10, color: '#85928e', marginTop: 8 }}>
                    Point your camera at the teacher's projected screen to capture the 15-second rotating token.
                  </p>
                </div>
              ) : (
                <div style={{ marginTop: 14 }}>
                  <label className="form-field code-input-field">
                    <span>6-digit rotating security code</span>
                    <input
                      value={code}
                      maxLength={7}
                      inputMode="numeric"
                      placeholder="000 000"
                      onChange={e => setCode(e.target.value.replace(/[^\d ]/g, ''))}
                      data-testid="input-verification-code"
                      style={{ fontSize: 24, textAlign: 'center', letterSpacing: 4, fontFamily: 'var(--app-font-mono)' }}
                    />
                    <small>Enter the synchronized code shown on the classroom screen.</small>
                  </label>
                  <Button
                    className="full-width verify-submit"
                    onClick={handleManualCodeSubmit}
                    disabled={code.replace(/\s/g, '').length < 6}
                    testId="button-submit-code"
                  >
                    Validate code <ArrowRight size={16} />
                  </Button>
                </div>
              )}

              {error && (
                <div className="form-error" role="alert" style={{ marginTop: 10 }}>
                  <AlertTriangle size={15} /> {error}
                </div>
              )}

              <div className="verify-privacy-note">
                <ShieldCheck size={15} />
                <span>Anti-proxy defense: Token validity is locked to this 15-second epoch and CHARUSAT Wi-Fi perimeter.</span>
              </div>
            </Card>
          )}

          {/* STEP 2: Passkey (WebAuthn) Biometric Verification */}
          {step === 'passkey' && (
            <Card className="verify-confirm-card">
              <div className="passkey-box">
                <button
                  type="button"
                  className={`biometric-sensor ${authenticating ? 'scanning' : ''}`}
                  onClick={handleBiometricAuth}
                  aria-label="Authenticate with Passkey"
                >
                  <Fingerprint size={36} />
                </button>
                <h3 style={{ margin: '0 0 4px', fontSize: '15px' }}>
                  {authenticating ? 'Verifying hardware passkey...' : 'Touch sensor to authenticate'}
                </h3>
                <p style={{ margin: 0, fontSize: '11px', color: '#687773' }}>
                  Touch ID / Face ID hardware validation (FIDO2 WebAuthn)
                </p>

                <div className="passkey-attestation">
                  <div className="passkey-attestation-item">
                    <span>Hardware Token:</span>
                    <b>FIDO2 Authenticator / Secure Enclave</b>
                  </div>
                  <div className="passkey-attestation-item">
                    <span>Lecture Cohort:</span>
                    <b>{active ? classLabel(store, active.classId) : 'CSPIT CE-A'}</b>
                  </div>
                  <div className="passkey-attestation-item">
                    <span>Geofence Status:</span>
                    <b style={{ color: '#187667' }}>Within 25m (CSPIT Room 204)</b>
                  </div>
                  <div className="passkey-attestation-item">
                    <span>Nonce Timestamp:</span>
                    <b>Valid (Fresh 15s window)</b>
                  </div>
                </div>
              </div>

              <div className="confirm-actions">
                <Button variant="secondary" onClick={() => setStep('method')}>
                  Back
                </Button>
                <Button
                  onClick={handleBiometricAuth}
                  disabled={authenticating}
                  testId="button-submit-attendance"
                >
                  <Fingerprint size={16} /> {authenticating ? 'Signing...' : 'Verify passkey & sign'}
                </Button>
              </div>

              <p className="confirm-disclaimer">
                Passkey signatures prove authentic physical possession of this enrolled hardware device.
              </p>
            </Card>
          )}

          {/* STEP 3: Attendance Confirmation */}
          {step === 'success' && (
            <Card className="verify-success-card">
              <div className="success-stamp"><Check size={30} /></div>
              <span className="eyebrow">VERIFICATION COMMITTED</span>
              <h2>You’re marked present, {student?.name.split(' ')[0]}.</h2>
              <p>Your biometric presence for {classLabel(store, active?.classId ?? 'c1')} was cryptographically verified and recorded.</p>

              <div className="success-row">
                <span><CheckCircle2 size={16} /> Verified via Passkey (WebAuthn)</span>
                <span>{fmtTime(new Date().toISOString())}</span>
              </div>

              <div style={{ padding: '12px 14px', background: '#f5f3ec', borderRadius: 8, fontSize: 11, margin: '14px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: '#6a7874' }}>Updated Attendance Rate:</span>
                  <b style={{ color: '#187667' }}>{student?.attendancePercent ?? 88}% (Healthy)</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6a7874' }}>Cryptographic Proof:</span>
                  <span style={{ fontFamily: 'var(--app-font-mono)', fontSize: 10 }}>auth_fido2_8f29c...</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <Link href="/overview" className="button button-primary" style={{ flex: 1 }}>
                  Return to student dashboard <ArrowRight size={14} />
                </Link>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setStep('method');
                    setCode('');
                  }}
                >
                  New check-in
                </Button>
              </div>
            </Card>
          )}
        </div>

        <aside className="verify-aside">
          <div className="verification-progress">
            <span>CHECK-IN PIPELINE</span>
            <div className="progress-dots">
              <i className={step !== 'method' ? 'done' : 'current'} />
              <i className={step === 'passkey' ? 'current' : step === 'success' ? 'done' : ''} />
              <i className={step === 'success' ? 'done' : ''} />
            </div>
          </div>

          <div className="verify-class-art">
            <div className="class-art-lines"><span /><span /><span /><span /></div>
            <div className="class-art-center">
              <div className="class-art-mark">CU</div>
              <small>SESSION STATUS</small>
              <b>{active ? classLabel(store, active.classId) : 'No live session'}</b>
            </div>
          </div>

          <div className="verify-aside-copy">
            <span className="eyebrow">ZERO-TRUST VERIFICATION</span>
            <h2>Fair, fast, and proxy-proof.</h2>
            <p>Rotating classroom challenge tokens combined with local biometric hardware make attendance reliable and effortless.</p>
          </div>

          <div className="aside-privacy">
            <LockKeyhole size={15} />
            <span>Biometric data never leaves your device. Only cryptographic attestations are transmitted.</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
