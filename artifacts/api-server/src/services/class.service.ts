/**
 * Class service — manages class CRUD.
 */
import { db } from "@workspace/db";
import { classesTable, teacherAssignmentsTable } from "@workspace/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

export interface CreateClassInput {
  name: string;
  section: string;
  semester: string;
  room?: string;
  institute: string;
}

/**
 * Create a new class (admin only).
 */
export async function createClass(input: CreateClassInput) {
  const id = uuidv4();
  await db.insert(classesTable).values({
    id,
    name: input.name,
    section: input.section,
    semester: input.semester,
    room: input.room ?? null,
    institute: input.institute,
  });
  return { id, ...input };
}

/**
 * Get all classes (admin view).
 */
export async function getAllClasses() {
  return db.select().from(classesTable);
}

/**
 * Get classes visible to a specific teacher (only assigned classes).
 */
export async function getClassesForTeacher(teacherId: string) {
  const assignments = await db
    .select({ classId: teacherAssignmentsTable.classId })
    .from(teacherAssignmentsTable)
    .where(and(
      eq(teacherAssignmentsTable.teacherId, teacherId),
      eq(teacherAssignmentsTable.status, "active")
    ));

  const classIds = assignments.map((a) => a.classId);
  if (classIds.length === 0) return [];

  return db
    .select()
    .from(classesTable)
    .where(inArray(classesTable.id, classIds));
}

/**
 * Get a single class by ID.
 */
export async function getClassById(classId: string) {
  const [cls] = await db
    .select()
    .from(classesTable)
    .where(eq(classesTable.id, classId))
    .limit(1);

  return cls ?? null;
}

/**
 * Update a class (admin only).
 */
export async function updateClass(classId: string, updates: Partial<CreateClassInput>) {
  const setValues: Record<string, unknown> = { updatedAt: new Date() };
  if (updates.name) setValues.name = updates.name;
  if (updates.section) setValues.section = updates.section;
  if (updates.semester) setValues.semester = updates.semester;
  if (updates.room !== undefined) setValues.room = updates.room;
  if (updates.institute) setValues.institute = updates.institute;

  await db.update(classesTable).set(setValues).where(eq(classesTable.id, classId));
  return getClassById(classId);
}
