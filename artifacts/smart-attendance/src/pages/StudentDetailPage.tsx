import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import {
  ChevronLeft, Settings, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import type { Store } from '../data';
import { dataService } from '../data';
import { Badge, Button, Card, EmptyState, Field, Modal, PageHeader, RiskScoreBadge } from '../components';
import {
  classLabel, getTeacher, getClass, initials, fmtDate, fmtTime, toneForStatus,
} from '../utils';

interface StudentDetailPageProps {
  store: Store;
  toast: (message: string) => void;
}

export function StudentDetailPage({ store, toast }: StudentDetailPageProps) {
  const [currentPath] = useLocation();
  const id = currentPath.split('/').pop();
  const student = store.students.find(s => s.id === id);
  const [attendance, setAttendance] = useState(student?.attendancePercent ?? 0);
  const [editModal, setEditModal] = useState(false);
  const [form, setForm] = useState({
    name: student?.name ?? '',
    email: student?.email ?? '',
    studentId: student?.studentId ?? '',
    classId: student?.classId ?? '',
  });

  if (!student) {
    return (
      <div className="page-stack">
        <PageHeader eyebrow="CHARUSAT STUDENT RECORD" title="Student not found" description="This record may have been removed or transferred." />
        <Link href="/students" className="button button-secondary">Back to student directory</Link>
      </div>
    );
  }

  const studentRecords = store.sessions.flatMap(s =>
    s.attendanceRecords.filter(r => r.studentId === student.id).map(r => ({ r, s }))
  );

  return (
    <div className="page-stack">
      <div className="detail-back">
        <Link href="/students" className="back-link"><ChevronLeft size={15} /> Student directory</Link>
      </div>

      <PageHeader
        eyebrow="STUDENT PROFILE & ATTENDANCE AUDIT"
        title={student.name}
        description={`${student.studentId} · ${student.email}`}
        actions={
          <Button
            variant="secondary"
            onClick={() => {
              setForm({ name: student.name, email: student.email, studentId: student.studentId, classId: student.classId });
              setEditModal(true);
            }}
          >
            <Settings size={15} /> Edit student
          </Button>
        }
      />

      <div className="student-profile-grid">
        <Card className="student-profile-card">
          <div className="profile-hero">
            <span className="avatar avatar-profile">{initials(student.name)}</span>
            <div>
              <Badge tone={student.attendancePercent < store.settings.attendanceThreshold ? 'amber' : 'green'}>
                {student.attendancePercent < store.settings.attendanceThreshold ? 'Needs support' : 'Active student'}
              </Badge>
              <h2>{student.name}</h2>
              <p>{classLabel(store, student.classId)} · {getClass(store, student.classId)?.semester}</p>
            </div>
          </div>
          <div className="profile-details">
            <div><small>CHARUSAT ID</small><b>{student.studentId}</b></div>
            <div><small>INSTITUTIONAL EMAIL</small><b>{student.email}</b></div>
            <div><small>FACULTY MENTOR</small><b>{getTeacher(store, getClass(store, student.classId)?.teacherId ?? '')?.name}</b></div>
            <div><small>ENROLLMENT STATUS</small><b>{student.status}</b></div>
          </div>
        </Card>

        <Card className="student-attendance-card">
          <span className="eyebrow">ATTENDANCE LEVEL</span>
          <div className="student-percent">{student.attendancePercent}<sup>%</sup></div>
          <p>Verified classroom sessions attended</p>
          <div className="attendance-large-track">
            <span style={{ width: `${student.attendancePercent}%` }} />
          </div>
          <div className="threshold-labels">
            <span>0%</span>
            <span className="threshold-marker" style={{ left: `${store.settings.attendanceThreshold}%` }} />
            <span>Min Threshold {store.settings.attendanceThreshold}%</span>
            <span>100%</span>
          </div>

          {student.attendancePercent < store.settings.attendanceThreshold && (
            <div className="support-callout">
              <AlertTriangle size={15} />
              <span>Below {store.settings.attendanceThreshold}% CHARUSAT requirement. Early mentor intervention advised.</span>
            </div>
          )}

          <label className="range-field" style={{ marginTop: 14 }}>
            <span>Live attendance rate adjustment: <b>{attendance}%</b></span>
            <input
              type="range"
              min="0"
              max="100"
              value={attendance}
              onChange={e => setAttendance(Number(e.target.value))}
              data-testid="input-attendance-adjustment"
              style={{ width: '100%', accentColor: '#187667' }}
            />
          </label>
          <Button
            variant="secondary"
            className="full-width"
            onClick={() => {
              dataService.updateAttendanceThreshold(student.id, attendance);
              toast('Student attendance percentage updated across workspace.');
            }}
          >
            Commit attendance update
          </Button>
        </Card>
      </div>

      <Card className="table-card">
        <div className="card-head padded-head">
          <div>
            <span className="eyebrow">ATTENDANCE AUDIT</span>
            <h2>Past Session History</h2>
          </div>
          <Badge tone="muted">{studentRecords.length} records</Badge>
        </div>
        {studentRecords.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Class session</th>
                  <th>Date & time</th>
                  <th>Status</th>
                  <th>Verification method</th>
                  <th>Risk score</th>
                </tr>
              </thead>
              <tbody>
                {studentRecords.map(({ r, s }) => (
                  <tr key={r.id}>
                    <td><b>{classLabel(store, s.classId)}</b></td>
                    <td>{fmtDate(s.start)} · {fmtTime(s.start)}</td>
                    <td><Badge tone={toneForStatus(r.status)}>{r.status}</Badge></td>
                    <td>
                      <span className={`verify-mark ${r.verified ? 'verified' : 'unverified'}`}>
                        {r.verified ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                        {r.verificationMethod ?? (r.verified ? 'Passkey (WebAuthn)' : 'Manual override')}
                      </span>
                    </td>
                    <td><RiskScoreBadge score={r.riskScore ?? 4} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No recorded sessions" body="Attendance records will populate once sessions take place." />
        )}
      </Card>

      <Modal
        open={editModal}
        onClose={() => setEditModal(false)}
        title="Edit Student Information"
        description="Update profile details for this CHARUSAT student."
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditModal(false)}>Cancel</Button>
            <Button
              onClick={() => {
                dataService.upsert('students', {
                  ...student,
                  name: form.name,
                  email: form.email,
                  studentId: form.studentId,
                  classId: form.classId,
                });
                setEditModal(false);
                toast('Student profile updated.');
              }}
            >
              Save changes
            </Button>
          </>
        }
      >
        <div className="form-stack">
          <Field label="Full name" value={form.name} onChange={v => setForm({ ...form, name: v })} required />
          <Field label="Email address" type="email" value={form.email} onChange={v => setForm({ ...form, email: v })} required />
          <Field label="CHARUSAT Student ID" value={form.studentId} onChange={v => setForm({ ...form, studentId: v })} required />
          <label className="form-field">
            <span>Class cohort</span>
            <select value={form.classId} onChange={e => setForm({ ...form, classId: e.target.value })}>
              {store.classes.map(c => <option key={c.id} value={c.id}>{c.name} · {c.section}</option>)}
            </select>
          </label>
        </div>
      </Modal>
    </div>
  );
}
