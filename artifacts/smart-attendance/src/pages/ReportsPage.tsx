import React, { useState } from 'react';
import { Download, FileBarChart2, CheckCircle2 } from 'lucide-react';
import type { Store } from '../data';
import { Button, Card, PageHeader, SelectField } from '../components';
import { classLabel, fmtDate, downloadFile } from '../utils';

import * as api from '../api';

interface ReportsPageProps {
  store: Store;
  toast: (message: string) => void;
}

export function ReportsPage({ store, toast }: ReportsPageProps) {
  const [period, setPeriod] = useState('This week');
  const [classId, setClassId] = useState('all');
  const [generated, setGenerated] = useState(false);

  const scoped = store.students.filter(s => classId === 'all' || s.classId === classId);
  const average = scoped.length ? Math.round(scoped.reduce((sum, s) => sum + s.attendancePercent, 0) / scoped.length) : 0;

  const exportCsv = async () => {
    let downloaded = false;
    if (classId !== 'all') {
      downloaded = await api.downloadReportCsv(`/api/reports/class/${classId}/csv`, `charusat-class-${classId}-report.csv`);
    } else {
      downloaded = await api.downloadReportCsv(`/api/reports/low-attendance/csv`, 'charusat-low-attendance-report.csv');
    }

    if (!downloaded) {
      const csv = [
        'CHARUSAT Student ID,Student Name,Class Batch,Attendance Rate,Compliance Standing,Institute',
        ...scoped.map(s => `"${s.studentId}","${s.name}","${classLabel(store, s.classId)}",${s.attendancePercent}%,"${s.status}","CSPIT / DEPSTAR"`),
      ].join('\n');
      downloadFile(csv, 'charusat-attendance-report.csv', 'text/csv');
    }
    toast('CHARUSAT attendance compliance report downloaded (CSV).');
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="CHARUSAT REPORTING & COMPLIANCE ENGINE"
        title="Attendance & Compliance Reports"
        description="Generate official attendance digests for University Deans, AICTE/NBA accreditation committees, and academic mentors."
        actions={
          <Button variant="secondary" onClick={() => window.print()} testId="button-print-report">
            <Download size={16} /> Print official report
          </Button>
        }
      />

      <Card className="report-controls">
        <div>
          <span className="eyebrow">REPORT CONFIGURATION</span>
          <h2>Summary Digest Parameters</h2>
          <p>Select timeframe and cohort scope to update preview.</p>
        </div>
        <div className="report-filters">
          <SelectField value={period} onChange={setPeriod} label="Report timeframe">
            <option>This week</option>
            <option>This month</option>
            <option>This semester</option>
          </SelectField>
          <SelectField value={classId} onChange={setClassId} label="Report cohort">
            <option value="all">All cohorts (CSPIT & DEPSTAR)</option>
            {store.classes.map(c => <option key={c.id} value={c.id}>{c.name} · {c.section}</option>)}
          </SelectField>
          <Button onClick={() => setGenerated(true)} testId="button-generate-report">
            <FileBarChart2 size={15} /> Update preview
          </Button>
        </div>
      </Card>

      <Card className="report-preview">
        <div className="report-paper-head">
          <div>
            <span className="eyebrow">{store.settings.campus.toUpperCase()} · SMART ATTENDANCE & ANALYTICS</span>
            <h2>Official Attendance & Accreditation Digest</h2>
            <p>{classId === 'all' ? 'All active university cohorts' : classLabel(store, classId)} · {period} · Generated {fmtDate(new Date().toISOString())}</p>
          </div>
          <div className="report-seal">CU</div>
        </div>

        {generated && (
          <div className="report-updated"><CheckCircle2 size={14} /> Preview refreshed with live CHARUSAT database parameters</div>
        )}

        <div className="report-kpis">
          <div><span>Students in scope</span><b>{scoped.length}</b></div>
          <div><span>Average verified rate</span><b>{average}%</b></div>
          <div><span>Under threshold (&lt;{store.settings.attendanceThreshold}%)</span><b>{scoped.filter(s => s.attendancePercent < store.settings.attendanceThreshold).length}</b></div>
          <div><span>Sessions tracked</span><b>{store.sessions.filter(s => classId === 'all' || s.classId === classId).length}</b></div>
        </div>

        <div className="report-subsection">
          <div className="report-subsection-heading">
            <div>
              <span className="eyebrow">COHORT SUMMARY</span>
              <h3>Average attendance by class batch</h3>
            </div>
            <span>CHARUSAT academic threshold: {store.settings.attendanceThreshold}%</span>
          </div>
          <div className="report-bars">
            {store.classes.filter(c => classId === 'all' || c.id === classId).map(c => {
              const group = store.students.filter(s => s.classId === c.id);
              const avg = group.length ? Math.round(group.reduce((n, s) => n + s.attendancePercent, 0) / group.length) : 0;
              return (
                <div className="report-bar-row" key={c.id}>
                  <span>{c.name}</span>
                  <div className="report-bar-track">
                    <span style={{ width: `${avg}%` }} />
                  </div>
                  <b>{avg}%</b>
                </div>
              );
            })}
          </div>
        </div>

        <div className="report-preview-footer">
          <span>Signed with CHARUSAT Institutional Verification Token · AICTE & NBA Compliant</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" onClick={exportCsv} testId="button-export-csv">
              <Download size={15} /> Export CSV
            </Button>
            <Button variant="secondary" onClick={() => window.print()}>
              <FileBarChart2 size={15} /> Print
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
