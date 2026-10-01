/**
 * Teacher service — manages teacher CRUD and ownership.
 */
import { db } from "@workspace/db";
import {
  teachersTable, usersTable, teacherAssignmentsTable, classesTable, subjectsTable
} from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";

const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS) || 12;

export interface CreateTeacherInput {
  name: string;
  email: string;
  password: string;
  department: string;
  institute: string;
}

/**
 * Create teacher with linked user account.
 */
export async function createTeacher(input: CreateTeacherInput) {
  const userId = uuidv4();
  const teacherRecordId = uuidv4();
  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  const avatar = input.name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  await db.insert(usersTable).values({
    id: userId,
    email: input.email.toLowerCase().trim(),
    passwordHash,
    name: input.name,
    role: "TEACHER",
    department: input.department,
    institute: input.institute,
    avatar,
    isActive: true,
  });

  await db.insert(teachersTable).values({
    id: teacherRecordId,
    userId,
    department: input.department,
    institute: input.institute,
  });

  return { id: teacherRecordId, userId, name: input.name, email: input.email };
}

/**
 * Get all teachers (admin view).
 */
export async function getAllTeachers() {
  return db
    .select({
      id: teachersTable.id,
      userId: teachersTable.userId,
      department: teachersTable.department,
      institute: teachersTable.institute,
      name: usersTable.name,
      email: usersTable.email,
      isActive: usersTable.isActive,
    })
    .from(teachersTable)
    .innerJoin(usersTable, eq(teachersTable.userId, usersTable.id));
}

/**
 * Get teacher by record ID.
 */
export async function getTeacherById(teacherId: string) {
  const [teacher] = await db
    .select({
      id: teachersTable.id,
      userId: teachersTable.userId,
      department: teachersTable.department,
      institute: teachersTable.institute,
      name: usersTable.name,
      email: usersTable.email,
      isActive: usersTable.isActive,
    })
    .from(teachersTable)
    .innerJoin(usersTable, eq(teachersTable.userId, usersTable.id))
    .where(eq(teachersTable.id, teacherId))
    .limit(1);

  return teacher ?? null;
}

/**
 * Get teacher by user ID (for teacher self-access).
 */
export async function getTeacherByUserId(userId: string) {
  const [teacher] = await db
    .select({
      id: teachersTable.id,
      userId: teachersTable.userId,
      department: teachersTable.department,
      institute: teachersTable.institute,
      name: usersTable.name,
      email: usersTable.email,
    })
    .from(teachersTable)
    .innerJoin(usersTable, eq(teachersTable.userId, usersTable.id))
    .where(eq(teachersTable.userId, userId))
    .limit(1);

  return teacher ?? null;
}

/**
 * Get teacher's assignments (classes + subjects).
 */
export async function getTeacherAssignments(teacherId: string) {
  return db
    .select({
      id: teacherAssignmentsTable.id,
      classId: teacherAssignmentsTable.classId,
      subjectId: teacherAssignmentsTable.subjectId,
      status: teacherAssignmentsTable.status,
      className: classesTable.name,
      classSection: classesTable.section,
      subjectName: subjectsTable.name,
      subjectCode: subjectsTable.code,
    })
    .from(teacherAssignmentsTable)
    .leftJoin(classesTable, eq(teacherAssignmentsTable.classId, classesTable.id))
    .leftJoin(subjectsTable, eq(teacherAssignmentsTable.subjectId, subjectsTable.id))
    .where(and(
      eq(teacherAssignmentsTable.teacherId, teacherId),
      eq(teacherAssignmentsTable.status, "active")
    ));
}

/**
 * Verify if a teacher is assigned to a specific class.
 */
export async function isTeacherAssignedToClass(teacherId: string, classId: string): Promise<boolean> {
  const [assignment] = await db
    .select({ id: teacherAssignmentsTable.id })
    .from(teacherAssignmentsTable)
    .where(and(
      eq(teacherAssignmentsTable.teacherId, teacherId),
      eq(teacherAssignmentsTable.classId, classId),
      eq(teacherAssignmentsTable.status, "active")
    ))
    .limit(1);

  return !!assignment;
}

/**
 * Verify if a teacher is assigned to a specific class+subject combination.
 */
export async function isTeacherAssignedToClassSubject(
  teacherId: string, classId: string, subjectId: string
): Promise<boolean> {
  const [assignment] = await db
    .select({ id: teacherAssignmentsTable.id })
    .from(teacherAssignmentsTable)
    .where(and(
      eq(teacherAssignmentsTable.teacherId, teacherId),
      eq(teacherAssignmentsTable.classId, classId),
      eq(teacherAssignmentsTable.subjectId, subjectId),
      eq(teacherAssignmentsTable.status, "active")
    ))
    .limit(1);

  return !!assignment;
}

/**
 * Create a teacher-class-subject assignment (admin action).
 */
export async function createTeacherAssignment(teacherId: string, classId: string, subjectId?: string) {
  const id = uuidv4();
  await db.insert(teacherAssignmentsTable).values({
    id,
    teacherId,
    classId,
    subjectId: subjectId ?? null,
    status: "active",
  });
  return { id, teacherId, classId, subjectId };
}
