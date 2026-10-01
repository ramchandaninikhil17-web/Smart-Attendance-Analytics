/**
 * Subject service — manages subject CRUD.
 */
import { db } from "@workspace/db";
import { subjectsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

export interface CreateSubjectInput {
  name: string;
  code: string;
  credits?: number;
  threshold?: number;
}

/**
 * Create a new subject (admin only).
 */
export async function createSubject(input: CreateSubjectInput) {
  const id = uuidv4();
  await db.insert(subjectsTable).values({
    id,
    name: input.name,
    code: input.code,
    credits: input.credits ?? 4,
    threshold: input.threshold ?? 75,
  });
  return { id, ...input };
}

/**
 * Get all subjects.
 */
export async function getAllSubjects() {
  return db.select().from(subjectsTable);
}

/**
 * Get a single subject by ID.
 */
export async function getSubjectById(subjectId: string) {
  const [subject] = await db
    .select()
    .from(subjectsTable)
    .where(eq(subjectsTable.id, subjectId))
    .limit(1);

  return subject ?? null;
}

/**
 * Update a subject (admin only).
 */
export async function updateSubject(subjectId: string, updates: Partial<CreateSubjectInput>) {
  const setValues: Record<string, unknown> = { updatedAt: new Date() };
  if (updates.name) setValues.name = updates.name;
  if (updates.code) setValues.code = updates.code;
  if (updates.credits !== undefined) setValues.credits = updates.credits;
  if (updates.threshold !== undefined) setValues.threshold = updates.threshold;

  await db.update(subjectsTable).set(setValues).where(eq(subjectsTable.id, subjectId));
  return getSubjectById(subjectId);
}
