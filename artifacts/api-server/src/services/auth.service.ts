/**
 * Authentication service — handles login, registration, password hashing.
 * Never stores plaintext passwords. Never trusts frontend-supplied role.
 */
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { signToken, type AuthenticatedUser } from "../middlewares/auth";
import { getPermissionsForRole, type Role } from "../lib/constants";
import { logger } from "../lib/logger";

const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS) || 12;

export interface LoginResult {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: Role;
    avatar: string | null;
    department: string | null;
    institute: string | null;
  };
  permissions: string[];
}

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
  role: Role;
  department?: string;
  institute?: string;
}

/**
 * Authenticate user with email and password.
 */
export async function login(email: string, password: string): Promise<LoginResult | null> {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase().trim()))
    .limit(1);

  if (!user) {
    return null;
  }

  if (!user.isActive) {
    throw new Error("INACTIVE_ACCOUNT");
  }

  const passwordValid = await bcrypt.compare(password, user.passwordHash);
  if (!passwordValid) {
    return null;
  }

  // Role is ALWAYS determined from database, never from client
  const role = user.role as Role;
  const token = signToken({
    userId: user.id,
    email: user.email,
    role,
  });

  const permissions = getPermissionsForRole(role);

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role,
      avatar: user.avatar,
      department: user.department,
      institute: user.institute,
    },
    permissions,
  };
}

/**
 * Register a new user (admin-initiated or initial seed).
 */
export async function registerUser(input: RegisterInput): Promise<{
  id: string;
  email: string;
  name: string;
  role: Role;
}> {
  // Check for existing user with same email
  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, input.email.toLowerCase().trim()))
    .limit(1);

  if (existing) {
    throw new Error("EMAIL_EXISTS");
  }

  const id = uuidv4();
  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  const avatar = input.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  await db.insert(usersTable).values({
    id,
    email: input.email.toLowerCase().trim(),
    passwordHash,
    name: input.name,
    role: input.role,
    department: input.department ?? null,
    institute: input.institute ?? null,
    avatar,
    isActive: true,
  });

  return { id, email: input.email, name: input.name, role: input.role };
}

/**
 * Get current user profile by ID.
 */
export async function getUserById(userId: string): Promise<AuthenticatedUser | null> {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as Role,
    department: user.department,
    institute: user.institute,
    avatar: user.avatar,
    isActive: user.isActive,
  };
}

/**
 * Change password for a user.
 */
export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<boolean> {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!user) return false;

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) return false;

  const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await db
    .update(usersTable)
    .set({ passwordHash: newHash, updatedAt: new Date() })
    .where(eq(usersTable.id, userId));

  return true;
}

/**
 * Update user profile (only safe fields).
 */
export async function updateUserProfile(
  userId: string,
  updates: { name?: string; avatar?: string; department?: string }
): Promise<boolean> {
  const setValues: Record<string, unknown> = { updatedAt: new Date() };
  if (updates.name) {
    setValues.name = updates.name;
    setValues.avatar = updates.name
      .split(" ")
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase();
  }
  if (updates.avatar) setValues.avatar = updates.avatar;
  if (updates.department) setValues.department = updates.department;

  const result = await db
    .update(usersTable)
    .set(setValues)
    .where(eq(usersTable.id, userId));

  return true;
}

/**
 * Deactivate a user account (admin only).
 */
export async function deactivateUser(userId: string): Promise<boolean> {
  await db
    .update(usersTable)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(usersTable.id, userId));
  return true;
}

/**
 * Activate a user account (admin only).
 */
export async function activateUser(userId: string): Promise<boolean> {
  await db
    .update(usersTable)
    .set({ isActive: true, updatedAt: new Date() })
    .where(eq(usersTable.id, userId));
  return true;
}
