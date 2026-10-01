import React, { useState, type FormEvent } from 'react';
import { Plus, MoreHorizontal, SlidersHorizontal } from 'lucide-react';
import type { Store, Subject } from '../data';
import { dataService } from '../data';
import { Button, Card, Field, Modal, PageHeader } from '../components';
import { getTeacher, classLabel } from '../utils';

interface SubjectsPageProps {
  store: Store;
  toast: (message: string) => void;
}

export function SubjectsPage({ store, toast }: SubjectsPageProps) {
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [form, setForm] = useState({ name: '', code: '', teacherId: store.teachers[0]?.id ?? '', threshold: 75 });

  const save = (e: FormEvent) => {
    e.preventDefault();
    dataService.upsert('subjects', {
      ...form,
      id: editing?.id ?? `s${Date.now()}`,
      classIds: editing?.classIds ?? [],
      credits: editing?.credits ?? 3,
    });
    setModal(false);
    toast(editing ? 'Subject configuration updated.' : 'Subject registered with attendance threshold.');
  };

  const openSubject = (subject?: Subject) => {
    setEditing(subject ?? null);
    setForm(subject ? { name: subject.name, code: subject.code, teacherId: subject.teacherId, threshold: subject.threshold } : { name: '', code: '', teacherId: store.teachers[0]?.id ?? '', threshold: 75 });
    setModal(true);
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="CHARUSAT COURSE CATALOG"
        title="Subjects & Minimum Attendance Thresholds"
        description="Individual course thresholds govern 75% early-warning support alerts across engineering cohorts at CSPIT and DEPSTAR."
        actions={
          <Button onClick={() => openSubject()} testId="button-add-subject">
            <Plus size={16} /> Add subject
          </Button>
        }
      />

      <Card className="table-card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Subject</th>
                <th>Course Code</th>
                <th>Lead Instructor</th>
                <th>Assigned Cohorts</th>
                <th>Required Threshold</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {store.subjects.map(subject => (
                <tr key={subject.id} data-testid={`row-subject-${subject.id}`}>
                  <td>
                    <div className="table-title">
                      <b>{subject.name}</b>
                      <small>Attendance tracking active</small>
                    </div>
                  </td>
                  <td><span className="code-chip">{subject.code}</span></td>
                  <td>{getTeacher(store, subject.teacherId)?.name ?? 'Unassigned'}</td>
                  <td>{subject.classIds.map(id => classLabel(store, id)).join(', ') || '—'}</td>
                  <td>
                    <div className="threshold-view">
                      <div className="attendance-mini-track">
                        <span style={{ width: `${subject.threshold}%` }} />
                      </div>
                      <b>{subject.threshold}%</b>
                    </div>
                  </td>
                  <td>
                    <button
                      className="icon-button"
                      onClick={() => openSubject(subject)}
                      aria-label={`Edit ${subject.name}`}
                      data-testid={`button-edit-subject-${subject.id}`}
                    >
                      <MoreHorizontal size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-footer">
          <span><SlidersHorizontal size={14} /> Thresholds signal students needing academic intervention</span>
          <span>{store.subjects.length} active courses</span>
        </div>
      </Card>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editing ? 'Configure Subject' : 'Add New CHARUSAT Subject'}
        description="Define subject codes and minimum attendance threshold expectations."
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
            <Button type="submit" form="subject-form">Save subject</Button>
          </>
        }
      >
        <form id="subject-form" className="form-stack" onSubmit={save}>
          <Field label="Subject name" value={form.name} onChange={v => setForm({ ...form, name: v })} placeholder="e.g. Data Structures & Algorithms" required />
          <Field label="Course code" value={form.code} onChange={v => setForm({ ...form, code: v })} placeholder="CE251" required />
          <label className="form-field">
            <span>Lead instructor</span>
            <select value={form.teacherId} onChange={e => setForm({ ...form, teacherId: e.target.value })}>
              {store.teachers.map(t => <option key={t.id} value={t.id}>{t.name} ({t.department})</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Attendance requirement threshold: <b>{form.threshold}%</b></span>
            <input
              type="range"
              min="50"
              max="95"
              step="5"
              value={form.threshold}
              onChange={e => setForm({ ...form, threshold: Number(e.target.value) })}
              style={{ width: '100%', accentColor: '#187667' }}
            />
            <small>Students falling below {form.threshold}% trigger automated warning notices.</small>
          </label>
        </form>
      </Modal>
    </div>
  );
}
