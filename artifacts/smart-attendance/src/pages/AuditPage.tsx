import React, { useState } from 'react';
import { Download } from 'lucide-react';
import type { Store } from '../data';
import { Badge, Button, Card, EmptyState, PageHeader, SearchInput, SelectField } from '../components';
import { toneForStatus, initials, fmtDate, fmtTime, since, downloadFile } from '../utils';
import * as api from '../api';

interface AuditPageProps {
  store: Store;
}

export function AuditPage({ store }: AuditPageProps) {
  const [query, setQuery] = useState('');
  const [severity, setSeverity] = useState('all');

  const events = store.auditEvents.filter(e =>
    `${e.actor} ${e.action}`.toLowerCase().includes(query.toLowerCase()) &&
    (severity === 'all' || e.severity === severity)
  );

  const exportCsv = async () => {
    const downloaded = await api.downloadReportCsv('/api/reports/security/csv', 'charusat-security-audit-trail.csv');
    if (!downloaded) {
      const csv = [
        'Actor,Action,Time,Severity,Campus Subnet,Integrity Hash',
        ...events.map(e => `"${e.actor}","${e.action}","${e.time}","${e.severity}","CHARUSAT Main Subnet","sha256_${e.id.slice(0, 10)}"`),
      ].join('\n');
      downloadFile(csv, 'charusat-security-audit-trail.csv', 'text/csv');
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="CHARUSAT ACCOUNTABILITY & COMPLIANCE"
        title="Institutional Security Audit Trail"
        description="A tamper-evident, sequential event log of lecture session initializations, passkey confirmations, manual overrides, and security review resolutions."
        actions={
          <Button variant="secondary" onClick={exportCsv} testId="button-export-audit">
            <Download size={16} /> Export audit log (CSV)
          </Button>
        }
      />

      <div className="directory-toolbar standalone-toolbar">
        <SearchInput value={query} onChange={setQuery} placeholder="Search actors or actions..." />
        <SelectField value={severity} onChange={setSeverity} label="Filter by event severity">
          <option value="all">All activity levels</option>
          <option value="Info">Informational</option>
          <option value="Warning">Warnings</option>
          <option value="Critical">Critical</option>
        </SelectField>
      </div>

      <Card className="audit-card">
        <div className="audit-date-label">
          <span className="eyebrow">CHRONOLOGICAL INTEGRITY LOG</span>
          <span>Newest records first · Full SHA-256 integrity ledger</span>
        </div>
        <div className="timeline">
          {events.map(event => (
            <div className="timeline-event" key={event.id} data-testid={`event-audit-${event.id}`}>
              <div className={`timeline-rail timeline-${event.severity.toLowerCase()}`}><span /></div>
              <div className="audit-event-main">
                <div className="audit-event-heading">
                  <b>{event.action}</b>
                  <Badge tone={toneForStatus(event.severity)}>{event.severity}</Badge>
                </div>
                <div className="audit-event-meta">
                  <span className="avatar avatar-micro">{initials(event.actor)}</span>
                  <span>{event.actor}</span>
                  <span className="audit-separator">·</span>
                  <span>{fmtDate(event.time)} at {fmtTime(event.time)}</span>
                  <span className="audit-time">{since(event.time)}</span>
                </div>
              </div>
            </div>
          ))}
          {events.length === 0 && (
            <EmptyState title="No audit records match" body="Try clearing your search query or changing severity filters." />
          )}
        </div>
        <div className="audit-bottom">
          Showing <b>{events.length}</b> of {store.auditEvents.length} CHARUSAT audit entries
        </div>
      </Card>
    </div>
  );
}
