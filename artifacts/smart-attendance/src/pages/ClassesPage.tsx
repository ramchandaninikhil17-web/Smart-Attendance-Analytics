import React, { useState, type FormEvent } from 'react';
import { Link } from 'wouter';
import { Plus, ArrowRight } from 'lucide-react';
import type { Store } from '../data';
import { dataService } from '../data';
import { Button, Card, Field, Modal, PageHeader } from '../components';
import { getTeacher } from '../utils';

interface ClassesPageProps {
  store: Store;
  toast: (message: string) => void;
}

export function ClassesPage({ store, toast }: ClassesPageProps) {
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({
    name: '',
    section: 'A',
    semester: 'Semester 4',
    room: 'CSPIT Room 204',
    teacherId: store.teachers[0]?.id ?? '',
    institute: 'CSPIT' as const,
  });

  const add = (e: FormEvent) => {
    e.preventDefault();
    dataService.upsert('classes', { ...form, id: `c${Date.now()}`, studentIds: [], subjectIds: [] });
    setModal(false);
    toast('New class cohort established.');
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="CHARUSAT ACADEMIC STRUCTURE"
        title="Class Cohorts & Lecture Halls"
        description="Batches connect student rosters, faculty mentors, classroom locations across CSPIT, DEPSTAR, and CMPICA, and subject curriculum."
        actions={
          <Button onClick={() => setModal(true)} testId="button-add-class">
            <Plus size={16} /> Add class cohort
          </Button>
        }
      />

      <div className="class-list">
        {store.classes.map((c, i) => (
          <Card key={c.id} className="class-card" data-testid={`card-class-${c.id}`}>
            <div className={`class-index class-index-${i % 3}`}>0{i + 1}</div>
            <div className="class-main">
              <span className="eyebrow">{c.semester} · {c.room}</span>
              <h2>{c.name} <span>· Section {c.section}</span></h2>
              <p>Faculty Mentor · {getTeacher(store, c.teacherId)?.name ?? 'Unassigned'}</p>
              <div className="class-subjects">
                {c.subjectIds.map(id => store.subjects.find(s => s.id === id)?.code).filter(Boolean).map(code => (
                  <span key={code}>{code}</span>
                ))}
                {c.subjectIds.length === 0 && <span>No subjects assigned</span>}
              </div>
            </div>
            <div className="class-side-stat">
              <b>{c.studentIds.length || store.students.filter(s => s.classId === c.id).length}</b>
              <span>enrolled</span>
              <Link href="/enrollments" className="text-link">Manage roster <ArrowRight size={13} /></Link>
            </div>
          </Card>
        ))}
      </div>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Create CHARUSAT Class Cohort"
        description="Register a new academic group before assigning student rosters."
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
            <Button type="submit" form="class-form">Create cohort</Button>
          </>
        }
      >
        <form id="class-form" className="form-stack" onSubmit={add}>
          <Field label="Cohort name" value={form.name} onChange={v => setForm({ ...form, name: v })} placeholder="e.g. B.Tech Computer Engineering" required />
          <Field label="Section" value={form.section} onChange={v => setForm({ ...form, section: v })} placeholder="CE-A" required />
          <Field label="Semester" value={form.semester} onChange={v => setForm({ ...form, semester: v })} placeholder="Semester 4" required />
          <Field label="Assigned classroom / Lab" value={form.room} onChange={v => setForm({ ...form, room: v })} placeholder="CSPIT Room 204" required />
          <label className="form-field">
            <span>Faculty mentor</span>
            <select value={form.teacherId} onChange={e => setForm({ ...form, teacherId: e.target.value })}>
              {store.teachers.map(t => <option value={t.id} key={t.id}>{t.name} ({t.department})</option>)}
            </select>
          </label>
        </form>
      </Modal>
    </div>
  );
}
