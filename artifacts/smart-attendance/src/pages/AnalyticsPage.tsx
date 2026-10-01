import React, { useState } from 'react';
import { Link } from 'wouter';
import {
  Activity, AlertTriangle, CalendarDays, ArrowUpRight, Send,
} from 'lucide-react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { Store } from '../data';
import { Badge, Button, Card, PageHeader, SelectField } from '../components';
import { classLabel, initials } from '../utils';
import { MetricCard } from './OverviewPage';

interface AnalyticsPageProps {
  store: Store;
  toast: (message: string) => void;
}

export function AnalyticsPage({ store, toast }: AnalyticsPageProps) {
  const [period, setPeriod] = useState('Last 7 days');
  const [classId, setClassId] = useState('all');

  const scoped = store.students.filter(s => classId === 'all' || s.classId === classId);
  const averageRate = scoped.length ? Math.round(scoped.reduce((n, s) => n + s.attendancePercent, 0) / scoped.length) : 88;

  // Class comparison data
  const classData = store.classes.map(c => {
    const students = store.students.filter(s => s.classId === c.id);
    return {
      name: c.name.split(' ').slice(0, 2).join(' '),
      average: students.length ? Math.round(students.reduce((n, s) => n + s.attendancePercent, 0) / students.length) : 0,
      threshold: store.settings.attendanceThreshold,
    };
  });

  // Subject comparison data
  const subjectData = store.subjects.map(sub => {
    const assignedClasses = store.classes.filter(c => sub.classIds.includes(c.id));
    const enrolledStudents = store.students.filter(s => assignedClasses.some(c => c.id === s.classId));
    const avg = enrolledStudents.length ? Math.round(enrolledStudents.reduce((acc, st) => acc + st.attendancePercent, 0) / enrolledStudents.length) : 84;
    return {
      name: sub.code,
      fullName: sub.name,
      average: avg,
      threshold: sub.threshold,
    };
  });

  const week = [
    { day: 'Mon', rate: 84, prior: 81 },
    { day: 'Tue', rate: 88, prior: 83 },
    { day: 'Wed', rate: 82, prior: 85 },
    { day: 'Thu', rate: 90, prior: 86 },
    { day: 'Fri', rate: 89, prior: 85 },
    { day: 'Sat', rate: 93, prior: 89 },
    { day: 'Today', rate: averageRate, prior: 84 },
  ];

  const distribution = [
    { name: '90–100% (Exemplary)', value: scoped.filter(s => s.attendancePercent >= 90).length, color: '#187667' },
    { name: '75–89% (Good Standing)', value: scoped.filter(s => s.attendancePercent >= 75 && s.attendancePercent < 90).length, color: '#73a99d' },
    { name: '60–74% (At Risk - Below 75%)', value: scoped.filter(s => s.attendancePercent >= 60 && s.attendancePercent < 75).length, color: '#d39c48' },
    { name: 'Below 60% (Critical Support)', value: scoped.filter(s => s.attendancePercent < 60).length, color: '#d76c60' },
  ];

  const lowStudents = scoped.filter(s => s.attendancePercent < store.settings.attendanceThreshold).slice(0, 5);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="CHARUSAT ANALYTICS & COMPLIANCE"
        title="Institutional Attendance Analytics"
        description="Comprehensive analytics on attendance trends, cohort comparisons, course benchmarks, and early warning radar across CSPIT, DEPSTAR, and CMPICA."
        actions={
          <div className="filter-bar">
            <SelectField value={period} onChange={setPeriod} label="Date range">
              <option>Last 7 days</option>
              <option>Last 30 days</option>
              <option>Current Semester</option>
            </SelectField>
            <SelectField value={classId} onChange={setClassId} label="Filter by class">
              <option value="all">All cohorts</option>
              {store.classes.map(c => <option key={c.id} value={c.id}>{c.name} · {c.section}</option>)}
            </SelectField>
          </div>
        }
      />

      <div className="analytics-kpis">
        <MetricCard
          label="Average Verified Presence"
          value={`${averageRate}%`}
          detail={<><ArrowUpRight size={14} /> +4.2% vs prior period</>}
          detailTone="good"
          icon={<Activity size={18} />}
          mark="01"
        />
        <MetricCard
          label="Students at Risk"
          value={String(scoped.filter(s => s.attendancePercent < store.settings.attendanceThreshold).length)}
          detail={`Below ${store.settings.attendanceThreshold}% CHARUSAT threshold`}
          icon={<AlertTriangle size={18} />}
          mark="02"
          warn
        />
        <MetricCard
          label="Sessions Analyzed"
          value={String(store.sessions.filter(s => s.status === 'Completed').length)}
          detail="Verified lecture & lab sessions"
          icon={<CalendarDays size={18} />}
          mark="03"
        />
      </div>

      <div className="analytics-grid">
        {/* Attendance Trend Chart */}
        <Card className="analytics-line-card">
          <div className="card-head">
            <div>
              <span className="eyebrow">ATTENDANCE OVER TIME</span>
              <h2>Daily Verified Presence Trend</h2>
            </div>
            <Badge tone="green">+4.2% period-over-period</Badge>
          </div>
          <div className="chart-area tall-chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={week} margin={{ top: 20, right: 12, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="analyticFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#187667" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#187667" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#e9e5db" strokeDasharray="4 5" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#83908e' }} />
                <YAxis domain={[60, 100]} tickFormatter={v => `${v}%`} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#83908e' }} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, fontSize: 12, backgroundColor: '#fffefa', border: '1px solid #e5e0d7' }}
                  formatter={(v: number, name: string) => [`${v}%`, name === 'rate' ? 'Current Period' : 'Previous Period']}
                />
                <Area dataKey="prior" type="monotone" stroke="#b4c1be" strokeDasharray="5 4" fill="transparent" strokeWidth={1.5} />
                <Area dataKey="rate" type="monotone" stroke="#187667" fill="url(#analyticFill)" strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-foot">
            <span><i className="legend-dot teal" />Current Period Verified Rate</span>
            <span><i className="legend-dot muted" />Prior 7 Days Comparison</span>
          </div>
        </Card>

        {/* Student Distribution Bands */}
        <Card className="analytics-distribution-card">
          <div className="card-head">
            <div>
              <span className="eyebrow">COHORT DISTRIBUTION</span>
              <h2>Attendance Bands</h2>
            </div>
            <span style={{ fontSize: 11, color: '#7a8682' }}>{scoped.length} students</span>
          </div>
          <div className="distribution-horizontal">
            {distribution.map(d => (
              <div key={d.name} className="distribution-row">
                <div className="distribution-row-label">
                  <span><i style={{ background: d.color }} />{d.name}</span>
                  <b>{d.value}</b>
                </div>
                <div className="distribution-track">
                  <span style={{ width: `${scoped.length ? (d.value / scoped.length) * 100 : 0}%`, background: d.color }} />
                </div>
              </div>
            ))}
          </div>
          <div className="analytics-note">
            <span className="summary-dot amber" />
            <b>{distribution[2].value + distribution[3].value} students</b> require advising check-ins under the {store.settings.attendanceThreshold}% CHARUSAT policy.
          </div>
        </Card>

        {/* Class Comparison Chart */}
        <Card className="comparison-card">
          <div className="card-head">
            <div>
              <span className="eyebrow">COHORT COMPARISON</span>
              <h2>Average Attendance by Class Batch</h2>
            </div>
            <span className="table-secondary">Threshold: {store.settings.attendanceThreshold}%</span>
          </div>
          <div className="chart-area comparison-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={classData} layout="vertical" margin={{ top: 10, right: 25, left: 15, bottom: 0 }}>
                <CartesianGrid horizontal={false} stroke="#e9e5db" strokeDasharray="4 5" />
                <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#83908e' }} />
                <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={110} tick={{ fontSize: 11, fill: '#586563' }} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, fontSize: 12, backgroundColor: '#fff', border: '1px solid #e1dcd3' }}
                  formatter={(v: number) => [`${v}%`, 'Average Attendance']}
                />
                <Bar dataKey="average" fill="#187667" radius={[0, 5, 5, 0]} barSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Subject Comparison Chart */}
        <Card className="comparison-card">
          <div className="card-head">
            <div>
              <span className="eyebrow">SUBJECT BENCHMARKS</span>
              <h2>Attendance Across Courses</h2>
            </div>
            <span className="table-secondary">CHARUSAT Syllabus</span>
          </div>
          <div className="chart-area comparison-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={subjectData} margin={{ top: 15, right: 15, left: -15, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#e9e5db" strokeDasharray="4 5" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#586563' }} />
                <YAxis domain={[50, 100]} tickFormatter={v => `${v}%`} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#83908e' }} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, fontSize: 12, backgroundColor: '#fff', border: '1px solid #e1dcd3' }}
                  formatter={(v: number, name: string) => [`${v}%`, name === 'average' ? 'Average Attendance' : 'Course Threshold']}
                />
                <Bar dataKey="average" fill="#2d6f63" radius={[4, 4, 0, 0]} barSize={26} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-foot">
            <span>CE251, CE252, CE257, IT254, CSE301, MA144</span>
            <span>All courses complying with 75% minimum academic guidelines</span>
          </div>
        </Card>
      </div>

      {/* Low-Attendance Students Early Warning Radar */}
      <div className="section-heading" style={{ marginTop: 12 }}>
        <div>
          <span className="eyebrow">EARLY WARNING RADAR</span>
          <h2>Students Below 75% Attendance Threshold</h2>
        </div>
        <span className="history-count">{scoped.filter(s => s.attendancePercent < store.settings.attendanceThreshold).length} students flagged</span>
      </div>

      <Card className="table-card">
        <div className="table-scroll">
          <table className="early-radar-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Cohort</th>
                <th>Current Rate</th>
                <th>Threshold Gap</th>
                <th>Intervention Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {lowStudents.map(st => {
                const gap = store.settings.attendanceThreshold - st.attendancePercent;
                return (
                  <tr key={st.id}>
                    <td>
                      <Link href={`/students/${st.id}`} className="identity-cell table-person-link">
                        <span className="avatar avatar-table">{initials(st.name)}</span>
                        <span><b>{st.name}</b><small>{st.studentId}</small></span>
                      </Link>
                    </td>
                    <td>{classLabel(store, st.classId)}</td>
                    <td>
                      <div className="attendance-cell">
                        <div className="attendance-mini-track">
                          <span className="low" style={{ width: `${st.attendancePercent}%` }} />
                        </div>
                        <b style={{ color: '#ba554b' }}>{st.attendancePercent}%</b>
                      </div>
                    </td>
                    <td><b style={{ color: '#9d722e' }}>-{gap}%</b> below threshold</td>
                    <td><Badge tone="amber">Advising notice queued</Badge></td>
                    <td>
                      <Button
                        variant="quiet"
                        className="radar-action-btn"
                        onClick={() => toast(`Intervention notice sent to ${st.name} and academic advisor.`)}
                      >
                        <Send size={12} /> Send notice
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
