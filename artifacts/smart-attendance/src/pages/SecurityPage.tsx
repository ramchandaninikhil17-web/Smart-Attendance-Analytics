import React, { useState } from 'react';
import { Link } from 'wouter';
import { AlertTriangle, ShieldCheck, Fingerprint, CircleHelp } from 'lucide-react';
import type { Store, SecurityEvent } from '../data';
import { Badge, Button, Card, PageHeader, RiskScoreBadge } from '../components';
import { HelpModal } from '../components/HelpModal';
import { SecurityReviewModal } from '../components/SecurityReviewModal';
import { toneForStatus, since } from '../utils';

interface SecurityPageProps {
  store: Store;
  toast: (message: string) => void;
}

export function SecurityPage({ store, toast }: SecurityPageProps) {
  const pending = store.securityEvents.filter(e => e.status === 'Needs review');
  const [selectedEvent, setSelectedEvent] = useState<SecurityEvent | null>(null);
  const [protocolModal, setProtocolModal] = useState(false);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="CHARUSAT TRUST & ANTI-PROXY ENGINE"
        title="Security & Anti-Proxy Telemetry"
        description="Continuous anti-proxy verification combining 15s rotating dynamic QR codes, FIDO2 WebAuthn hardware passkeys, Wi-Fi BSSID locks, and risk telemetry across CSPIT, DEPSTAR, and CMPICA."
        actions={
          <Button variant="secondary" onClick={() => setProtocolModal(true)}>
            <CircleHelp size={15} /> Protocol specifications
          </Button>
        }
      />

      <div className="security-metrics">
        <Card className="security-metric">
          <span className="security-icon amber-icon"><AlertTriangle size={18} /></span>
          <span>
            <small>REVIEW QUEUE</small>
            <b>{pending.length}</b>
            <em>events pending faculty review</em>
          </span>
        </Card>
        <Card className="security-metric">
          <span className="security-icon green-icon"><ShieldCheck size={18} /></span>
          <span>
            <small>PASSOVER VERIFIED</small>
            <b>{store.sessions.reduce((sum, s) => sum + s.attendanceRecords.filter(r => r.verified).length, 0)}</b>
            <em>hardware attested check-ins</em>
          </span>
        </Card>
        <Card className="security-metric">
          <span className="security-icon blue-icon"><Fingerprint size={18} /></span>
          <span>
            <small>CAMPUS RISK INDEX</small>
            <b>12 / 100</b>
            <em>Low security risk rating</em>
          </span>
        </Card>
      </div>

      <Card className="security-explainer">
        <div className="explainer-icon"><ShieldCheck size={20} /></div>
        <div>
          <b>5-Layer CHARUSAT Anti-Proxy Architecture Active</b>
          <p>
            15s Dynamic rotating QR + 6-digit rolling code + FIDO2 WebAuthn hardware passkeys + Lecture hall geofence + Random mid-lecture spot checks.
            Proxy attempts (photo sharing, remote spoofing, token replay, VPN spoofing) are blocked deterministically.
          </p>
        </div>
        <Badge tone="blue">SECURE ENGINE</Badge>
      </Card>

      <div className="section-heading">
        <div>
          <span className="eyebrow">INVESTIGATION QUEUE</span>
          <h2>Security & Anti-Proxy Events</h2>
        </div>
        <span className="history-count">{store.securityEvents.length} total events logged</span>
      </div>

      <Card className="table-card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Event Type</th>
                <th>Student</th>
                <th>Severity</th>
                <th>Risk Score</th>
                <th>Root Cause Reason</th>
                <th>Device & Location Telemetry</th>
                <th>Time</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {store.securityEvents.map(event => {
                const student = store.students.find(s => s.id === event.studentId);
                return (
                  <tr key={event.id} data-testid={`row-security-${event.id}`}>
                    <td>
                      <div className="table-title">
                        <b>{event.event}</b>
                        <small>Anti-proxy signal</small>
                      </div>
                    </td>
                    <td>
                      {student ? (
                        <Link href={`/students/${student.id}`} className="table-person-link">
                          <b>{student.name}</b>
                          <small className="table-secondary">{student.studentId}</small>
                        </Link>
                      ) : (
                        'Unknown'
                      )}
                    </td>
                    <td><Badge tone={toneForStatus(event.severity)}>{event.severity}</Badge></td>
                    <td><RiskScoreBadge score={event.riskScore} /></td>
                    <td className="reason-cell" style={{ maxWidth: 220 }}>{event.reason}</td>
                    <td style={{ fontSize: 10, color: '#687773', maxWidth: 180 }}>
                      <div>{event.deviceFingerprint}</div>
                      <div style={{ color: '#8d9a96' }}>{event.ipLocation}</div>
                    </td>
                    <td>{since(event.time)}</td>
                    <td>
                      <Badge tone={event.status === 'Needs review' ? 'amber' : 'green'}>
                        {event.status}
                      </Badge>
                    </td>
                    <td>
                      {event.status === 'Needs review' ? (
                        <Button
                          variant="quiet"
                          className="review-button"
                          onClick={() => setSelectedEvent(event)}
                          testId={`button-review-security-${event.id}`}
                        >
                          Review event
                        </Button>
                      ) : (
                        <span style={{ fontSize: 11, color: '#328571', fontWeight: 600 }}>Resolved</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {selectedEvent && (
        <SecurityReviewModal
          event={selectedEvent}
          store={store}
          onClose={() => setSelectedEvent(null)}
          onToast={toast}
        />
      )}

      <HelpModal open={protocolModal} onClose={() => setProtocolModal(false)} />
    </div>
  );
}
