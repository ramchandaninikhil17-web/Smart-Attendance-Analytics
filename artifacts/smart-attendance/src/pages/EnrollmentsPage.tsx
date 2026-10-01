import React, { useState } from 'react';
import { Check, ArrowRight, CircleHelp } from 'lucide-react';
import type { Store } from '../data';
import { dataService } from '../data';
import { Badge, Button, Card, PageHeader } from '../components';
import { getTeacher, classLabel, initials } from '../utils';

interface EnrollmentsPageProps {
  store: Store;
  toast: (message: string) => void;
}

export function EnrollmentsPage({ store, toast }: EnrollmentsPageProps) {
  const [classId, setClassId] = useState(store.classes[0]?.id ?? '');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);

  const room = store.classes.find(c => c.id === classId);
  const classStudents = store.students.filter(s => s.classId === classId);

  const toggleStudent = (id: string) =>
    setSelectedStudents(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  const toggleSubject = (id: string) =>
    setSelectedSubjects(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

  const save = () => {
    if (!room) return;
    dataService.update(s => ({
      ...s,
      classes: s.classes.map(c =>
        c.id === classId
          ? {
              ...c,
              studentIds: Array.from(new Set([...c.studentIds, ...selectedStudents])),
              subjectIds: Array.from(new Set([...c.subjectIds, ...selectedSubjects])),
            }
          : c
      ),
      students: s.students.map(st => (selectedStudents.includes(st.id) ? { ...st, classId } : st)),
    }));
    setSelectedStudents([]);
    setSelectedSubjects([]);
    toast('Cohort roster assignments committed.');
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="CHARUSAT ROSTER MANAGEMENT"
        title="Enrollments & Cohort Assignments"
        description="Assign students and coursework to engineering cohorts to organize attendance verification registers."
        actions={
          <Button onClick={save} testId="button-save-enrollments">
            <Check size={16} /> Save roster assignments
          </Button>
        }
      />

      <div className="enrollment-layout">
        <Card className="enrollment-class-panel">
          <span className="eyebrow">TARGET COHORT</span>
          <h2>Class Roster</h2>
          <label className="form-field">
            <span>Select cohort</span>
            <select
              value={classId}
              onChange={e => {
                setClassId(e.target.value);
                setSelectedStudents([]);
                setSelectedSubjects([]);
              }}
              data-testid="select-enrollment-class"
            >
              {store.classes.map(c => <option key={c.id} value={c.id}>{c.name} · {c.section}</option>)}
            </select>
          </label>
          {room && (
            <>
              <div className="enroll-class-summary">
                <span className="avatar avatar-large">{room.name.substring(0, 2).toUpperCase()}</span>
                <div>
                  <b>{room.name} · Section {room.section}</b>
                  <small>{room.semester} · {room.room}</small>
                </div>
              </div>
              <div className="enroll-summary-numbers">
                <div><b>{room.studentIds.length || classStudents.length}</b><span>enrolled students</span></div>
                <div><b>{room.subjectIds.length}</b><span>assigned subjects</span></div>
              </div>
            </>
          )}
        </Card>

        <Card className="enrollment-list-card">
          <div className="enrollment-section-heading">
            <div>
              <span className="eyebrow">STUDENTS</span>
              <h2>Assign Students to Cohort</h2>
            </div>
            <span className="selection-note">
              {selectedStudents.length ? `${selectedStudents.length} selected` : 'Select to transfer'}
            </span>
          </div>
          <div className="enroll-list">
            {store.students.filter(s => s.classId !== classId).slice(0, 14).map(student => (
              <label className="enroll-row" key={student.id}>
                <input
                  type="checkbox"
                  checked={selectedStudents.includes(student.id)}
                  onChange={() => toggleStudent(student.id)}
                  data-testid={`checkbox-enroll-${student.id}`}
                />
                <span className="avatar avatar-small">{initials(student.name)}</span>
                <span>
                  <b>{student.name}</b>
                  <small>{student.studentId} · currently in {classLabel(store, student.classId)}</small>
                </span>
                <ArrowRight size={14} />
              </label>
            ))}
          </div>
        </Card>

        <Card className="enrollment-subject-card">
          <div className="enrollment-section-heading">
            <div>
              <span className="eyebrow">CURRICULUM</span>
              <h2>Assign Subjects</h2>
            </div>
          </div>
          <div className="subject-check-list">
            {store.subjects.map(subject => (
              <label className="subject-check-row" key={subject.id}>
                <input
                  type="checkbox"
                  checked={room?.subjectIds.includes(subject.id) || selectedSubjects.includes(subject.id) || false}
                  disabled={room?.subjectIds.includes(subject.id)}
                  onChange={() => toggleSubject(subject.id)}
                />
                <span className="code-chip">{subject.code}</span>
                <span>
                  <b>{subject.name}</b>
                  <small>{getTeacher(store, subject.teacherId)?.name} · threshold {subject.threshold}%</small>
                </span>
                {room?.subjectIds.includes(subject.id) && <Badge tone="green">Assigned</Badge>}
              </label>
            ))}
          </div>
          <div className="roster-footnote">
            <CircleHelp size={14} /> Assignments update classroom session rosters in real time.
          </div>
        </Card>
      </div>
    </div>
  );
}
