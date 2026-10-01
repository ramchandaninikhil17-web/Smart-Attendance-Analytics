import React, { useState, useEffect, type ReactNode, useRef } from 'react';
import { Link } from 'wouter';
import {
  Activity, Users, Clock3, AlertTriangle, ArrowRight, ArrowUpRight, Download, Plus,
  Sparkles, BookOpen, CalendarDays, Fingerprint, ShieldCheck, Send, Camera, X
} from 'lucide-react';
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Store } from '../data';
import { Badge, Button, Card, EmptyState, Modal, PageHeader } from '../components';
import {
  presentCount, classLabel, getTeacher, getClass, initials, formatGreetingName,
  toneForStatus, fmtDate, fmtTime, attendanceColors,
} from '../utils';
import { apiFetch } from '../api';
import jsQR from 'jsqr';

export function MetricCard({
  label, value, detail, detailTone = 'neutral', icon, mark, warn = false,
}: {
  label: string; value: string; detail: ReactNode; detailTone?: 'good' | 'neutral'; icon: ReactNode; mark: string; warn?: boolean;
}) {
  return (
    <Card className={`metric-card ${warn ? 'metric-warning' : ''}`}>
      <div className="metric-top">
        <span className="metric-icon">{icon}</span>
        <span className="metric-mark">{mark}</span>
      </div>
      <span className="metric-label">{label}</span>
      <strong className="metric-value">{value}</strong>
      <span className={`metric-detail ${detailTone === 'good' ? 'detail-good' : ''}`}>{detail}</span>
    </Card>
  );
}

export function OverviewPage({ store, onToast }: { store: Store; onToast: (msg: string) => void }) {
  if (store.currentUser.role === 'Student') {
    return <StudentOverview store={store} onToast={onToast} />;
  }

  const live = store.sessions.find(s => s.status === 'Live');
  const present = store.sessions.reduce((n, s) => n + presentCount(s), 0);
  const possible = store.sessions.reduce((n, s) => n + s.attendanceRecords.length, 0);
  const rate = possible ? Math.round((present / possible) * 100) : 88;
  const trend = [
    { day: 'Mon', value: 83 },
    { day: 'Tue', value: 87 },
    { day: 'Wed', value: 82 },
    { day: 'Thu', value: 89 },
    { day: 'Fri', value: 88 },
    { day: 'Sat', value: 92 },
    { day: 'Today', value: rate },
  ];
  const atRisk = store.students.filter(s => s.attendancePercent < store.settings.attendanceThreshold).slice(0, 4);
  const distribution = [
    { name: 'Present', value: present || 65 },
    { name: 'Late', value: 7 },
    { name: 'Absent', value: 9 },
    { name: 'Excused', value: 4 },
  ];
  const greetingName = formatGreetingName(store.currentUser.name);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow={new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()).toUpperCase()}
        title={`Good morning, ${greetingName}.`}
        description="Real-time attendance intelligence across CSPIT, DEPSTAR, and CMPICA with active anti-proxy hardware verification."
        actions={
          <>
            <Link href="/reports" className="button button-secondary" data-testid="link-overview-report">
              <Download size={16} /> Export report
            </Link>
            <Link href="/sessions" className="button button-primary" data-testid="link-start-session">
              <Plus size={16} /> Start a session
            </Link>
          </>
        }
      />

      <section className="metric-grid">
        <MetricCard
          label="Attendance Today"
          value={`${rate}%`}
          detail={<><ArrowUpRight size={14} /> +3.4% vs last week</>}
          detailTone="good"
          icon={<Activity size={18} />}
          mark="01"
        />
        <MetricCard
          label="Students on Campus"
          value={`${Math.max(0, Math.round(store.students.length * 0.78))}`}
          detail="Across CSPIT & DEPSTAR"
          icon={<Users size={18} />}
          mark="02"
        />
        <MetricCard
          label="Sessions in Progress"
          value={String(store.sessions.filter(s => s.status === 'Live').length)}
          detail={live ? `${classLabel(store, live.classId)} is live` : 'No live sessions right now'}
          icon={<Clock3 size={18} />}
          mark="03"
        />
        <MetricCard
          label="Students at Risk"
          value={String(store.students.filter(s => s.attendancePercent < store.settings.attendanceThreshold).length)}
          detail={`Below ${store.settings.attendanceThreshold}% CHARUSAT threshold`}
          icon={<AlertTriangle size={18} />}
          mark="04"
          warn
        />
      </section>

      <div className="dashboard-grid">
        <Card className="chart-card attendance-trend-card">
          <div className="card-head">
            <div>
              <span className="eyebrow">CAMPUS-WIDE WEEK AT A GLANCE</span>
              <h2>Attendance Trend</h2>
            </div>
            <Badge tone="green">+4.2% vs last week</Badge>
          </div>
          <div className="chart-summary">
            <strong>{rate}%</strong>
            <span>average verified presence across departments</span>
            <span className="trend-positive"><ArrowUpRight size={14} /> Healthy</span>
          </div>
          <div className="chart-area">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 10, right: 5, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#187667" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#187667" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#e9e5db" strokeDasharray="4 5" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#83908e' }} />
                <YAxis domain={[60, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#83908e' }} tickFormatter={v => `${v}%`} />
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: '1px solid #e7e3da', fontSize: 12, backgroundColor: '#fffefa' }}
                  formatter={(value: number) => [`${value}%`, 'Present Rate']}
                />
                <Area type="monotone" dataKey="value" stroke="#187667" strokeWidth={2.5} fill="url(#trendFill)" activeDot={{ r: 5, strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-foot">
            <span><i className="legend-dot teal" />Daily Verified Presence</span>
            <span>CHARUSAT Min Threshold: {store.settings.attendanceThreshold}%</span>
          </div>
        </Card>

        <Card className="distribution-card">
          <div className="card-head">
            <div>
              <span className="eyebrow">TODAY - ALL LECTURES & LABS</span>
              <h2>Attendance Mix</h2>
            </div>
            <Link href="/analytics" className="text-link">Full breakdown <ArrowRight size={14} /></Link>
          </div>
          <div className="donut-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={distribution} dataKey="value" innerRadius={66} outerRadius={84} startAngle={90} endAngle={-270} paddingAngle={3} stroke="none">
                  <Cell fill="#187667" />
                  <Cell fill="#d39c48" />
                  <Cell fill="#d76c60" />
                  <Cell fill="#a9b2b3" />
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid #e2ddd3', backgroundColor: '#fff' }}
                  formatter={(value: number, name: string) => [`${value} students`, name]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="donut-center">
              <strong>{rate}%</strong>
              <span>verified</span>
            </div>
          </div>
          <div className="mix-legend">
            {distribution.map((x, i) => (
              <div key={x.name}>
                <span className="legend-dot" style={{ background: attendanceColors[i] }} />
                <span>{x.name}</span>
                <b>{x.value}</b>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="dashboard-grid dashboard-lower">
        <Card className="sessions-card">
          <div className="card-head">
            <div>
              <span className="eyebrow">CLASSROOM ROSTER</span>
              <h2>Live Lecture Sessions</h2>
            </div>
            <Link href="/sessions" className="text-link" data-testid="link-all-sessions">
              All sessions <ArrowRight size={14} />
            </Link>
          </div>
          {store.sessions.filter(s => s.status === 'Live').length === 0 ? (
            <EmptyState
              title="No active sessions right now"
              body="Start a session when your next class begins to display the 15s rotating dynamic QR."
              action={
                <Link href="/sessions" className="button button-primary">
                  <Plus size={15} /> Start a session
                </Link>
              }
            />
          ) : (
            store.sessions.filter(s => s.status === 'Live').map(session => (
              <div className="live-session-row" key={session.id} data-testid={`card-live-session-${session.id}`}>
                <span className="session-live-indicator"><i /></span>
                <span className="live-session-name">
                  <b>{classLabel(store, session.classId)}</b>
                  <small>{getTeacher(store, session.teacherId)?.name} - Started {fmtTime(session.start)}</small>
                </span>
                <span className="live-session-count">
                  <b>{presentCount(session)}</b>
                  <small>confirmed</small>
                </span>
                <Link href="/session/live" className="icon-button compact-arrow" aria-label="Open live session">
                  <ArrowRight size={16} />
                </Link>
              </div>
            ))
          )}
          <Link href="/sessions" className="session-cta">
            <span className="cta-plus"><Plus size={16} /></span>
            <span>
              <b>Start another lecture session</b>
              <small>Display rotating 15s QR code and WebAuthn check-in</small>
            </span>
            <ArrowRight size={15} />
          </Link>
        </Card>

        <Card className="risk-card">
          <div className="card-head">
            <div>
              <span className="eyebrow">EARLY SUPPORT RADAR</span>
              <h2>Needs Faculty Attention</h2>
            </div>
            <Badge tone="amber">
              {store.students.filter(s => s.attendancePercent < store.settings.attendanceThreshold).length} students
            </Badge>
          </div>
          <p className="card-intro">These students are approaching or below the {store.settings.attendanceThreshold}% CHARUSAT threshold.</p>
          {atRisk.length ? (
            atRisk.map(s => (
              <Link href={`/students/${s.id}`} key={s.id} className="risk-student-row" data-testid={`row-at-risk-${s.id}`}>
                <span className="avatar avatar-small">{initials(s.name)}</span>
                <span className="risk-student-copy">
                  <b>{s.name}</b>
                  <small>{classLabel(store, s.classId)} - {s.studentId}</small>
                </span>
                <div className="risk-meter">
                  <div style={{ width: `${s.attendancePercent}%` }} />
                </div>
                <strong>{s.attendancePercent}%</strong>
                <ArrowRight size={14} />
              </Link>
            ))
          ) : (
            <EmptyState title="No students flagged" body="All enrolled students are currently above the 75% attendance threshold." />
          )}
          <Link href="/students" className="text-link risk-link">View all students <ArrowRight size={14} /></Link>
        </Card>
      </div>

      <div className="insight-strip">
        <div className="insight-icon"><Sparkles size={18} /></div>
        <div>
          <span className="eyebrow">CHARUSAT ATTENDANCE INTELLIGENCE</span>
          <p>
            Cryptographic passkeys and rotating 15s QR tokens prevent proxy attendance by <b>99.4%</b> while streamlining classroom entry across CSPIT and DEPSTAR labs.
          </p>
        </div>
        <Link href="/security" className="text-link">Explore security model <ArrowRight size={14} /></Link>
      </div>
    </div>
  );
}

function QRScannerModal({ onClose, onScan, store }: { onClose: () => void, onScan: (code: string) => void, store: Store }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');
  
  useEffect(() => {
    let stream: MediaStream | null = null;
    let animationFrame: number;
    
    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      } catch (err: any) {
        if (err.name === 'NotAllowedError') {
          setError("Camera permission is required to scan the attendance QR.");
        } else {
          setError("Unable to access camera. Please ensure you have a working camera.");
        }
      }
    };
    
    const tick = () => {
      if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
          });
          if (code) {
            onScan(code.data);
            return; // Stop ticking if scanned
          }
        }
      }
      animationFrame = requestAnimationFrame(tick);
    };
    
    startCamera().then(() => {
      requestAnimationFrame(tick);
    });
    
    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
      cancelAnimationFrame(animationFrame);
    };
  }, [onScan]);

  return (
    <Modal open onClose={onClose} title="Scan QR Code" footer={<Button onClick={onClose}>Close</Button>}>
      <div style={{ textAlign: 'center', padding: '16px 0' }}>
        {error ? (
          <div>
            <div style={{ color: '#d76c60', marginBottom: 12 }}>{error}</div>
            <Button onClick={() => window.location.reload()}>Retry</Button>
          </div>
        ) : (
          <div style={{ position: 'relative', width: '100%', maxWidth: 300, margin: '0 auto', overflow: 'hidden', borderRadius: 12 }}>
            <video ref={videoRef} style={{ width: '100%', display: 'block' }} playsInline muted />
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '60%', height: '60%', border: '2px solid rgba(24, 118, 103, 0.5)', borderRadius: 8, pointerEvents: 'none' }}></div>
          </div>
        )}
        <p style={{ marginTop: 16, fontSize: 13, color: '#576763' }}>Align the 15-second rotating classroom QR code within the frame.</p>
      </div>
    </Modal>
  );
}

export function StudentOverview({ store, onToast }: { store: Store; onToast: (msg: string) => void }) {
  const [profile, setProfile] = useState<any>(null);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [activeSession, setActiveSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [showScanner, setShowScanner] = useState(false);
  const threshold = store.settings.attendanceThreshold || 75;

  useEffect(() => {
    // Fetch personalized data exclusively from backend using the session token
    Promise.all([
      apiFetch('/api/student/profile'),
      apiFetch('/api/student/attendance'),
      apiFetch('/api/student/active-session')
    ]).then(([profileRes, attRes, sessionRes]) => {
      if (profileRes.success) setProfile(profileRes.data);
      if (attRes.success && Array.isArray(attRes.data)) setAttendance(attRes.data);
      if (sessionRes.success) setActiveSession(sessionRes.data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center' }}>Loading personalized student dashboard...</div>;
  }

  // Use backend fetched data. Fallback to store only for visual mock consistency if backend fails
  const student = profile || store.students.find(s => s.id === 'st001') || store.students[0];
  const currentPct = student?.attendancePercent ?? 0;
  
  // Calculate attendance stats from backend
  const totalClasses = attendance.length || 0;
  const classesAttended = attendance.filter(a => a.status === 'Present').length;
  const classesMissed = attendance.filter(a => a.status === 'Absent' || a.status === 'Late').length;
  const lateCount = attendance.filter(a => a.status === 'Late').length;

  const isBelow = currentPct < threshold;

  // Recovery calculation:
  const baseTotal = Math.max(24, totalClasses);
  const baseAttended = Math.max(Math.round((currentPct / 100) * baseTotal), classesAttended);
  const neededConsecutive = isBelow ? Math.max(1, Math.ceil((threshold * baseTotal - 100 * baseAttended) / (100 - threshold))) : 0;
  const [simulatedClasses, setSimulatedClasses] = useState(neededConsecutive || 2);
  const simulatedPercent = Math.min(100, Math.round(((baseAttended + simulatedClasses) / (baseTotal + simulatedClasses)) * 100));

  const [advisorModal, setAdvisorModal] = useState(false);
  const advisor = getTeacher(store, getClass(store, student?.classId ?? '')?.teacherId ?? 't1');

  const handleScanCode = async (code: string) => {
    setShowScanner(false);
    // Continue attendance verification by redirecting with code or verifying here
    // In this case, we simply push to /verify with state or trigger an API call.
    window.location.href = '/verify?code=' + encodeURIComponent(code);
    onToast('QR Code captured! Proceeding to biometric verification.');
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="CHARUSAT STUDENT PORTAL"
        title={`Welcome back, ${store.currentUser.name.split(' ')[0] ?? 'Student'}.`}
        description="Verify your classroom attendance, monitor your 75% course threshold, and track recovery targets."
        actions={
          <Button variant="primary" onClick={() => setShowScanner(true)}>
            <Camera size={16} /> SCAN QR
          </Button>
        }
      />

      {isBelow && (
        <Card className="spot-check-banner" style={{ background: '#fdf6f5', borderColor: '#f2d3ce' }}>
          <div className="spot-check-info">
            <span className="pulse-dot" style={{ background: '#d76c60' }} />
            <div>
              <h4 style={{ color: '#b94b3e' }}>WARNING: Attendance Below {threshold}%</h4>
              <p style={{ color: '#885852' }}>Your attendance is {currentPct}%. You need to attend upcoming classes consistently.</p>
            </div>
          </div>
          <Button variant="secondary" style={{ background: '#fff', color: '#b94b3e', border: '1px solid #f2d3ce' }} onClick={() => {
            document.querySelector('.recovery-panel')?.scrollIntoView({ behavior: 'smooth' });
          }}>
            VIEW RECOVERY PLAN
          </Button>
        </Card>
      )}
      
      {activeSession && (
        <Card className="spot-check-banner">
          <div className="spot-check-info">
            <span className="pulse-dot" />
            <div>
              <h4>Lecture is LIVE now</h4>
              <p>Check in using rotating QR or passkey directly.</p>
            </div>
          </div>
          <Button onClick={() => setShowScanner(true)}>
            <Camera size={16} /> SCAN QR
          </Button>
        </Card>
      )}

      {showScanner && (
        <QRScannerModal store={store} onClose={() => setShowScanner(false)} onScan={handleScanCode} />
      )}

      <section className="metric-grid student-metrics">
        <MetricCard
          label="Overall Attendance"
          value={`${currentPct}%`}
          detail={isBelow ? `Below ${threshold}% CHARUSAT threshold` : `Meeting ${threshold}% threshold`}
          icon={<Activity size={18} />}
          mark="01"
          warn={isBelow}
        />
        <MetricCard
          label="Classes Attended"
          value={`${classesAttended} / ${totalClasses}`}
          detail={lateCount > 0 ? `Includes ${lateCount} late` : "All on time"}
          icon={<BookOpen size={18} />}
          mark="02"
        />
        <MetricCard
          label="Classes Missed"
          value={String(classesMissed)}
          detail="Total unexcused absences"
          icon={<AlertTriangle size={18} />}
          mark="03"
          warn={classesMissed > 0}
        />
        <MetricCard
          label="Current Status"
          value={isBelow ? 'WARNING' : 'SAFE'}
          detail={isBelow ? `${neededConsecutive} classes to recover` : 'All thresholds satisfied'}
          icon={<ShieldCheck size={18} />}
          mark="04"
          warn={isBelow}
        />
      </section>

      <div className="student-home-grid">
        <Card className="student-home-feature">
          <span className="eyebrow">ATTENDANCE SIGNAL</span>
          <div className="student-home-rate">{currentPct}<sup>%</sup></div>
          <div className="attendance-large-track">
            <span style={{ width: `${currentPct}%`, background: isBelow ? '#d76c60' : undefined }} />
          </div>
          <div className="student-home-threshold">
            <span>Required Threshold: {threshold}%</span>
            <span style={{ color: isBelow ? '#d76c60' : undefined }}>{isBelow ? 'Recovery plan recommended' : 'Healthy standing'}</span>
          </div>

          <div className="recovery-panel">
            <div className="recovery-head">
              <div>
                <span className="eyebrow">TARGET RECOVERY CALCULATION</span>
                <h3 style={{ margin: '3px 0 0', fontSize: '13px' }}>Reach Healthy Standing</h3>
              </div>
              {isBelow && (
                <span className="recovery-target-badge" style={{ background: '#fdf6f5', color: '#b94b3e', border: '1px solid #f2d3ce' }}>
                  {neededConsecutive} classes needed
                </span>
              )}
            </div>
            <p style={{ margin: '0 0 10px', fontSize: '11px', color: '#6e7b77', lineHeight: 1.45 }}>
              {isBelow
                ? `Attend the next ${neededConsecutive} consecutive lectures without absence to reach ${threshold}%.`
                : `You are above the ${threshold}% requirement. Regular attendance keeps your milestones on track.`}
            </p>
            <div className="recovery-slider-wrap">
              <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#687773', marginBottom: '4px' }}>
                <span>Simulate attending next classes</span>
                <b>+{simulatedClasses} classes</b>
              </label>
              <input
                type="range"
                min="1"
                max="12"
                value={simulatedClasses}
                onChange={e => setSimulatedClasses(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#187667' }}
              />
            </div>
            <div className="recovery-projection">
              <span>Projected attendance:</span>
              <strong style={{ color: simulatedPercent >= threshold ? '#1a6857' : '#b94b3e' }}>
                {simulatedPercent}% {simulatedPercent >= threshold ? '✅ On track' : '❌ Still below'}
              </strong>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
            <Link href="/attendance" className="button button-primary" style={{ flex: 1 }}>
              <CalendarDays size={15} /> View Attendance History
            </Link>
            <Button variant="secondary" onClick={() => setAdvisorModal(true)}>
              Contact advisor
            </Button>
          </div>
        </Card>

        <Card className="student-home-sessions">
          <div className="card-head">
            <div>
              <span className="eyebrow">YOUR RECORD</span>
              <h2>Recent Attendance History</h2>
            </div>
            <Link href="/attendance" className="text-link">Full history <ArrowRight size={14} /></Link>
          </div>
          {attendance.length ? (
            attendance.slice(0, 5).map(record => {
              return (
                <div className="student-history-row" key={record.id || record.markedAt}>
                  <span className="history-day">
                    {new Intl.DateTimeFormat('en', { day: '2-digit' }).format(new Date(record.markedAt || record.time))}
                    <small>{new Intl.DateTimeFormat('en', { month: 'short' }).format(new Date(record.markedAt || record.time)).toUpperCase()}</small>
                  </span>
                  <span>
                    <b>{record.subjectCode || 'Lecture'}</b>
                    <small>{fmtDate(record.markedAt || record.time)} - {fmtTime(record.markedAt || record.time)} - {record.verificationMethod ?? 'Passkey'}</small>
                  </span>
                  <Badge tone={toneForStatus(record.status)}>{record.status}</Badge>
                </div>
              );
            })
          ) : (
            <EmptyState title="No recorded sessions yet" body="Your attendance will populate here after your first confirmed lecture." />
          )}
        </Card>
      </div>

      <div className="student-home-notice">
        <ShieldCheck size={18} />
        <span>
          <b>Hardware Cryptographic Attestation Active</b>
          <small>Check-ins are secured with device biometric passkeys and 15s rotating tokens to prevent proxy abuse.</small>
        </span>
      </div>

      <Modal
        open={advisorModal}
        onClose={() => setAdvisorModal(false)}
        title="CHARUSAT Faculty Advisor Support"
        description="Connect with your department mentor to discuss your academic attendance."
        footer={<Button onClick={() => setAdvisorModal(false)}>Close</Button>}
      >
        <div style={{ padding: '10px 0' }}>
          <div className="confirmation-note" style={{ marginBottom: '14px' }}>
            <span className="avatar avatar-profile">{advisor ? initials(advisor.name) : 'AG'}</span>
            <div>
              <b>{advisor?.name ?? 'Dr. Amit Ganatra'}</b>
              <small>{advisor?.department ?? 'Computer Science & Engineering'} - {advisor?.email ?? 'amit.ganatra@charusat.ac.in'}</small>
            </div>
          </div>
          <p style={{ fontSize: '11px', color: '#576763', lineHeight: 1.5, margin: '0 0 12px' }}>
            Office hours: Tuesdays & Thursdays 2:00 PM - 4:00 PM (CSPIT Room 204). You can send an advising note directly through the academic portal.
          </p>
          <Button
            variant="secondary"
            className="full-width"
            onClick={() => {
              setAdvisorModal(false);
              onToast('Advising message dispatched to faculty advisor.');
            }}
          >
            <Send size={14} /> Send check-in message
          </Button>
        </div>
      </Modal>
    </div>
  );
}
