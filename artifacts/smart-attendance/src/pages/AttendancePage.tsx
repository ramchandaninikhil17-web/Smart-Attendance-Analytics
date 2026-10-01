import React, { useState } from 'react';
import { Link } from 'wouter';
import {
  Download, MoreHorizontal, CheckCircle2, AlertTriangle, ChevronLeft, ChevronRight,
} from 'lucide-react';
import type { Store, AttendanceStatus } from '../data';
import { dataService } from '../data';
import { Badge, Button, Card, EmptyState, Modal, PageHeader, SearchInput, SelectField, RiskScoreBadge } from '../components';
import {
  classLabel, initials, toneForStatus, fmtDate, fmtTime, downloadFile,
} from '../utils';
import * as api from '../api';

interface AttendancePageProps {
  store: Store;
  toast: (message: string) => void;
}

export function AttendancePage({ store, toast }: AttendancePageProps) {
  const [query, setQuery] = useState('');
  const [classId, setClassId] = useState('all');
  const [status, setStatus] = useState('all');
  const [selected, setSelected] = useState<{ sessionId: string; studentId: string; status: AttendanceStatus } | null>(null);

  const records = store.sessions.flatMap(s =>
    s.attendanceRecords.map(r => ({
      record: r,
      session: s,
      student: store.students.find(st => st.id === r.studentId),
    }))
  ).filter(row =>
    row.student &&
    `${row.student.name} ${row.student.studentId}`.toLowerCase().includes(query.toLowerCase()) &&
    (classId === 'all' || row.session.classId === classId) &&
    (status === 'all' || row.record.status === status)
  );

  const exportCsv = async () => {
    let downloaded = false;
    if (classId !== 'all') {
      downloaded = await api.downloadReportCsv(`/api/reports/class/${classId}/csv`, `charusat-class-${classId}-attendance.csv`);
    } else {
      downloaded = await api.downloadReportCsv(`/api/reports/low-attendance/csv`, 'charusat-attendance-report.csv');
    }

    if (!downloaded) {
      const csv = [
        'Student ID,Student Name,Class,Status,Recorded Time,Verification Method,Risk Score,Campus Subnet',
        ...records.map(r =>
          `"${r.student?.studentId}","${r.student?.name}","${classLabel(store, r.session.classId)}","${r.record.status}","${fmtTime(r.record.time)}","${r.record.verificationMethod ?? 'Manual'}","${r.record.riskScore ?? 0}","CHARUSAT Wi-Fi"`
        ),
      ].join('\n');
      downloadFile(csv, 'charusat-attendance-ledger.csv', 'text/csv');
    }
    toast('CHARUSAT attendance ledger exported as CSV.');
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="CHARUSAT ATTENDANCE LEDGER"
        title="Attendance Records & Ledger"
        description="A complete, auditable ledger of verified presence, manual overrides, and anti-proxy telemetry across CSPIT, DEPSTAR, and CMPICA."
        actions={
          <Button variant="secondary" onClick={exportCsv} testId="button-attendance-export">
            <Download size={16} /> Export records (CSV)
          </Button>
        }
      />

      <div className="subnav-strip">
        <div className="subnav-intro">
          <div className="mini-stat"><b>{store.sessions.length}</b><span>sessions logged</span></div>
          <span className="subnav-divider" />
          <div className="mini-stat"><b>{records.length}</b><span>verified records</span></div>
        </div>
        <div className="filter-bar">
          <SearchInput value={query} onChange={setQuery} placeholder="Find student or CHARUSAT ID..." />
          <SelectField value={classId} onChange={setClassId} label="Filter by class">
            <option value="all">All classes</option>
            {store.classes.map(c => <option key={c.id} value={c.id}>{c.name} · {c.section}</option>)}
          </SelectField>
          <SelectField value={status} onChange={setStatus} label="Filter by status">
            <option value="all">All statuses</option>
            {['Present', 'Late', 'Absent', 'Excused'].map(x => <option key={x} value={x}>{x}</option>)}
          </SelectField>
        </div>
      </div>

      <Card className="table-card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Class / Session</th>
                <th>Attendance</th>
                <th>Recorded Time</th>
                <th>Verification Method</th>
                <th>Risk Score</th>
                <th><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {records.slice(0, 40).map(({ record, session, student }) => (
                <tr key={record.id} data-testid={`row-attendance-${record.id}`}>
                  <td>
                    <Link href={`/students/${student!.id}`} className="identity-cell table-person-link">
                      <span className="avatar avatar-table">{initials(student!.name)}</span>
                      <span>
                        <b>{student!.name}</b>
                        <small>{student!.studentId}</small>
                      </span>
                    </Link>
                  </td>
                  <td>
                    <b>{classLabel(store, session.classId)}</b>
                    <small className="table-secondary">{fmtDate(session.start)} · {fmtTime(session.start)}</small>
                  </td>
                  <td><Badge tone={toneForStatus(record.status)}>{record.status}</Badge></td>
                  <td>{fmtTime(record.time)}</td>
                  <td>
                    <span className={`verify-mark ${record.verified ? 'verified' : 'unverified'}`}>
                      {record.verified ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                      {record.verificationMethod ?? (record.verified ? 'Passkey (WebAuthn)' : 'Manual override')}
                    </span>
                  </td>
                  <td><RiskScoreBadge score={record.riskScore ?? (record.verified ? 4 : 25)} /></td>
                  <td>
                    <button
                      className="icon-button row-action"
                      aria-label={`Correct ${student!.name} record`}
                      onClick={() => setSelected({ sessionId: session.id, studentId: student!.id, status: record.status })}
                      data-testid={`button-correct-${record.id}`}
                    >
                      <MoreHorizontal size={17} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {records.length === 0 && (
            <EmptyState
              title="No attendance records match"
              body="Try widening your search filters or start a lecture session to capture student attendance."
            />
          )}
        </div>
        <div className="table-footer">
          <span>Showing <b>{Math.min(records.length, 40)}</b> of <b>{records.length}</b> records</span>
          <div className="pagination">
            <button className="icon-button" disabled aria-label="Previous page"><ChevronLeft size={16} /></button>
            <span className="page-number is-current">1</span>
            <button className="icon-button" disabled aria-label="Next page"><ChevronRight size={16} /></button>
          </div>
        </div>
      </Card>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Correct Attendance Record"
        description="Manual roll-call corrections are permanently logged in the CHARUSAT audit trail."
        footer={
          <>
            <Button variant="secondary" onClick={() => setSelected(null)}>Cancel</Button>
            <Button
              onClick={() => {
                if (selected) {
                  dataService.mark(selected.sessionId, selected.studentId, selected.status);
                  toast('Attendance record corrected and audit logged.');
                }
                setSelected(null);
              }}
              testId="button-save-correction"
            >
              Save correction
            </Button>
          </>
        }
      >
        {selected && (
          <div className="form-stack">
            <div className="confirmation-note">
              <span className="avatar">
                {initials(store.students.find(s => s.id === selected.studentId)?.name ?? 'ST')}
              </span>
              <div>
                <b>{store.students.find(s => s.id === selected.studentId)?.name}</b>
                <small>{store.students.find(s => s.id === selected.studentId)?.studentId}</small>
              </div>
            </div>
            <label className="form-field">
              <span>Attendance status</span>
              <select
                value={selected.status}
                onChange={e => setSelected({ ...selected, status: e.target.value as AttendanceStatus })}
              >
                {['Present', 'Late', 'Absent', 'Excused'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          </div>
        )}
      </Modal>
    </div>
  );
}
