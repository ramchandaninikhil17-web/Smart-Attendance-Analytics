/**
 * Centralized role and permission constants.
 * ALL permission checks reference this module — never hardcode permission strings elsewhere.
 */

export const ROLES = {
  ADMIN: "ADMIN",
  TEACHER: "TEACHER",
  STUDENT: "STUDENT",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

/**
 * Centralized permission definitions.
 * Format: domain.resource.action
 */
export const PERMISSIONS = {
  // Admin permissions
  ADMIN_USERS_MANAGE: "admin.users.manage",
  ADMIN_TEACHERS_MANAGE: "admin.teachers.manage",
  ADMIN_STUDENTS_MANAGE: "admin.students.manage",
  ADMIN_CLASSES_MANAGE: "admin.classes.manage",
  ADMIN_SUBJECTS_MANAGE: "admin.subjects.manage",
  ADMIN_ENROLLMENTS_MANAGE: "admin.enrollments.manage",
  ADMIN_SETTINGS_MANAGE: "admin.settings.manage",
  ADMIN_AUDIT_READ: "admin.audit.read",
  ADMIN_SECURITY_READ: "admin.security.read",
  ADMIN_SECURITY_MANAGE: "admin.security.manage",
  ADMIN_REPORTS_READ: "admin.reports.read",
  ADMIN_ATTENDANCE_READ: "admin.attendance.read",
  ADMIN_ATTENDANCE_CORRECT: "admin.attendance.correct",
  ADMIN_NOTIFICATIONS_READ: "admin.notifications.read",

  // Teacher permissions
  TEACHER_SESSIONS_CREATE: "teacher.sessions.create",
  TEACHER_SESSIONS_MANAGE: "teacher.sessions.manage",
  TEACHER_ATTENDANCE_READ: "teacher.attendance.read",
  TEACHER_ATTENDANCE_MARK: "teacher.attendance.mark",
  TEACHER_ATTENDANCE_CORRECT: "teacher.attendance.correct",
  TEACHER_ANALYTICS_READ: "teacher.analytics.read",
  TEACHER_SECURITY_READ: "teacher.security.read",
  TEACHER_CLASSES_READ: "teacher.classes.read",
  TEACHER_STUDENTS_READ: "teacher.students.read",
  TEACHER_PROFILE_MANAGE: "teacher.profile.manage",
  TEACHER_NOTIFICATIONS_READ: "teacher.notifications.read",

  // Student permissions
  STUDENT_ATTENDANCE_VERIFY: "student.attendance.verify",
  STUDENT_ATTENDANCE_READ_OWN: "student.attendance.read_own",
  STUDENT_ANALYTICS_READ_OWN: "student.analytics.read_own",
  STUDENT_PROFILE_MANAGE_OWN: "student.profile.manage_own",
  STUDENT_PASSKEY_MANAGE_OWN: "student.passkey.manage_own",
  STUDENT_NOTIFICATIONS_READ_OWN: "student.notifications.read_own",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * Role → Permission mapping.
 * This is the single source of truth for what each role can do.
 */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [ROLES.ADMIN]: [
    PERMISSIONS.ADMIN_USERS_MANAGE,
    PERMISSIONS.ADMIN_TEACHERS_MANAGE,
    PERMISSIONS.ADMIN_STUDENTS_MANAGE,
    PERMISSIONS.ADMIN_CLASSES_MANAGE,
    PERMISSIONS.ADMIN_SUBJECTS_MANAGE,
    PERMISSIONS.ADMIN_ENROLLMENTS_MANAGE,
    PERMISSIONS.ADMIN_SETTINGS_MANAGE,
    PERMISSIONS.ADMIN_AUDIT_READ,
    PERMISSIONS.ADMIN_SECURITY_READ,
    PERMISSIONS.ADMIN_SECURITY_MANAGE,
    PERMISSIONS.ADMIN_REPORTS_READ,
    PERMISSIONS.ADMIN_ATTENDANCE_READ,
    PERMISSIONS.ADMIN_ATTENDANCE_CORRECT,
    PERMISSIONS.ADMIN_NOTIFICATIONS_READ,
  ],
  [ROLES.TEACHER]: [
    PERMISSIONS.TEACHER_SESSIONS_CREATE,
    PERMISSIONS.TEACHER_SESSIONS_MANAGE,
    PERMISSIONS.TEACHER_ATTENDANCE_READ,
    PERMISSIONS.TEACHER_ATTENDANCE_MARK,
    PERMISSIONS.TEACHER_ATTENDANCE_CORRECT,
    PERMISSIONS.TEACHER_ANALYTICS_READ,
    PERMISSIONS.TEACHER_SECURITY_READ,
    PERMISSIONS.TEACHER_CLASSES_READ,
    PERMISSIONS.TEACHER_STUDENTS_READ,
    PERMISSIONS.TEACHER_PROFILE_MANAGE,
    PERMISSIONS.TEACHER_NOTIFICATIONS_READ,
  ],
  [ROLES.STUDENT]: [
    PERMISSIONS.STUDENT_ATTENDANCE_VERIFY,
    PERMISSIONS.STUDENT_ATTENDANCE_READ_OWN,
    PERMISSIONS.STUDENT_ANALYTICS_READ_OWN,
    PERMISSIONS.STUDENT_PROFILE_MANAGE_OWN,
    PERMISSIONS.STUDENT_PASSKEY_MANAGE_OWN,
    PERMISSIONS.STUDENT_NOTIFICATIONS_READ_OWN,
  ],
};

/**
 * Check if a role has a specific permission.
 */
export function hasPermission(role: Role, permission: Permission): boolean {
  const perms = ROLE_PERMISSIONS[role];
  return perms ? perms.includes(permission) : false;
}

/**
 * Get all permissions for a role.
 */
export function getPermissionsForRole(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

/**
 * Session status transitions (state machine).
 */
export const SESSION_TRANSITIONS: Record<string, string[]> = {
  SCHEDULED: ["ACTIVE", "CANCELLED"],
  ACTIVE: ["ENDED", "CANCELLED"],
  ENDED: [],
  CANCELLED: [],
};

/**
 * Error codes for consistent API responses.
 */
export const ERROR_CODES = {
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  BAD_REQUEST: "BAD_REQUEST",
  CONFLICT: "CONFLICT",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  INACTIVE_ACCOUNT: "INACTIVE_ACCOUNT",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  SESSION_EXPIRED: "SESSION_EXPIRED",
  RATE_LIMITED: "RATE_LIMITED",
  INVALID_STATE_TRANSITION: "INVALID_STATE_TRANSITION",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
