import React from 'react';
import { RefreshCw, Fingerprint, Radio, ShieldAlert, SlidersHorizontal, LockKeyhole } from 'lucide-react';
import { Modal, Button } from '../components';

interface HelpModalProps {
  open: boolean;
  onClose: () => void;
}

export function HelpModal({ open, onClose }: HelpModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="CHARUSAT Anti-Proxy Security & Attendance Protocol"
      description="How CHARUSAT validates authentic classroom presence across CSPIT, DEPSTAR, and CMPICA."
      maxWidth={620}
      footer={<Button onClick={onClose}>Close overview</Button>}
    >
      <div className="security-protocol-grid">
        <div className="protocol-item">
          <div className="protocol-icon"><RefreshCw size={16} /></div>
          <div className="protocol-copy">
            <h4>15-Second Rotating Dynamic QR</h4>
            <p>Classroom QR codes and 6-digit rolling OTP keys cycle dynamically every 15 seconds. Photos shared to friends outside the lecture hall expire before they can be redeemed.</p>
          </div>
        </div>
        <div className="protocol-item">
          <div className="protocol-icon"><Fingerprint size={16} /></div>
          <div className="protocol-copy">
            <h4>FIDO2 WebAuthn Passkeys</h4>
            <p>Students authenticate directly against their device's Secure Enclave/TPM with biometric verification (Face ID/Touch ID). Private keys never leave the registered phone.</p>
          </div>
        </div>
        <div className="protocol-item">
          <div className="protocol-icon"><Radio size={16} /></div>
          <div className="protocol-copy">
            <h4>Geofence & Wi-Fi Triangulation</h4>
            <p>Verification requests validate CHARUSAT campus subnet and classroom Wi-Fi AP telemetry (45m radius) to ensure physical presence inside the lecture hall perimeter.</p>
          </div>
        </div>
        <div className="protocol-item">
          <div className="protocol-icon"><ShieldAlert size={16} /></div>
          <div className="protocol-copy">
            <h4>Mid-Lecture Spot Checks</h4>
            <p>Professors can trigger an on-demand 60-second spot check during lectures. Randomly sampled students confirm ongoing presence to combat "mark-and-leave" abuse.</p>
          </div>
        </div>
        <div className="protocol-item">
          <div className="protocol-icon"><SlidersHorizontal size={16} /></div>
          <div className="protocol-copy">
            <h4>Continuous Risk Scoring</h4>
            <p>Every check-in produces a 0–100 risk score based on hardware fingerprint consistency, time delta, and IP origin. Suspicious attempts are queued for faculty review.</p>
          </div>
        </div>
        <div className="protocol-item">
          <div className="protocol-icon"><LockKeyhole size={16} /></div>
          <div className="protocol-copy">
            <h4>Tamper-Proof Audit Trail</h4>
            <p>Every session creation, passkey attestation, manual correction, and review resolution is recorded with timestamp and actor for CHARUSAT academic compliance.</p>
          </div>
        </div>
      </div>
    </Modal>
  );
}
