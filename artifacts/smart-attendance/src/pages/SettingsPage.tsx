import React, { useState } from 'react';
import { Check, RefreshCw } from 'lucide-react';
import type { Store } from '../data';
import { dataService } from '../data';
import { Badge, Button, Card, Field, Modal, PageHeader } from '../components';

interface SettingsPageProps {
  store: Store;
  toast: (message: string) => void;
}

export function PreferenceToggle({
  title, body, checked, onChange, testId,
}: {
  title: string; body: string; checked: boolean; onChange: (checked: boolean) => void; testId: string;
}) {
  return (
    <div className="setting-row">
      <span>
        <b>{title}</b>
        <small>{body}</small>
      </span>
      <button
        type="button"
        className={`switch ${checked ? 'on' : ''}`}
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        data-testid={testId}
      >
        <span />
      </button>
    </div>
  );
}

export function SettingsPage({ store, toast }: SettingsPageProps) {
  const [settings, setSettings] = useState(store.settings);
  const [saved, setSaved] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [editProfileModal, setEditProfileModal] = useState(false);
  const [profileName, setProfileName] = useState(store.currentUser.name);
  const [profileEmail, setProfileEmail] = useState(store.currentUser.email);

  const save = () => {
    dataService.setSettings(settings);
    setSaved(true);
    toast('Workspace preferences saved.');
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="CHARUSAT WORKSPACE CONFIGURATION"
        title="Settings & Policies"
        description="Institutional attendance policies, session lengths, compact table density, and university profile settings."
        actions={
          <Button onClick={save} testId="button-save-settings">
            {saved ? <Check size={15} /> : null}
            {saved ? 'Saved' : 'Save changes'}
          </Button>
        }
      />

      <div className="settings-layout">
        <div className="settings-nav">
          <a href="#profile" className="settings-nav-link selected">Profile</a>
          <a href="#attendance" className="settings-nav-link">Attendance defaults</a>
          <a href="#preferences" className="settings-nav-link">Workspace preferences</a>
          <a href="#demo-data" className="settings-nav-link">Demo environment</a>
        </div>

        <div className="settings-content">
          <Card className="settings-card" id="profile">
            <div className="settings-card-head">
              <div>
                <span className="eyebrow">AUTHENTICATED PROFILE</span>
                <h2>Account Details</h2>
              </div>
              <Badge tone="muted">{store.currentUser.role}</Badge>
            </div>
            <div className="profile-settings-row">
              <span className="avatar avatar-profile">{store.currentUser.avatar}</span>
              <div>
                <b>{store.currentUser.name}</b>
                <small>{store.currentUser.email}</small>
              </div>
              <Button variant="secondary" onClick={() => setEditProfileModal(true)} testId="button-edit-profile">
                Edit profile
              </Button>
            </div>
          </Card>

          <Card className="settings-card" id="attendance">
            <div className="settings-card-head">
              <div>
                <span className="eyebrow">INSTITUTIONAL DEFAULTS</span>
                <h2>Campus-Wide Attendance Policies</h2>
                <p>Governs early support radars and student recovery thresholds across all cohorts.</p>
              </div>
            </div>
            <div className="setting-row">
              <span>
                <b>Required attendance threshold</b>
                <small>Students falling below this percentage trigger early support radars (CHARUSAT standard: 75%).</small>
              </span>
              <label className="setting-value">
                <input
                  type="number"
                  min="50"
                  max="95"
                  value={settings.attendanceThreshold}
                  onChange={e => setSettings({ ...settings, attendanceThreshold: Number(e.target.value) })}
                  data-testid="input-setting-threshold"
                /> %
              </label>
            </div>
            <div className="setting-row">
              <span>
                <b>Default lecture session length</b>
                <small>Pre-set duration when instructors launch an attendance window.</small>
              </span>
              <label className="setting-value">
                <input
                  type="number"
                  min="15"
                  max="240"
                  step="15"
                  value={settings.sessionLength}
                  onChange={e => setSettings({ ...settings, sessionLength: Number(e.target.value) })}
                  data-testid="input-setting-session-length"
                /> min
              </label>
            </div>
            <div className="setting-row">
              <span>
                <b>Institution campus name</b>
                <small>Appears in reports, diplomas, and workspace navigation.</small>
              </span>
              <input
                className="setting-text-input"
                value={settings.campus}
                onChange={e => setSettings({ ...settings, campus: e.target.value })}
                data-testid="input-setting-campus"
              />
            </div>
          </Card>

          <Card className="settings-card" id="preferences">
            <div className="settings-card-head">
              <div>
                <span className="eyebrow">DISPLAY PREFERENCES</span>
                <h2>Workspace Customization</h2>
              </div>
            </div>
            <PreferenceToggle
              title="Operational notifications"
              body="Show real-time anti-proxy flags and attendance updates in the notification inbox."
              checked={settings.notifications}
              onChange={value => setSettings({ ...settings, notifications: value })}
              testId="toggle-notifications"
            />
            <PreferenceToggle
              title="Compact table density"
              body="Reduces cell padding for power users monitoring large student rosters."
              checked={settings.compact}
              onChange={value => setSettings({ ...settings, compact: value })}
              testId="toggle-compact-tables"
            />
          </Card>

          <Card className="settings-card danger-zone" id="demo-data">
            <div className="settings-card-head">
              <div>
                <span className="eyebrow">CHARUSAT DEMO ENVIRONMENT</span>
                <h2>Reset Workspace Data</h2>
                <p>Restore the seeded CHARUSAT (CSPIT, DEPSTAR, CMPICA) scenario with fresh cohorts and security records.</p>
              </div>
            </div>
            <Button variant="secondary" onClick={() => setResetConfirm(true)} testId="button-reset-demo">
              <RefreshCw size={15} /> Reset to factory demo data
            </Button>
          </Card>
        </div>
      </div>

      {/* Edit Profile Modal */}
      <Modal
        open={editProfileModal}
        onClose={() => setEditProfileModal(false)}
        title="Edit User Profile"
        description="Update your display identity in this workspace."
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditProfileModal(false)}>Cancel</Button>
            <Button
              onClick={() => {
                dataService.updateCurrentUser({ name: profileName, email: profileEmail });
                setEditProfileModal(false);
                toast('User profile updated.');
              }}
            >
              Save profile
            </Button>
          </>
        }
      >
        <div className="form-stack">
          <Field label="Display name" value={profileName} onChange={setProfileName} required />
          <Field label="Institutional email" type="email" value={profileEmail} onChange={setProfileEmail} required />
        </div>
      </Modal>

      {/* Reset Confirmation Modal */}
      <Modal
        open={resetConfirm}
        onClose={() => setResetConfirm(false)}
        title="Reset All Workspace Changes?"
        description="This will restore the original seeded CHARUSAT dataset."
        footer={
          <>
            <Button variant="secondary" onClick={() => setResetConfirm(false)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                dataService.reset();
                setSettings(dataService.get().settings);
                setResetConfirm(false);
                toast('Workspace reset to original CHARUSAT demo scenario.');
              }}
              testId="button-confirm-reset"
            >
              Reset demo data
            </Button>
          </>
        }
      >
        <div className="confirmation-note">
          <span className="confirmation-symbol danger-symbol"><RefreshCw size={17} /></span>
          <div>
            <b>Demo Data Re-initialization</b>
            <small>Students, sessions, security events, and thresholds will revert to default state.</small>
          </div>
        </div>
      </Modal>
    </div>
  );
}
