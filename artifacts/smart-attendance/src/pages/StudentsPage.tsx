import React, { useState, useMemo, type FormEvent } from 'react';
import { Link } from 'wouter';
import {
  Plus, MoreHorizontal, ArrowRight, ChevronLeft, ChevronRight, UserRound, Settings, X,
} from 'lucide-react';
import type { Store, Student } from '../data';
import { dataService } from '../data';
import { Badge, Button, Card, EmptyState, Field, Modal, PageHeader, SearchInput, SelectField } from '../components';
import { classLabel, initials } from '../utils';

interface StudentsPageProps {
  store: Store;
  toast: (message: string) => void;
}

export function StudentsPage({ store, toast }: StudentsPageProps) {
  const [query, setQuery] = useState('');
  const [classId, setClassId] = useState('all');
  const [risk, setRisk] = useState('all');
  const [sort, setSort] = useState('name');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [detailAction, setDetailAction] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);
  const [form, setForm] = useState({ name: '', email: '', studentId: '', classId: 'c1' });

  const perPage = 10;
  const filtered = useMemo(() =>
    store.students.filter(s =>
      `${s.name} ${s.studentId} ${s.email}`.toLowerCase().includes(query.toLowerCase()) &&
      (classId === 'all' || s.classId === classId) &&
      (risk === 'all' || (risk === 'risk' ? s.attendancePercent < store.settings.attendanceThreshold : s.attendancePercent >= store.settings.attendanceThreshold))
    ).sort((a, b) => sort === 'attendance' ? a.attendancePercent - b.attendancePercent : a.name.localeCompare(b.name)),
    [store.students, query, classId, risk, sort, store.settings.attendanceThreshold]
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / perPage));
  const items = filtered.slice((page - 1) * perPage, page * perPage);

  const startCreate = () => {
    setEditing(null);
    const nextNum = String(store.students.length + 1).padStart(3, '0');
    setForm({
      name: '',
      email: '',
      studentId: `22DCSE${nextNum}`,
      classId: store.classes[0]?.id ?? 'c1',
    });
    setModal(true);
  };

  const editStudent = (student: Student) => {
    setEditing(student);
    setForm({ name: student.name, email: student.email, studentId: student.studentId, classId: student.classId });
    setModal(true);
  };

  const saveStudent = (event: FormEvent) => {
    event.preventDefault();
    const item: Student = {
      id: editing?.id ?? `st${Date.now()}`,
      name: form.name,
      email: form.email,
      studentId: form.studentId,
      classId: form.classId,
      attendancePercent: editing?.attendancePercent ?? 100,
      status: editing?.status ?? 'Active',
      institute: editing?.institute ?? 'CSPIT',
    };
    dataService.upsert('students', item);
    setModal(false);
    toast(editing ? 'Student record updated.' : 'Student added to CHARUSAT roster.');
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="CHARUSAT PEOPLE DIRECTORY"
        title="Students"
        description={`${store.students.length} students across CSPIT, DEPSTAR, and CMPICA cohorts. Track 75% attendance threshold and early support indicators.`}
        actions={
          <Button onClick={startCreate} testId="button-add-student">
            <Plus size={16} /> Add student
          </Button>
        }
      />

      <section className="directory-summary">
        <div>
          <span className="summary-dot green" />
          <span><b>{store.students.filter(s => s.attendancePercent >= store.settings.attendanceThreshold).length}</b> meeting 75% threshold</span>
        </div>
        <div>
          <span className="summary-dot amber" />
          <span><b>{store.students.filter(s => s.attendancePercent < store.settings.attendanceThreshold).length}</b> need early advising</span>
        </div>
        <div>
          <span className="summary-dot muted" />
          <span><b>{store.classes.length}</b> cohorts</span>
        </div>
      </section>

      <Card className="table-card directory-card">
        <div className="directory-toolbar">
          <SearchInput
            value={query}
            onChange={v => { setQuery(v); setPage(1); }}
            placeholder="Search name, CHARUSAT ID, or email..."
          />
          <div className="filter-bar">
            <SelectField
              value={classId}
              onChange={v => { setClassId(v); setPage(1); }}
              label="Filter by class"
              testId="select-student-class"
            >
              <option value="all">All classes</option>
              {store.classes.map(c => <option key={c.id} value={c.id}>{c.name} · {c.section}</option>)}
            </SelectField>
            <SelectField
              value={risk}
              onChange={v => { setRisk(v); setPage(1); }}
              label="Filter by status"
            >
              <option value="all">All standings</option>
              <option value="risk">Below threshold (&lt;{store.settings.attendanceThreshold}%)</option>
              <option value="healthy">Meeting threshold (&ge;{store.settings.attendanceThreshold}%)</option>
            </SelectField>
            <SelectField value={sort} onChange={setSort} label="Sort students">
              <option value="name">Name A–Z</option>
              <option value="attendance">Lowest attendance first</option>
            </SelectField>
          </div>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Class</th>
                <th>Attendance Rate</th>
                <th>Support Standing</th>
                <th>Institutional Email</th>
                <th><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {items.map(student => (
                <tr key={student.id} data-testid={`row-student-${student.id}`}>
                  <td>
                    <Link href={`/students/${student.id}`} className="identity-cell table-person-link">
                      <span className="avatar avatar-table">{initials(student.name)}</span>
                      <span>
                        <b>{student.name}</b>
                        <small>{student.studentId}</small>
                      </span>
                    </Link>
                  </td>
                  <td>{classLabel(store, student.classId)}</td>
                  <td>
                    <div className="attendance-cell">
                      <div className="attendance-mini-track">
                        <span
                          className={student.attendancePercent < store.settings.attendanceThreshold ? 'low' : ''}
                          style={{ width: `${student.attendancePercent}%` }}
                        />
                      </div>
                      <b>{student.attendancePercent}%</b>
                    </div>
                  </td>
                  <td>
                    <Badge tone={student.attendancePercent < store.settings.attendanceThreshold ? 'amber' : 'green'}>
                      {student.attendancePercent < store.settings.attendanceThreshold ? 'At risk' : 'On track'}
                    </Badge>
                  </td>
                  <td className="email-cell">{student.email}</td>
                  <td>
                    <div className="row-buttons">
                      <button
                        className="icon-button"
                        onClick={() => editStudent(student)}
                        aria-label={`Edit ${student.name}`}
                        data-testid={`button-edit-student-${student.id}`}
                      >
                        <MoreHorizontal size={17} />
                      </button>
                      <button
                        className="icon-button"
                        onClick={() => setDetailAction(student.id)}
                        aria-label={`More actions for ${student.name}`}
                      >
                        <ArrowRight size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 && (
            <EmptyState
              title="No students match criteria"
              body="Try changing your search terms or filters."
              action={<Button onClick={startCreate}><Plus size={15} /> Add student</Button>}
            />
          )}
        </div>

        <div className="table-footer">
          <span>Showing <b>{filtered.length ? (page - 1) * perPage + 1 : 0}–{Math.min(page * perPage, filtered.length)}</b> of <b>{filtered.length}</b> students</span>
          <div className="pagination">
            <button className="icon-button" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Previous page">
              <ChevronLeft size={16} />
            </button>
            <span className="page-number is-current">{page}</span>
            <button className="icon-button" disabled={page >= pageCount} onClick={() => setPage(page + 1)} aria-label="Next page">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </Card>

      {/* Add / Edit Student Modal */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editing ? 'Edit Student Details' : 'Add New CHARUSAT Student'}
        description="Roster records are stored in this institutional demo environment."
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
            <Button type="submit" form="student-form" testId="button-save-student">
              {editing ? 'Save changes' : 'Add student'}
            </Button>
          </>
        }
      >
        <form id="student-form" onSubmit={saveStudent} className="form-stack">
          <Field label="Full name" value={form.name} onChange={v => setForm({ ...form, name: v })} placeholder="e.g. Aarav Patel" required />
          <Field label="Email address" type="email" value={form.email} onChange={v => setForm({ ...form, email: v })} placeholder="22dcse001@charusat.edu.in" required />
          <Field label="CHARUSAT Student ID" value={form.studentId} onChange={v => setForm({ ...form, studentId: v })} placeholder="e.g. 22DCSE001" required />
          <label className="form-field">
            <span>Assigned cohort</span>
            <select value={form.classId} onChange={e => setForm({ ...form, classId: e.target.value })}>
              {store.classes.map(c => <option key={c.id} value={c.id}>{c.name} · {c.section}</option>)}
            </select>
          </label>
        </form>
      </Modal>

      {/* Student Action Menu Modal */}
      <Modal
        open={!!detailAction}
        onClose={() => setDetailAction(null)}
        title="Student Record Options"
        description="Choose an action for this student record."
        footer={<Button variant="secondary" onClick={() => setDetailAction(null)}>Close</Button>}
      >
        {detailAction && (
          <div className="action-list">
            <Link className="action-item" href={`/students/${detailAction}`} onClick={() => setDetailAction(null)}>
              <UserRound size={16} /> View student profile <ArrowRight size={15} />
            </Link>
            <button
              className="action-item"
              onClick={() => {
                const s = store.students.find(x => x.id === detailAction);
                if (s) editStudent(s);
                setDetailAction(null);
              }}
              data-testid={`button-edit-from-menu-${detailAction}`}
            >
              <Settings size={16} /> Edit student information <ArrowRight size={15} />
            </button>
            <button
              className="action-item action-danger"
              onClick={() => {
                setDeleteTarget(store.students.find(x => x.id === detailAction) ?? null);
                setDetailAction(null);
              }}
              data-testid={`button-delete-student-${detailAction}`}
            >
              <X size={15} /> Remove student from roster <ArrowRight size={15} />
            </button>
          </div>
        )}
      </Modal>

      {/* Delete Student Modal */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Remove Student from Roster?"
        description="All attendance records and cohort links for this student will be archived."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                if (deleteTarget) {
                  dataService.remove('students', deleteTarget.id);
                  toast('Student removed from the roster.');
                }
                setDeleteTarget(null);
              }}
              testId="button-confirm-delete-student"
            >
              Confirm removal
            </Button>
          </>
        }
      >
        {deleteTarget && (
          <div className="confirmation-note">
            <span className="avatar">{initials(deleteTarget.name)}</span>
            <div>
              <b>{deleteTarget.name}</b>
              <small>{deleteTarget.studentId} · {classLabel(store, deleteTarget.classId)}</small>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
