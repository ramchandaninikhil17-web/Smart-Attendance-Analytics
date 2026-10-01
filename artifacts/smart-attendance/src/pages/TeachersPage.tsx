import React, { useState, type FormEvent } from 'react';
import { Link } from 'wouter';
import { Plus, MoreHorizontal, BookOpen, ArrowRight } from 'lucide-react';
import type { Store, Teacher } from '../data';
import { dataService } from '../data';
import { Button, Card, EmptyState, Field, Modal, PageHeader, SearchInput } from '../components';
import { initials } from '../utils';

interface TeachersPageProps {
  store: Store;
  toast: (message: string) => void;
}

export function TeachersPage({ store, toast }: TeachersPageProps) {
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [form, setForm] = useState({ name: '', email: '', department: '' });

  const list = store.teachers.filter(t =>
    `${t.name} ${t.department} ${t.email}`.toLowerCase().includes(query.toLowerCase())
  );

  const save = (e: FormEvent) => {
    e.preventDefault();
    dataService.upsert('teachers', {
      ...form,
      id: editing?.id ?? `t${Date.now()}`,
      classes: editing?.classes ?? [],
      institute: editing?.institute ?? 'CSPIT',
    });
    setModal(false);
    toast(editing ? 'Faculty profile updated.' : 'Faculty member added to CHARUSAT directory.');
  };

  const start = (teacher?: Teacher) => {
    setEditing(teacher ?? null);
    setForm(teacher ? { name: teacher.name, email: teacher.email, department: teacher.department } : { name: '', email: '', department: '' });
    setModal(true);
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="CHARUSAT FACULTY DIRECTORY"
        title="Professors & Faculty Mentors"
        description={`${store.teachers.length} faculty educators conducting lecture sessions, laboratory practicals, and anti-proxy attendance verification across CSPIT and DEPSTAR.`}
        actions={
          <Button onClick={() => start()} testId="button-add-teacher">
            <Plus size={16} /> Add faculty member
          </Button>
        }
      />

      <div className="directory-toolbar standalone-toolbar">
        <SearchInput value={query} onChange={setQuery} placeholder="Search faculty by name, department, or email..." />
      </div>

      <div className="teacher-grid">
        {list.map(t => (
          <Card key={t.id} className="teacher-card" data-testid={`card-teacher-${t.id}`}>
            <div className="teacher-card-top">
              <span className="avatar avatar-profile">{initials(t.name)}</span>
              <button
                className="icon-button"
                onClick={() => start(t)}
                aria-label={`Edit ${t.name}`}
                data-testid={`button-edit-teacher-${t.id}`}
              >
                <MoreHorizontal size={18} />
              </button>
            </div>
            <div className="teacher-info">
              <h2>{t.name}</h2>
              <p>{t.department}</p>
              <span className="teacher-email">{t.email}</span>
            </div>
            <div className="teacher-card-bottom">
              <span><BookOpen size={15} /> {t.classes.length} assigned cohorts</span>
              <Link href="/classes" className="text-link">View cohorts <ArrowRight size={14} /></Link>
            </div>
          </Card>
        ))}
        {list.length === 0 && (
          <Card className="empty-card">
            <EmptyState title="No faculty found" body="Try a different search query or add a faculty member." />
          </Card>
        )}
      </div>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editing ? 'Edit Faculty Details' : 'Add CHARUSAT Faculty Member'}
        description="Manage instructor profiles in the university registry."
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
            <Button type="submit" form="teacher-form" testId="button-save-teacher">
              Save faculty profile
            </Button>
          </>
        }
      >
        <form id="teacher-form" className="form-stack" onSubmit={save}>
          <Field label="Full name" value={form.name} onChange={v => setForm({ ...form, name: v })} placeholder="e.g. Dr. Amit Ganatra" required />
          <Field label="Email address" type="email" value={form.email} onChange={v => setForm({ ...form, email: v })} placeholder="amit.ganatra@charusat.ac.in" required />
          <Field label="Academic department / Institute" value={form.department} onChange={v => setForm({ ...form, department: v })} placeholder="e.g. Computer Science & Engineering (CSPIT)" required />
        </form>
      </Modal>
    </div>
  );
}
