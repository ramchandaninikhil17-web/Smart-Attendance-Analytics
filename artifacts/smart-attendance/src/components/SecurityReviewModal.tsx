import React, { useState } from 'react';
import type { SecurityEvent, Store } from '../data';
import { dataService } from '../data';
import { Modal, Button, Field, RiskScoreBadge } from '../components';
import { initials, classLabel } from '../utils';

interface SecurityReviewModalProps {
  event: SecurityEvent;
  store: Store;
  onClose: () => void;
  onToast: (msg: string) => void;
}

export function SecurityReviewModal({
  event,
  store,
  onClose,
  onToast,
}: SecurityReviewModalProps) {
  const student = store.students.find(s => s.id === event.studentId);
  const [resolution, setResolution] = useState<'Reviewed' | 'Dismissed' | 'Marked as Proxy'>('Reviewed');
  const [notes, setNotes] = useState('');

  return (
    <Modal
      open={true}
      onClose={onClose}
      title="CHARUSAT Security Flag Review"
      description="Inspect anti-proxy device telemetry and determine compliance action."
      maxWidth={580}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => {
              dataService.reviewSecurity(event.id, resolution, notes);
              onClose();
              onToast(`Security event resolved: ${resolution}`);
            }}
          >
            Commit resolution
          </Button>
        </>
      }
    >
      <div className="form-stack">
        <div className="confirmation-note">
          <span className="avatar">{student ? initials(student.name) : 'ST'}</span>
          <div>
            <b>{student?.name ?? 'Unknown Student'}</b>
            <small>{student?.studentId} · {student ? classLabel(store, student.classId) : ''}</small>
          </div>
        </div>

        <div style={{ padding: '12px 14px', background: '#fcfbf8', border: '1px solid #e7e2d8', borderRadius: 8, fontSize: 11 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <b>Flag: {event.event}</b>
            <RiskScoreBadge score={event.riskScore} />
          </div>
          <p style={{ margin: '0 0 6px', color: '#687773' }}>{event.reason}</p>
          <div style={{ fontSize: 10, color: '#8a9692' }}>
            <div>Hardware Token / Fingerprint: <b>{event.deviceFingerprint ?? 'Unregistered browser'}</b></div>
            <div>Location / Subnet: <b>{event.ipLocation ?? 'CHARUSAT Campus Wi-Fi'}</b></div>
          </div>
        </div>

        <label className="form-field">
          <span>Resolution action</span>
          <select
            value={resolution}
            onChange={e => setResolution(e.target.value as any)}
          >
            <option value="Reviewed">Approve as Legitimate (Student verified in lecture hall)</option>
            <option value="Dismissed">Dismiss Flag (Temporary network anomaly / Wi-Fi handover)</option>
            <option value="Marked as Proxy">Confirm Proxy Abuse (Disqualify check-in & flag record)</option>
          </select>
        </label>

        <Field
          label="Faculty / Security resolution notes"
          value={notes}
          onChange={setNotes}
          placeholder="e.g. Student presented physical CHARUSAT ID card in CSPIT Lab 204."
        />
      </div>
    </Modal>
  );
}
