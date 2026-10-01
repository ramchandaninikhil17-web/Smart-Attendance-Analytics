/**
 * Smart Attendance API Client
 * Connects frontend UI to real backend endpoints.
 */

const TOKEN_KEY = "charusat_auth_token";
const USER_KEY = "charusat_auth_user";

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {}
}

export function getStoredUser(): any | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user: any | null): void {
  try {
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_KEY);
    }
  } catch {}
}

export async function apiFetch<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; message?: string; error?: string; status: number }> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has("Content-Type") && options.body && typeof options.body === "string") {
    headers.set("Content-Type", "application/json");
  }

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  try {
    const res = await fetch(path, {
      ...options,
      headers,
    });

    const contentType = res.headers.get("content-type");
    let json: any = null;

    if (contentType && contentType.includes("application/json")) {
      json = await res.json();
    }

    if (!res.ok) {
      return {
        success: false,
        error: json?.message || `Request failed with status ${res.status}`,
        message: json?.message,
        status: res.status,
      };
    }

    return {
      success: true,
      data: json?.data !== undefined ? json.data : json,
      message: json?.message,
      status: res.status,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Network error. Server may be unreachable.",
      status: 0,
    };
  }
}

// ===== AUTH API =====

export async function loginWithBackend(email: string, password: string = "charusat123") {
  const res = await apiFetch<{ token: string; user: any }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  if (res.success && res.data) {
    setStoredToken(res.data.token);
    setStoredUser(res.data.user);
  }

  return res;
}

export async function fetchCurrentUser() {
  return apiFetch("/api/auth/me");
}

export function logout() {
  setStoredToken(null);
  setStoredUser(null);
}

// ===== SESSION APIS =====

export async function apiCreateSession(classId: string, subjectId?: string) {
  return apiFetch("/api/teacher/sessions", {
    method: "POST",
    body: JSON.stringify({ classId, subjectId }),
  });
}

export async function apiEndSession(sessionId: string) {
  return apiFetch(`/api/teacher/sessions/${sessionId}/end`, {
    method: "PUT",
  });
}

export async function apiGetSessionQR(sessionId: string) {
  return apiFetch<{ token: string; expiresAt: string; rotationIntervalMs: number }>(
    `/api/teacher/sessions/${sessionId}/qr`
  );
}

export async function apiGetSessionSecurityCode(sessionId: string) {
  return apiFetch<{ code: string; expiresAt: string; rotationIntervalMs: number }>(
    `/api/teacher/sessions/${sessionId}/security-code`
  );
}

export async function apiGetSessionStats(sessionId: string) {
  return apiFetch(`/api/teacher/sessions/${sessionId}/stats`);
}

export async function apiTriggerSpotRecheck(sessionId: string, prompt?: string) {
  return apiFetch(`/api/teacher/sessions/${sessionId}/recheck`, {
    method: "POST",
    body: JSON.stringify({ prompt }),
  });
}

export async function apiMarkAttendanceManual(sessionId: string, studentId: string, status: string) {
  return apiFetch(`/api/teacher/sessions/${sessionId}/attendance`, {
    method: "POST",
    body: JSON.stringify({ studentId, status }),
  });
}

export async function apiCorrectAttendance(attendanceId: string, newStatus: string, reason: string) {
  return apiFetch(`/api/teacher/attendance/${attendanceId}/correct`, {
    method: "POST",
    body: JSON.stringify({ newStatus, reason }),
  });
}

export function subscribeLiveSession(
  sessionId: string,
  onEvent: (type: string, data: any) => void
): () => void {
  const token = getStoredToken();
  const url = `/api/teacher/sessions/${sessionId}/live${token ? `?token=${encodeURIComponent(token)}` : ""}`;
  const es = new EventSource(url);

  es.addEventListener("attendance_update", (e) => {
    try {
      onEvent("attendance_update", JSON.parse(e.data));
    } catch {}
  });

  es.addEventListener("recheck_update", (e) => {
    try {
      onEvent("recheck_update", JSON.parse(e.data));
    } catch {}
  });

  es.addEventListener("security_event", (e) => {
    try {
      onEvent("security_event", JSON.parse(e.data));
    } catch {}
  });

  es.addEventListener("session_ended", (e) => {
    try {
      onEvent("session_ended", JSON.parse(e.data));
    } catch {}
  });

  return () => {
    es.close();
  };
}

// ===== STUDENT VERIFICATION APIS =====

export async function apiVerifyAttendance(data: {
  sessionId: string;
  qrToken: string;
  securityCode: string;
  webauthnResponse?: any;
}) {
  return apiFetch<{ attendanceId: string; riskScore: number }>("/api/verify/attendance", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function apiGetActiveSession() {
  return apiFetch<{ id: string; classId: string; status: string; startTime: string }>(
    "/api/verify/active-session"
  );
}

export async function apiGetPasskeys() {
  return apiFetch<any[]>("/api/verify/passkeys");
}

export async function apiGetPasskeyRegisterOptions() {
  return apiFetch("/api/verify/passkey/register/options", { method: "POST" });
}

export async function apiVerifyPasskeyRegister(response: any, deviceName?: string) {
  return apiFetch("/api/verify/passkey/register/verify", {
    method: "POST",
    body: JSON.stringify({ response, deviceName }),
  });
}

export async function apiGetPasskeyAuthOptions(sessionId: string) {
  return apiFetch("/api/verify/passkey/auth/options", {
    method: "POST",
    body: JSON.stringify({ sessionId }),
  });
}

export async function apiGetPendingRechecks() {
  return apiFetch<any[]>("/api/verify/rechecks");
}

export async function apiCompleteRecheck(recheckId: string) {
  return apiFetch(`/api/verify/rechecks/${recheckId}/complete`, { method: "POST" });
}

// ===== SECURITY EVENTS =====

export async function apiGetSecurityEvents(limit: number = 200) {
  return apiFetch<any[]>(`/api/admin/security/events?limit=${limit}`);
}

export async function apiReviewSecurityEvent(id: string, status: "Reviewed" | "Dismissed", reasonNote?: string) {
  return apiFetch(`/api/admin/security/events/${id}/review`, {
    method: "PUT",
    body: JSON.stringify({ status, reasonNote }),
  });
}

// ===== AUDIT LOGS =====

export async function apiGetAuditLogs(limit: number = 100) {
  return apiFetch<any[]>(`/api/admin/audit?limit=${limit}`);
}

// ===== NOTIFICATIONS =====

export async function apiGetNotifications() {
  return apiFetch<any[]>("/api/notifications");
}

export async function apiMarkNotificationRead(id: string) {
  return apiFetch(`/api/notifications/${id}/read`, { method: "PUT" });
}

export async function apiMarkAllNotificationsRead() {
  return apiFetch("/api/notifications/read-all", { method: "PUT" });
}

// ===== SETTINGS =====

export async function apiGetSettings() {
  return apiFetch<Record<string, string>>("/api/settings");
}

export async function apiUpdateSettings(settings: Record<string, string>) {
  return apiFetch("/api/settings", {
    method: "PUT",
    body: JSON.stringify(settings),
  });
}

// ===== ENTITY MANAGEMENT (ADMIN) =====

export async function apiCreateClass(data: { name: string; section: string; semester: string; room: string; institute?: string }) {
  return apiFetch("/api/admin/classes", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function apiCreateSubject(data: { name: string; code: string; threshold?: number; credits?: number }) {
  return apiFetch("/api/admin/subjects", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function apiCreateStudent(data: { name: string; email: string; studentId: string; classId: string; password?: string; department?: string; institute?: string }) {
  return apiFetch("/api/admin/students", {
    method: "POST",
    body: JSON.stringify({
      ...data,
      password: data.password || "charusat123",
      department: data.department || "CSPIT",
      institute: data.institute || "CSPIT",
    }),
  });
}

export async function apiCreateTeacher(data: { name: string; email: string; department: string; institute?: string; password?: string }) {
  return apiFetch("/api/admin/teachers", {
    method: "POST",
    body: JSON.stringify({
      ...data,
      password: data.password || "charusat123",
      institute: data.institute || "CSPIT",
    }),
  });
}

// ===== REAL DATA SYNC =====

export async function fetchStoreData(role: string): Promise<any> {
  const partial: Record<string, any> = {};

  try {
    if (role === "Administrator") {
      const [
        classesRes,
        subjectsRes,
        teachersRes,
        studentsRes,
        sessionsRes,
        securityRes,
        auditRes,
        settingsRes,
        notifsRes,
      ] = await Promise.allSettled([
        apiFetch("/api/admin/classes"),
        apiFetch("/api/admin/subjects"),
        apiFetch("/api/admin/teachers"),
        apiFetch("/api/admin/students"),
        apiFetch("/api/admin/sessions"),
        apiFetch("/api/admin/security/events"),
        apiFetch("/api/admin/audit"),
        apiFetch("/api/settings"),
        apiFetch("/api/notifications"),
      ]);

      if (classesRes.status === "fulfilled" && classesRes.value.success && Array.isArray(classesRes.value.data)) {
        partial.classes = classesRes.value.data.map((c: any) => ({
          id: c.id,
          name: c.name,
          section: c.section,
          semester: c.semester,
          room: c.room,
          institute: c.institute || "CSPIT",
          teacherId: "",
          studentIds: [],
          subjectIds: [],
        }));
      }

      if (subjectsRes.status === "fulfilled" && subjectsRes.value.success && Array.isArray(subjectsRes.value.data)) {
        partial.subjects = subjectsRes.value.data.map((s: any) => ({
          id: s.id,
          name: s.name,
          code: s.code,
          threshold: Number(s.threshold) || 75,
          credits: Number(s.credits) || 3,
          teacherId: "",
          classIds: [],
        }));
      }

      if (teachersRes.status === "fulfilled" && teachersRes.value.success && Array.isArray(teachersRes.value.data)) {
        partial.teachers = teachersRes.value.data.map((t: any) => ({
          id: t.id,
          name: t.name,
          email: t.email,
          department: t.department,
          institute: t.institute || "CSPIT",
          classes: [],
        }));
      }

      if (studentsRes.status === "fulfilled" && studentsRes.value.success && Array.isArray(studentsRes.value.data)) {
        partial.students = studentsRes.value.data.map((st: any) => ({
          id: st.id,
          name: st.name,
          email: st.email,
          studentId: st.studentId,
          classId: st.classId || "",
          attendancePercent: Number(st.attendancePercent) || 85,
          status: st.status || "Active",
          institute: st.institute || "CSPIT",
        }));
      }

      if (sessionsRes.status === "fulfilled" && sessionsRes.value.success && Array.isArray(sessionsRes.value.data)) {
        partial.sessions = sessionsRes.value.data.map((se: any) => ({
          id: se.id,
          classId: se.classId,
          teacherId: se.teacherId,
          start: se.startTime ? new Date(se.startTime).toISOString() : new Date().toISOString(),
          end: se.endTime ? new Date(se.endTime).toISOString() : null,
          status: se.status === "ACTIVE" ? "Live" : se.status === "CANCELLED" ? "Paused" : "Completed",
          code: se.code,
          attendanceRecords: [],
        }));
      }

      if (securityRes.status === "fulfilled" && securityRes.value.success && Array.isArray(securityRes.value.data)) {
        partial.securityEvents = securityRes.value.data.map((e: any) => ({
          id: e.id,
          studentId: e.userId || "",
          event: e.event,
          severity: e.severity,
          riskScore: Number(e.riskScore) || 0,
          status: e.status,
          reason: e.reason || "",
          time: e.createdAt ? new Date(e.createdAt).toISOString() : new Date().toISOString(),
          deviceFingerprint: e.deviceFingerprint,
          ipLocation: e.ipLocation,
        }));
      }

      if (auditRes.status === "fulfilled" && auditRes.value.success && Array.isArray(auditRes.value.data)) {
        partial.auditEvents = auditRes.value.data.map((a: any) => ({
          id: a.id,
          actor: a.actorName || "System",
          action: a.action,
          time: a.createdAt ? new Date(a.createdAt).toISOString() : new Date().toISOString(),
          severity: a.severity || "Info",
        }));
      }

      if (notifsRes.status === "fulfilled" && notifsRes.value.success && Array.isArray(notifsRes.value.data)) {
        partial.notifications = notifsRes.value.data.map((n: any) => ({
          id: n.id,
          title: n.title,
          category: n.type || "General",
          time: n.createdAt ? new Date(n.createdAt).toISOString() : new Date().toISOString(),
          read: Boolean(n.isRead),
          body: n.message,
        }));
      }

      if (settingsRes.status === "fulfilled" && settingsRes.value.success && typeof settingsRes.value.data === "object") {
        const s = settingsRes.value.data;
        partial.settings = {
          campus: s.campus || "Charotar University of Science and Technology (CHARUSAT)",
          attendanceThreshold: Number(s.attendanceThreshold) || 75,
          sessionLength: Number(s.sessionLength) || 60,
          compact: false,
          notifications: true,
          bssidLock: s.bssidLock === "true",
          geofenceRadiusMeters: Number(s.geofenceRadiusMeters) || 45,
        };
      }
    } else if (role === "Teacher") {
      const [classesRes, studentsRes, sessionsRes, notifsRes] = await Promise.allSettled([
        apiFetch("/api/teacher/classes"),
        apiFetch("/api/teacher/students"),
        apiFetch("/api/teacher/sessions"),
        apiFetch("/api/notifications"),
      ]);

      if (classesRes.status === "fulfilled" && classesRes.value.success && Array.isArray(classesRes.value.data)) {
        partial.classes = classesRes.value.data.map((c: any) => ({
          id: c.id,
          name: c.name,
          section: c.section,
          semester: c.semester,
          room: c.room,
          institute: c.institute || "CSPIT",
          teacherId: "",
          studentIds: [],
          subjectIds: [],
        }));
      }

      if (studentsRes.status === "fulfilled" && studentsRes.value.success && Array.isArray(studentsRes.value.data)) {
        partial.students = studentsRes.value.data.map((st: any) => ({
          id: st.id,
          name: st.name,
          email: st.email,
          studentId: st.studentId,
          classId: st.classId || "",
          attendancePercent: Number(st.attendancePercent) || 85,
          status: st.status || "Active",
          institute: st.institute || "CSPIT",
        }));
      }

      if (sessionsRes.status === "fulfilled" && sessionsRes.value.success && Array.isArray(sessionsRes.value.data)) {
        partial.sessions = sessionsRes.value.data.map((se: any) => ({
          id: se.id,
          classId: se.classId,
          teacherId: se.teacherId,
          start: se.startTime ? new Date(se.startTime).toISOString() : new Date().toISOString(),
          end: se.endTime ? new Date(se.endTime).toISOString() : null,
          status: se.status === "ACTIVE" ? "Live" : se.status === "CANCELLED" ? "Paused" : "Completed",
          code: se.code,
          attendanceRecords: [],
        }));
      }

      if (notifsRes.status === "fulfilled" && notifsRes.value.success && Array.isArray(notifsRes.value.data)) {
        partial.notifications = notifsRes.value.data.map((n: any) => ({
          id: n.id,
          title: n.title,
          category: n.type || "General",
          time: n.createdAt ? new Date(n.createdAt).toISOString() : new Date().toISOString(),
          read: Boolean(n.isRead),
          body: n.message,
        }));
      }
    } else if (role === "Student") {
      const [attendanceRes, notifsRes, activeSessionRes] = await Promise.allSettled([
        apiFetch("/api/student/attendance"),
        apiFetch("/api/notifications"),
        apiFetch("/api/verify/active-session"),
      ]);

      if (notifsRes.status === "fulfilled" && notifsRes.value.success && Array.isArray(notifsRes.value.data)) {
        partial.notifications = notifsRes.value.data.map((n: any) => ({
          id: n.id,
          title: n.title,
          category: n.type || "General",
          time: n.createdAt ? new Date(n.createdAt).toISOString() : new Date().toISOString(),
          read: Boolean(n.isRead),
          body: n.message,
        }));
      }
    }
  } catch (syncErr) {
    console.warn("Backend sync notice:", syncErr);
  }

  return partial;
}

export async function apiDeleteEntity(collection: 'students' | 'teachers' | 'classes' | 'subjects', id: string) {
  return apiFetch(`/api/admin/${collection}/${id}`, { method: 'DELETE' });
}

export async function downloadReportCsv(endpoint: string, filename: string): Promise<boolean> {
  const token = getStoredToken();
  try {
    const res = await fetch(endpoint, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return false;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}
