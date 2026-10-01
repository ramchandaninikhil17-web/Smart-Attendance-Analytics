/**
 * Enrollment service — manages student-class-subject enrollments.
 */
import { db } from "@workspace/db";
import {
  enrollmentsTable, studentsTable, classesTable, subjectsTable, usersTable
} from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

export interface CreateEnrollmentInput {
  studentId: string;
  classId: string;
  subjectId?: string;
}

/**
 * Create a new enrollment (admin only).
 */
export async function createEnrollment(input: CreateEnrollmentInput) {
  // Check for duplicate enrollment
  const conditions = [
    eq(enrollmentsTable.studentId, input.studentId),
    eq(enrollmentsTable.classId, input.classId),
    eq(enrollmentsTable.status, "active"),
  ];

  const [existing] = await db
    .select({ id: enrollmentsTable.id })
    .from(enrollmentsTable)
    .where(and(...conditions))
    .limit(1);

  if (existing) {
    throw new Error("DUPLICATE_ENROLLMENT");
  }

  const id = uuidv4();
  await db.insert(enrollmentsTable).values({
    id,
    studentId: input.studentId,
    classId: input.classId,
    subjectId: input.subjectId ?? null,
    status: "active",
  });

  return { id, ...input };
}

/**
 * Get all enrollments (admin view).
 */
export async function getAllEnrollments() {
  return db
    .select({
      id: enrollmentsTable.id,
      studentId: enrollmentsTable.studentId,
      classId: enrollmentsTable.classId,
      subjectId: enrollmentsTable.subjectId,
      status: enrollmentsTable.status,
      enrolledAt: enrollmentsTable.enrolledAt,
      studentName: usersTable.name,
      studentRollNo: studentsTable.studentId,
      className: classesTable.name,
      classSection: classesTable.section,
    })
    .from(enrollmentsTable)
    .innerJoin(studentsTable, eq(enrollmentsTable.studentId, studentsTable.id))
    .innerJoin(usersTable, eq(studentsTable.userId, usersTable.id))
    .innerJoin(classesTable, eq(enrollmentsTable.classId, classesTable.id));
}

/**
 * Get enrollments for a specific student.
 */
export async function getEnrollmentsForStudent(studentId: string) {
  return db
    .select({
      id: enrollmentsTable.id,
      classId: enrollmentsTable.classId,
      subjectId: enrollmentsTable.subjectId,
      status: enrollmentsTable.status,
      enrolledAt: enrollmentsTable.enrolledAt,
      className: classesTable.name,
      classSection: classesTable.section,
    })
    .from(enrollmentsTable)
    .innerJoin(classesTable, eq(enrollmentsTable.classId, classesTable.id))
    .where(and(
      eq(enrollmentsTable.studentId, studentId),
      eq(enrollmentsTable.status, "active")
    ));
}

/**
 * Drop/remove an enrollment (admin only).
 */
export async function dropEnrollment(enrollmentId: string) {
  await db
    .update(enrollmentsTable)
    .set({ status: "dropped", updatedAt: new Date() })
    .where(eq(enrollmentsTable.id, enrollmentId));
}
