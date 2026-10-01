import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'wouter';
import {
  ChevronLeft, Radio, Play, Pause, SquareArrowOutUpRight, Clock3, ArrowRight,
  ShieldAlert, CheckCircle2, Circle, Plus,
} from 'lucide-react';
import type { Store, Student, AttendanceStatus, SecurityEvent } from '../data';
import { dataService } from '../data';
import { Badge, Button, Card, EmptyState, Modal, PageHeader, DynamicQrCode, RiskScoreBadge } from '../components';
import { SecurityReviewModal } from '../components/SecurityReviewModal';
import {
  classLabel, getTeacher, getClass, initials, fmtTime, toneForStatus,
} from '../utils';
import * as api from '../api';

interface LiveSessionPageProps {
  store: Store;
  toast: (message: string) => void;
}

export function LiveSessionPage({ store, toast }: LiveSessionPageProps) {
  const [now, setNow] = useState(Date.now());
  const [manual, setManual] = useState<Student | null>(null);
  const [manualStatus, setManualStatus] = useState<AttendanceStatus>('Present');
  const [endConfirm, setEndConfirm] = useState(false);
  const [selectedSecurityEvent, setSelectedSecurityEvent] = useState<SecurityEvent | null>(null);

  const live = store.sessions.find(s => s.status === 'Live' || s.status === 'Paused');
  const [paused, setPaused] = useState(live?.status === 'Paused');

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (!live) {
    return (
      <div className="page-stack">
        <PageHeader eyebrow="LIVE SESSION" title="No lecture in progress" description="Start a session from the Classroom Operations page." />
        <Card className="no-live-card">
          <EmptyState
            title="Ready when class starts"
            body="Start a session to project the rotating 15s dynamic QR code and monitor student biometric verifications."
            action={
              <Link href="/sessions" className="button button-primary">
                <Plus size={16} /> Choose cohort & start session
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  const room = getClass(store, live.classId);
  const students = store.students.filter(s => s.classId === live.classId);
  const presentIds = new Set(live.attendanceRecords.filter(r => ['Present', 'Late', 'Excused'].includes(r.status)).map(r => r.studentId));

  // 15-second rotation logic
  const ROTATION_SECONDS = 15;
  const epoch = Math.floor(now / (ROTATION_SECONDS * 1000));
  const secondsRemaining = ROTATION_SECONDS - Math.floor((now / 1000) % ROTATION_SECONDS);

  const dynamicCode = useMemo(() => {
    const base = Number(live.code.replace(/\s/g, '')) || 482917;
    const shifted = ((base + epoch * 173) % 900000) + 100000;
    return String(shifted).replace(/(\d{3})(\d{3})/, '$1 $2');
  }, [live.code, epoch]);

  const [serverCode, setServerCode] = useState<string | null>(null);
  const [serverQrToken, setServerQrToken] = useState<string | null>(null);

  // Fetch real rotating security code & QR from backend every 15s epoch
  useEffect(() => {
    if (!live?.id) return;
    let active = true;

    api.apiGetSessionSecurityCode(live.id).then(res => {
      if (active && res.success && res.data?.code) {
        setServerCode(res.data.code);
      }
    }).catch(() => {});

    api.apiGetSessionQR(live.id).then(res => {
      if (active && res.success && res.data?.token) {
        setServerQrToken(res.data.token);
      }
    }).catch(() => {});

    return () => { active = false; };
  }, [live?.id, epoch]);

  // Subscribe to real live SSE stream for real-time attendance telemetry
  useEffect(() => {
    if (!live?.id) return;
    const unsub = api.subscribeLiveSession(live.id, (type, data) => {
      if (type === 'attendance_update' && data?.studentId) {
        dataService.confirmStudentPresence(live.id, data.studentId, data.method || 'Passkey (WebAuthn)');
      } else if (type === 'recheck_update' && data?.studentId) {
        dataService.submitSpotCheck(live.id, data.studentId);
      }
    });
    return unsub;
  }, [live?.id]);

  const displayCode = serverCode || dynamicCode;
  const displayQrToken = serverQrToken || dynamicCode;

  const recordFor = (id: string) => live.attendanceRecords.find(r => r.studentId === id);

  // Security events relevant to this cohort or active session
  const relevantSecurity = store.securityEvents.filter(e => e.status === 'Needs review');

  // Spot-check progress
  const spotCheckActive = !!live.activeSpotCheck;
  const spotCheckCompleted = live.activeSpotCheck?.completedStudentIds.length ?? 0;

  return (
    <div className="live-page">
      <div className="live-topline">
        <Link href="/sessions" className="back-link">
          <ChevronLeft size={16} /> All sessions
        </Link>
        <div className={`live-status-pill ${paused ? 'paused' : ''}`}>
          <i />
          {paused ? 'SESSION PAUSED' : 'LIVE ATTENDANCE WINDOW'}
        </div>
        <span className="live-started">Started {fmtTime(live.start)}</span>
      </div>

      <div className="live-heading">
        <div>
          <span className="eyebrow">{room?.room} · {room?.semester}</span>
          <h1>{room?.name} <span>· {room?.section}</span></h1>
          <p>{getTeacher(store, live.teacherId)?.name} <span>·</span> {students.length} enrolled students</p>
        </div>
        <div className="live-actions">
          <Button
            variant="secondary"
            onClick={() => {
              if (spotCheckActive) {
                toast('Spot check is already running.');
              } else {
                dataService.triggerSpotCheck(live.id);
                toast('60-second random mid-class spot check triggered!');
              }
            }}
            testId="button-trigger-spot-check"
          >
            <Radio size={15} /> Trigger spot check
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              dataService.finishSession(live.id, paused ? 'Live' : 'Paused');
              setPaused(!paused);
              toast(paused ? 'Session resumed.' : 'Session paused.');
            }}
            testId="button-pause-session"
          >
            {paused ? <Play size={15} /> : <Pause size={15} />} {paused ? 'Resume' : 'Pause'}
          </Button>
          <Button variant="danger" onClick={() => setEndConfirm(true)} testId="button-end-session">
            End session <SquareArrowOutUpRight size={15} />
          </Button>
        </div>
      </div>

      {/* Spot Check Banner */}
      {spotCheckActive && (
        <Card className="spot-check-banner">
          <div className="spot-check-info">
            <Radio size={20} className="pulse-dot" />
            <div>
              <h4>Random Mid-Lecture Spot Check Active</h4>
              <p>Randomly selected students have 60 seconds to re-confirm physical presence. <b>{spotCheckCompleted} confirmed</b> so far.</p>
            </div>
          </div>
          <Button
            variant="quiet"
            onClick={() => {
              const unconfirmed = students.filter(s => !live.activeSpotCheck?.completedStudentIds.includes(s.id));
              if (unconfirmed[0]) {
                dataService.submitSpotCheck(live.id, unconfirmed[0].id);
                toast(`Spot check verified for ${unconfirmed[0].name}`);
              }
            }}
          >
            Simulate student check-in
          </Button>
        </Card>
      )}

      {/* Flagged Security Events alert */}
      {relevantSecurity.length > 0 && (
        <Card style={{ padding: '12px 18px', background: '#fdf7f6', border: '1px solid #f6d1cc', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ShieldAlert size={18} color="#ba554b" />
            <span style={{ fontSize: 12, color: '#682e28' }}>
              <b>{relevantSecurity.length} security flags</b> require faculty review (Hardware mismatch or expired replay attempts).
            </span>
          </div>
          <Button variant="quiet" onClick={() => setSelectedSecurityEvent(relevantSecurity[0])}>
            Review flag <ArrowRight size={13} />
          </Button>
        </Card>
      )}

      <section className="live-overview-grid">
        {/* Dynamic Rotating QR & Live Code Card */}
        <Card className="live-code-card" style={{ gridColumn: 'span 2' }}>
          <div className="live-card-label">
            <span className="code-bullet" />
            ROTATING CLASSROOM QR CODE & 6-DIGIT SECURITY CODE
            <span className="rotation-pill">
              <span className="pulse-dot" /> 15s Rotation
            </span>
          </div>

          <div className="live-qr-hero">
            <DynamicQrCode code={displayQrToken} size={175} logoText="CU" />

            <div className="live-qr-details">
              <div>
                <small style={{ fontSize: '10px', color: '#7a8682', fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                  Live 6-Digit Rotating Code
                </small>
                <div className="session-code" style={{ marginTop: '4px' }}>
                  {displayCode.split('').map((char, i) => (
                    <span key={`${i}-${char}`} className={char === ' ' ? 'code-space' : ''}>
                      {char}
                    </span>
                  ))}
                </div>
              </div>

              <div className="countdown-ring-wrap">
                <Clock3 size={15} />
                <span>Rotates in <b>{secondsRemaining}s</b></span>
                <span style={{ color: '#889591', fontSize: '10px' }}>· Replay Protected</span>
              </div>

              <div className="code-progress" style={{ width: '100%', height: '5px' }}>
                <span style={{ transform: `scaleX(${secondsRemaining / ROTATION_SECONDS})`, transformOrigin: 'left', transition: 'transform 1s linear' }} />
              </div>

              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', fontSize: '11px' }}>
                <Link href="/verify" className="code-preview-link">
                  Open student check-in simulator <ArrowRight size={13} />
                </Link>
              </div>
            </div>
          </div>
        </Card>

        {/* Live Attendance Counter */}
        <Card className="live-count-card">
          <div className="live-card-label">CHECK-IN PROGRESS</div>
          <div className="live-count-main">
            <strong>{presentIds.size}</strong>
            <span>/ {students.length}</span>
          </div>
          <div className="live-progress">
            <span style={{ width: `${students.length ? (presentIds.size / students.length) * 100 : 0}%` }} />
          </div>
          <div className="live-count-foot">
            <span>Students verified</span>
            <b>{students.length ? Math.round((presentIds.size / students.length) * 100) : 0}% of roster</b>
          </div>
          <div className="live-small-stats">
            <span><i className="stat-present" /> {live.attendanceRecords.filter(r => r.status === 'Present').length} present</span>
            <span><i className="stat-late" /> {live.attendanceRecords.filter(r => r.status === 'Late').length} late</span>
            <span><i className="stat-absent" /> {Math.max(0, students.length - presentIds.size)} awaiting</span>
          </div>
        </Card>
      </section>

      {/* Live Roster Table */}
      <div className="section-heading live-list-heading">
        <div>
          <span className="eyebrow">REAL-TIME ROSTER</span>
          <h2>Student Attendance Status</h2>
        </div>
        <span className="roster-total">{presentIds.size} of {students.length} confirmed</span>
      </div>

      <Card className="table-card live-roster-card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>CHARUSAT ID</th>
                <th>Check-In Time</th>
                <th>Status</th>
                <th>Verification Method</th>
                <th>Risk Score</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {students.map(student => {
                const record = recordFor(student.id);
                return (
                  <tr key={student.id} data-testid={`row-live-student-${student.id}`}>
                    <td>
                      <div className="identity-cell">
                        <span className="avatar avatar-table">{initials(student.name)}</span>
                        <b>{student.name}</b>
                      </div>
                    </td>
                    <td className="mono-cell">{student.studentId}</td>
                    <td>{record ? fmtTime(record.time) : <span className="quiet-cell">Awaiting check-in</span>}</td>
                    <td><Badge tone={record ? toneForStatus(record.status) : 'muted'}>{record?.status ?? 'Awaiting'}</Badge></td>
                    <td>
                      <span className={`verify-mark ${record?.verified ? 'verified' : 'unverified'}`}>
                        {record?.verified ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                        {record?.verificationMethod ?? (record?.verified ? 'Passkey (WebAuthn)' : record ? 'Manual' : '—')}
                      </span>
                    </td>
                    <td>
                      {record ? (
                        <RiskScoreBadge score={record.riskScore ?? 4} />
                      ) : (
                        <span style={{ color: '#9da7a4', fontSize: '10px' }}>—</span>
                      )}
                    </td>
                    <td>
                      <button
                        className="manual-link"
                        onClick={() => {
                          setManual(student);
                          setManualStatus(record?.status ?? 'Present');
                        }}
                        data-testid={`button-manual-mark-${student.id}`}
                      >
                        {record ? 'Edit' : '+ Mark present'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="table-footer">
          <span>Roster updates automatically as students scan QR or verify with passkey</span>
          <span><span className="live-pulse mini"><i />Live telemetry</span></span>
        </div>
      </Card>

      {/* Manual Mark Modal */}
      <Modal
        open={!!manual}
        onClose={() => setManual(null)}
        title={manual ? `Mark Attendance: ${manual.name}` : 'Manual Attendance Override'}
        description="Manual roll-call corrections are recorded with faculty signature in the CHARUSAT audit trail."
        footer={
          <>
            <Button variant="secondary" onClick={() => setManual(null)}>Cancel</Button>
            <Button
              onClick={() => {
                if (manual) {
                  dataService.mark(live.id, manual.id, manualStatus);
                  setManual(null);
                  toast(`Marked ${manual.name} as ${manualStatus}`);
                }
              }}
              testId="button-confirm-manual-mark"
            >
              Save record
            </Button>
          </>
        }
      >
        {manual && (
          <div className="form-stack">
            <div className="confirmation-note">
              <span className="avatar">{initials(manual.name)}</span>
              <div>
                <b>{manual.name}</b>
                <small>{manual.studentId} · {classLabel(store, manual.classId)}</small>
              </div>
            </div>
            <label className="form-field">
              <span>Attendance status</span>
              <select
                value={manualStatus}
                onChange={e => setManualStatus(e.target.value as AttendanceStatus)}
              >
                {['Present', 'Late', 'Absent', 'Excused'].map(x => <option key={x} value={x}>{x}</option>)}
              </select>
            </label>
          </div>
        )}
      </Modal>

      {/* End Session Modal */}
      <Modal
        open={endConfirm}
        onClose={() => setEndConfirm(false)}
        title="Conclude Attendance Window?"
        description="The live QR code will expire immediately. Final attendance records will be committed to the CHARUSAT academic archive."
        footer={
          <>
            <Button variant="secondary" onClick={() => setEndConfirm(false)}>Keep session open</Button>
            <Button
              variant="danger"
              onClick={() => {
                dataService.finishSession(live.id, 'Completed');
                setEndConfirm(false);
                toast('Lecture session completed and archived.');
              }}
              testId="button-confirm-end-session"
            >
              Conclude session
            </Button>
          </>
        }
      >
        <div className="confirmation-note">
          <span className="confirmation-symbol danger-symbol"><SquareArrowOutUpRight size={17} /></span>
          <div>
            <b>Session Summary</b>
            <small>
              {presentIds.size} of {students.length} students confirmed present ({students.length ? Math.round((presentIds.size / students.length) * 100) : 0}%).
              Unchecked students will be recorded as absent.
            </small>
          </div>
        </div>
      </Modal>

      {/* Security Event Review Modal */}
      {selectedSecurityEvent && (
        <SecurityReviewModal
          event={selectedSecurityEvent}
          store={store}
          onClose={() => setSelectedSecurityEvent(null)}
          onToast={toast}
        />
      )}
    </div>
  );
}
