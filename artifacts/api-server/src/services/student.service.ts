/**
 * Student service — manages student CRUD and ownership enforcement.
 */
import { db } from "@workspace/db";
import {
  studentsTable, usersTable, enrollmentsTable, classesTable,
  teacherAssignmentsTable
} from "@workspace/db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";
import type { Role } from "../lib/constants";

const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS) || 12;

export interface CreateStudentInput {
  name: string;
  email: string;
  password: string;
  studentId: string;
  classId?: string;
  institute?: string;
  department?: string;
}

/**
 * Create student with linked user account.
 */
export async function createStudent(input: CreateStudentInput) {
  const userId = uuidv4();
  const studentRecordId = uuidv4();
  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  const avatar = input.name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  // Create user account
  await db.insert(usersTable).values({
    id: userId,
    email: input.email.toLowerCase().trim(),
    passwordHash,
    name: input.name,
    role: "STUDENT",
    department: input.department ?? null,
    institute: input.institute ?? null,
    avatar,
    isActive: true,
  });

  // Create student profile
  await db.insert(studentsTable).values({
    id: studentRecordId,
    userId,
    studentId: input.studentId,
    classId: input.classId ?? null,
    attendancePercent: 0,
    status: "Active",
  });

  return { id: studentRecordId, userId, studentId: input.studentId, name: input.name, email: input.email };
}

/**
 * Get all students (admin view).
 */
export async function getAllStudents() {
  return db
    .select({
      id: studentsTable.id,
      userId: studentsTable.userId,
      studentId: studentsTable.studentId,
      classId: studentsTable.classId,
      attendancePercent: studentsTable.attendancePercent,
      status: studentsTable.status,
      name: usersTable.name,
      email: usersTable.email,
      institute: usersTable.institute,
      isActive: usersTable.isActive,
    })
    .from(studentsTable)
    .innerJoin(usersTable, eq(studentsTable.userId, usersTable.id));
}

/**
 * Get students visible to a specific teacher (only students in teacher's assigned classes).
 */
export async function getStudentsForTeacher(teacherId: string) {
  // Get teacher's assigned class IDs
  const assignments = await db
    .select({ classId: teacherAssignmentsTable.classId })
    .from(teacherAssignmentsTable)
    .where(and(
      eq(teacherAssignmentsTable.teacherId, teacherId),
      eq(teacherAssignmentsTable.status, "active")
    ));

  const classIds = assignments.map((a) => a.classId);
  if (classIds.length === 0) return [];

  // Get students enrolled in those classes
  const enrolledStudentIds = await db
    .select({ studentId: enrollmentsTable.studentId })
    .from(enrollmentsTable)
    .where(and(
      inArray(enrollmentsTable.classId, classIds),
      eq(enrollmentsTable.status, "active")
    ));

  const studentIds = [...new Set(enrolledStudentIds.map((e) => e.studentId))];
  if (studentIds.length === 0) return [];

  return db
    .select({
      id: studentsTable.id,
      userId: studentsTable.userId,
      studentId: studentsTable.studentId,
      classId: studentsTable.classId,
      attendancePercent: studentsTable.attendancePercent,
      status: studentsTable.status,
      name: usersTable.name,
      email: usersTable.email,
      institute: usersTable.institute,
    })
    .from(studentsTable)
    .innerJoin(usersTable, eq(studentsTable.userId, usersTable.id))
    .where(inArray(studentsTable.id, studentIds));
}

/**
 * Get a single student by their record ID.
 */
export async function getStudentById(studentId: string) {
  const [student] = await db
    .select({
      id: studentsTable.id,
      userId: studentsTable.userId,
      studentId: studentsTable.studentId,
      classId: studentsTable.classId,
      attendancePercent: studentsTable.attendancePercent,
      status: studentsTable.status,
      name: usersTable.name,
      email: usersTable.email,
      institute: usersTable.institute,
      isActive: usersTable.isActive,
    })
    .from(studentsTable)
    .innerJoin(usersTable, eq(studentsTable.userId, usersTable.id))
    .where(eq(studentsTable.id, studentId))
    .limit(1);

  return student ?? null;
}

/**
 * Get student profile by user ID (for student self-access).
 */
export async function getStudentByUserId(userId: string) {
  const [student] = await db
    .select({
      id: studentsTable.id,
      userId: studentsTable.userId,
      studentId: studentsTable.studentId,
      classId: studentsTable.classId,
      attendancePercent: studentsTable.attendancePercent,
      status: studentsTable.status,
      name: usersTable.name,
      email: usersTable.email,
      institute: usersTable.institute,
    })
    .from(studentsTable)
    .innerJoin(usersTable, eq(studentsTable.userId, usersTable.id))
    .where(eq(studentsTable.userId, userId))
    .limit(1);

  return student ?? null;
}

/**
 * Verify if a teacher is authorized to view a specific student.
 */
export async function isTeacherAuthorizedForStudent(teacherId: string, studentId: string): Promise<boolean> {
  // Get teacher's assigned class IDs
  const assignments = await db
    .select({ classId: teacherAssignmentsTable.classId })
    .from(teacherAssignmentsTable)
    .where(and(
      eq(teacherAssignmentsTable.teacherId, teacherId),
      eq(teacherAssignmentsTable.status, "active")
    ));

  const classIds = assignments.map((a) => a.classId);
  if (classIds.length === 0) return false;

  // Check if student is enrolled in any of those classes
  const [enrollment] = await db
    .select({ id: enrollmentsTable.id })
    .from(enrollmentsTable)
    .where(and(
      eq(enrollmentsTable.studentId, studentId),
      inArray(enrollmentsTable.classId, classIds),
      eq(enrollmentsTable.status, "active")
    ))
    .limit(1);

  return !!enrollment;
}

/**
 * Update student profile (admin action).
 */
export async function updateStudent(
  studentId: string,
  updates: { classId?: string; status?: string; attendancePercent?: number }
) {
  const setValues: Record<string, unknown> = { updatedAt: new Date() };
  if (updates.classId !== undefined) setValues.classId = updates.classId;
  if (updates.status !== undefined) setValues.status = updates.status;
  if (updates.attendancePercent !== undefined) setValues.attendancePercent = updates.attendancePercent;

  await db.update(studentsTable).set(setValues).where(eq(studentsTable.id, studentId));
  return getStudentById(studentId);
}
