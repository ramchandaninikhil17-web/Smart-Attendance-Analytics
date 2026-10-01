import React, { useState } from 'react';
import { Link } from 'wouter';
import {
  Play, Plus, CheckCircle2, ShieldCheck, Radio, Clock3, ArrowRight,
} from 'lucide-react';
import type { Store } from '../data';
import { dataService } from '../data';
import { Badge, Button, Card, Modal, PageHeader } from '../components';
import {
  classLabel, getTeacher, getClass, presentCount, since, fmtDate, fmtTime, toneForStatus,
} from '../utils';

interface SessionsPageProps {
  store: Store;
  toast: (message: string) => void;
}

export function SessionsPage({ store, toast }: SessionsPageProps) {
  const [classId, setClassId] = useState(store.classes[0]?.id ?? '');
  const [confirm, setConfirm] = useState(false);
  const live = store.sessions.find(s => s.status === 'Live');

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="CLASSROOM TIMETABLE & LECTURE OPS"
        title="Lecture Sessions"
        description="Initiate rotating 15s dynamic QR verification windows across CSPIT and DEPSTAR or review past lecture attendance."
        actions={
          <Link href="/session/live" className="button button-primary" data-testid="link-live-session">
            <Play size={15} /> {live ? 'Open active live session' : 'Live lecture window'}
          </Link>
        }
      />

      <Card className="start-session-panel">
        <div className="start-copy">
          <span className="eyebrow">READY FOR LECTURE / LAB</span>
          <h2>Launch In-Room Attendance Window</h2>
          <p>
            Displays a high-security attendance window on the classroom projector with synchronized 15-second rotating QR, rolling 6-digit passcode, and WebAuthn passkey attestation.
          </p>
          <div className="start-meta">
            <span><CheckCircle2 size={14} /> 15s Dynamic rotating QR code</span>
            <span><ShieldCheck size={14} /> FIDO2 hardware passkeys</span>
            <span><Radio size={14} /> Mid-class random spot-checks</span>
          </div>
        </div>
        <div className="start-form">
          <label className="form-field">
            <span>Select CHARUSAT cohort & classroom</span>
            <select
              value={classId}
              onChange={e => setClassId(e.target.value)}
              data-testid="select-session-class"
            >
              {store.classes.map(c => (
                <option key={c.id} value={c.id}>{c.name} · Section {c.section} ({c.room})</option>
              ))}
            </select>
          </label>
          <Button onClick={() => setConfirm(true)} className="full-width" testId="button-start-session">
            <Plus size={16} /> Start live attendance window
          </Button>
          <small>Default session duration: {store.settings.sessionLength} minutes</small>
        </div>
      </Card>

      {live && (
        <Card className="current-live-card">
          <span className="live-pulse"><i />LIVE NOW</span>
          <div className="current-live-info">
            <h3>{classLabel(store, live.classId)}</h3>
            <p>{getTeacher(store, live.teacherId)?.name} · Room {getClass(store, live.classId)?.room} · Started {since(live.start)}</p>
          </div>
          <div className="current-live-stat">
            <b>{presentCount(live)}</b>
            <span>present</span>
          </div>
          <Link href="/session/live" className="button button-secondary">
            Manage session <ArrowRight size={15} />
          </Link>
        </Card>
      )}

      <div className="section-heading">
        <div>
          <span className="eyebrow">CHARUSAT ATTENDANCE ARCHIVE</span>
          <h2>Session History</h2>
        </div>
        <div className="history-count">{store.sessions.length} total sessions recorded</div>
      </div>

      <Card className="table-card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Class / Batch</th>
                <th>Instructor</th>
                <th>Date & Time</th>
                <th>Attendance</th>
                <th>Session Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {store.sessions.map(s => (
                <tr key={s.id} data-testid={`row-session-${s.id}`}>
                  <td>
                    <div className="table-title">
                      <b>{getClass(store, s.classId)?.name}</b>
                      <small>{getClass(store, s.classId)?.section} · {getClass(store, s.classId)?.room}</small>
                    </div>
                  </td>
                  <td>{getTeacher(store, s.teacherId)?.name}</td>
                  <td>
                    {fmtDate(s.start)}
                    <small className="table-secondary">{fmtTime(s.start)}{s.end ? ` – ${fmtTime(s.end)}` : ' – now'}</small>
                  </td>
                  <td>
                    <span className="table-count">
                      {presentCount(s)} <span>/ {getClass(store, s.classId)?.studentIds.length ?? 0}</span>
                    </span>
                  </td>
                  <td><Badge tone={toneForStatus(s.status)}>{s.status}</Badge></td>
                  <td>
                    {s.status === 'Live' ? (
                      <Link href="/session/live" className="text-link">Manage live <ArrowRight size={14} /></Link>
                    ) : (
                      <Link href="/analytics" className="text-link">Analytics <ArrowRight size={14} /></Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Start Live Lecture Session?"
        description={`A dynamic 15-second rotating QR code and rolling passcode will open for ${classLabel(store, classId)}.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(false)}>Cancel</Button>
            <Button
              onClick={() => {
                dataService.addSession(classId, store.currentUser.role === 'Teacher' ? 't1' : store.classes.find(c => c.id === classId)?.teacherId ?? 't1');
                setConfirm(false);
                toast('Live session launched with dynamic 15s rotating QR.');
              }}
              testId="button-confirm-start-session"
            >
              <Play size={15} /> Launch session
            </Button>
          </>
        }
      >
        <div className="confirmation-note">
          <span className="confirmation-symbol"><Clock3 size={18} /></span>
          <div>
            <b>Anti-Proxy Protocol Initialized</b>
            <small>Dynamic QR code and 6-digit rolling code rotate every 15 seconds. Students verify presence using FIDO2 passkeys.</small>
          </div>
        </div>
      </Modal>
    </div>
  );
}
