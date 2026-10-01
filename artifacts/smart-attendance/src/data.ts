import * as api from './api';

export type Role = 'Administrator' | 'Teacher' | 'Student';
export type AttendanceStatus = 'Present' | 'Late' | 'Absent' | 'Excused';
export type Entity = 'students' | 'teachers' | 'classes' | 'subjects' | 'sessions' | 'securityEvents' | 'notifications' | 'auditEvents';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar: string;
  department?: string;
}

export interface Student {
  id: string;
  name: string;
  email: string;
  studentId: string;
  classId: string;
  attendancePercent: number;
  status: 'Active' | 'At risk' | 'On leave';
  institute: 'CSPIT' | 'DEPSTAR' | 'CMPICA';
}

export interface Teacher {
  id: string;
  name: string;
  email: string;
  department: string;
  institute: 'CSPIT' | 'DEPSTAR' | 'CMPICA';
  classes: string[];
}

export interface ClassRoom {
  id: string;
  name: string;
  section: string;
  semester: string;
  room: string;
  teacherId: string;
  studentIds: string[];
  subjectIds: string[];
  institute: 'CSPIT' | 'DEPSTAR' | 'CMPICA';
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  teacherId: string;
  classIds: string[];
  threshold: number;
  credits: number;
}

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  studentId: string;
  status: AttendanceStatus;
  time: string;
  verified: boolean;
  verificationMethod?: 'QR + Rotating Code' | 'Passkey (WebAuthn)' | 'Spot Check Verified' | 'Manual Override';
  riskScore?: number;
}

export interface Session {
  id: string;
  classId: string;
  teacherId: string;
  start: string;
  end: string | null;
  status: 'Live' | 'Completed' | 'Paused';
  code: string;
  attendanceRecords: AttendanceRecord[];
  activeSpotCheck?: {
    startedAt: string;
    durationSeconds: number;
    prompt: string;
    completedStudentIds: string[];
  } | null;
}

export interface SecurityEvent {
  id: string;
  studentId: string;
  event: string;
  severity: 'High' | 'Medium' | 'Low';
  riskScore: number;
  time: string;
  status: 'Needs review' | 'Reviewed' | 'Dismissed';
  reason: string;
  deviceFingerprint?: string;
  ipLocation?: string;
}

export interface Notification {
  id: string;
  title: string;
  category: string;
  time: string;
  read: boolean;
  body: string;
}

export interface AuditEvent {
  id: string;
  actor: string;
  action: string;
  time: string;
  severity: 'Info' | 'Warning' | 'Critical';
}

export interface Store {
  students: Student[];
  teachers: Teacher[];
  classes: ClassRoom[];
  subjects: Subject[];
  sessions: Session[];
  securityEvents: SecurityEvent[];
  notifications: Notification[];
  auditEvents: AuditEvent[];
  currentUser: User;
  settings: {
    campus: string;
    attendanceThreshold: number;
    sessionLength: number;
    compact: boolean;
    notifications: boolean;
    bssidLock: boolean;
    geofenceRadiusMeters: number;
  };
}

const charusatStudentNames = [
  'Aarav Patel', 'Diya Shah', 'Devanshu Joshi', 'Harshil Desai', 'Riya Prajapati',
  'Meet Solanki', 'Khushi Varma', 'Ananya Trivedi', 'Yash Parikh', 'Tanvi Mehta',
  'Kavya Dave', 'Pranav Shah', 'Nisarg Bhatt', 'Maitri Panchal', 'Siddharth Raval',
  'Jheel Vaghela', 'Manan Chaudhary', 'Dhyey Barot', 'Hetvi Soni', 'Vatsal Thakkar',
  'Krisha Kothari', 'Rohan Limbachiya', 'Pooja Sheth', 'Dev Patel', 'Janvi Makwana',
  'Harsh Amin', 'Bhavya Rathod', 'Zeel Parmar', 'Dhruv Bhalodia', 'Shreya Darji',
  'Krunal Mistry', 'Nidhi Goti', 'Aayush Gohel', 'Isha Pandya', 'Vivek Chauhan',
  'Priyal Kansara', 'Darshan Dabhi', 'Kinjal Rajput', 'Sahil Memon', 'Bhoomi Goswami',
  'Jenil Sanghavi', 'Vidhi Shukla', 'Urvish Zala', 'Ruchi Modh', 'Chintan Lad',
  'Prachi Raval', 'Jaydeep Jadeja', 'Forum Shah', 'Ronak Gajjar', 'Dhruvi Kapadia'
];

const nowISO = () => new Date().toISOString();
const past = (hours: number) => new Date(Date.now() - hours * 3600000).toISOString();

function seedStore(): Store {
  const teachers: Teacher[] = [
    {
      id: 't1',
      name: 'Dr. Amit Ganatra',
      email: 'amit.ganatra@charusat.ac.in',
      department: 'Computer Science & Engineering',
      institute: 'CSPIT',
      classes: ['c1', 'c3']
    },
    {
      id: 't2',
      name: 'Prof. Trushit Upadhyaya',
      email: 'trushit.ce@charusat.ac.in',
      department: 'Computer Engineering',
      institute: 'CSPIT',
      classes: ['c1', 'c2']
    },
    {
      id: 't3',
      name: 'Dr. Parth Shah',
      email: 'parth.it@charusat.ac.in',
      department: 'Information Technology',
      institute: 'DEPSTAR',
      classes: ['c2', 'c3']
    },
    {
      id: 't4',
      name: 'Prof. Nilay Vaidya',
      email: 'nilay.ce@charusat.ac.in',
      department: 'Computer Engineering',
      institute: 'CSPIT',
      classes: ['c1']
    },
    {
      id: 't5',
      name: 'Prof. Ritesh Patel',
      email: 'ritesh.mca@charusat.ac.in',
      department: 'Computer Applications',
      institute: 'CMPICA',
      classes: ['c4']
    }
  ];

  const classes: ClassRoom[] = [
    {
      id: 'c1',
      name: 'B.Tech CSE - 4th Sem',
      section: 'Div A',
      semester: 'Semester 4',
      room: 'CSPIT Room 204 (Aryabhatta)',
      teacherId: 't1',
      studentIds: [],
      subjectIds: ['s1', 's2', 's3'],
      institute: 'CSPIT'
    },
    {
      id: 'c2',
      name: 'B.Tech IT - 6th Sem',
      section: 'Div B',
      semester: 'Semester 6',
      room: 'DEPSTAR Lab 302 (Kalam Complex)',
      teacherId: 't3',
      studentIds: [],
      subjectIds: ['s3', 's4'],
      institute: 'DEPSTAR'
    },
    {
      id: 'c3',
      name: 'B.Tech CE - 4th Sem',
      section: 'Div C',
      semester: 'Semester 4',
      room: 'CSPIT Lab 118 (Ramanujan)',
      teacherId: 't2',
      studentIds: [],
      subjectIds: ['s2', 's5', 's6'],
      institute: 'CSPIT'
    },
    {
      id: 'c4',
      name: 'MCA - 2nd Sem',
      section: 'Div 1',
      semester: 'Semester 2',
      room: 'CMPICA Hall 101 (Bhabha)',
      teacherId: 't5',
      studentIds: [],
      subjectIds: ['s1', 's3'],
      institute: 'CMPICA'
    }
  ];

  const subjects: Subject[] = [
    { id: 's1', name: 'Object Oriented Programming with Java', code: 'CE251', teacherId: 't2', classIds: ['c1', 'c4'], threshold: 75, credits: 4 },
    { id: 's2', name: 'Data Structures & Algorithms', code: 'CE252', teacherId: 't1', classIds: ['c1', 'c3'], threshold: 75, credits: 5 },
    { id: 's3', name: 'Database Management Systems', code: 'CE257', teacherId: 't4', classIds: ['c1', 'c2', 'c4'], threshold: 80, credits: 4 },
    { id: 's4', name: 'Computer Networks & Security', code: 'IT254', teacherId: 't3', classIds: ['c2'], threshold: 75, credits: 4 },
    { id: 's5', name: 'Machine Learning & Artificial Intelligence', code: 'CSE301', teacherId: 't1', classIds: ['c3'], threshold: 75, credits: 4 },
    { id: 's6', name: 'Discrete Mathematics & Graph Theory', code: 'MA144', teacherId: 't3', classIds: ['c3'], threshold: 75, credits: 4 }
  ];

  const students: Student[] = charusatStudentNames.map((name, i) => {
    const classId = ['c1', 'c2', 'c3', 'c4'][i % 4];
    const institute: 'CSPIT' | 'DEPSTAR' | 'CMPICA' = classId === 'c2' ? 'DEPSTAR' : classId === 'c4' ? 'CMPICA' : 'CSPIT';
    const prefix = institute === 'DEPSTAR' ? '23DIT' : institute === 'CMPICA' ? '23MCA' : '22DCSE';
    const studentId = `${prefix}${String(i + 1).padStart(3, '0')}`;
    const attendancePercent = [4, 9, 17, 24, 33, 41, 47].includes(i) ? 62 + (i % 12) : 79 + ((i * 7) % 19);

    return {
      id: `st${String(i + 1).padStart(3, '0')}`,
      name,
      email: `${studentId.toLowerCase()}@charusat.edu.in`,
      studentId,
      classId,
      attendancePercent,
      status: attendancePercent < 75 ? 'At risk' : 'Active',
      institute
    };
  });

  classes.forEach(c => {
    c.studentIds = students.filter(s => s.classId === c.id).map(s => s.id);
  });

  const sessions: Session[] = [
    {
      id: 'se1',
      classId: 'c1',
      teacherId: 't1',
      start: past(1.2),
      end: null,
      status: 'Live',
      code: '528 941',
      attendanceRecords: students.filter(s => s.classId === 'c1').slice(0, 11).map((s, i) => ({
        id: `r1-${i}`,
        sessionId: 'se1',
        studentId: s.id,
        status: i === 4 ? 'Late' : 'Present',
        time: past(0.35),
        verified: i !== 4,
        verificationMethod: i !== 4 ? 'Passkey (WebAuthn)' : 'Manual Override',
        riskScore: i === 4 ? 32 : 5
      }))
    },
    {
      id: 'se2',
      classId: 'c2',
      teacherId: 't3',
      start: past(4.5),
      end: past(3.5),
      status: 'Completed',
      code: '419 832',
      attendanceRecords: students.filter(s => s.classId === 'c2').slice(0, 12).map((s, i) => ({
        id: `r2-${i}`,
        sessionId: 'se2',
        studentId: s.id,
        status: i < 10 ? 'Present' : i === 10 ? 'Late' : 'Absent',
        time: past(4.1),
        verified: i < 11,
        verificationMethod: i < 10 ? 'QR + Rotating Code' : 'Manual Override',
        riskScore: i === 10 ? 24 : 8
      }))
    },
    {
      id: 'se3',
      classId: 'c3',
      teacherId: 't2',
      start: past(26),
      end: past(25),
      status: 'Completed',
      code: '830 194',
      attendanceRecords: students.filter(s => s.classId === 'c3').slice(0, 12).map((s, i) => ({
        id: `r3-${i}`,
        sessionId: 'se3',
        studentId: s.id,
        status: i < 11 ? 'Present' : 'Absent',
        time: past(25.7),
        verified: i < 11,
        verificationMethod: 'Passkey (WebAuthn)',
        riskScore: 6
      }))
    },
    {
      id: 'se4',
      classId: 'c1',
      teacherId: 't1',
      start: past(50),
      end: past(49),
      status: 'Completed',
      code: '674 205',
      attendanceRecords: students.filter(s => s.classId === 'c1').slice(0, 12).map((s, i) => ({
        id: `r4-${i}`,
        sessionId: 'se4',
        studentId: s.id,
        status: i < 10 ? 'Present' : 'Absent',
        time: past(49.6),
        verified: i < 10,
        verificationMethod: 'QR + Rotating Code',
        riskScore: 9
      }))
    },
    {
      id: 'se5',
      classId: 'c4',
      teacherId: 't5',
      start: past(74),
      end: past(73),
      status: 'Completed',
      code: '315 908',
      attendanceRecords: students.filter(s => s.classId === 'c4').slice(0, 11).map((s, i) => ({
        id: `r5-${i}`,
        sessionId: 'se5',
        studentId: s.id,
        status: i < 9 ? 'Present' : 'Absent',
        time: past(73.7),
        verified: i < 9,
        verificationMethod: 'Passkey (WebAuthn)',
        riskScore: 7
      }))
    }
  ];

  return {
    students,
    teachers,
    classes,
    subjects,
    sessions,
    securityEvents: [
      {
        id: 'sec1',
        studentId: 'st005',
        event: 'Unrecognized biometric hardware token',
        severity: 'High',
        riskScore: 89,
        time: past(0.8),
        status: 'Needs review',
        reason: 'WebAuthn authenticator public key differs from enrolled student smartphone on record.',
        deviceFingerprint: 'Safari 17.5 / iPhone 14 (Expected: Chrome / OnePlus Nord)',
        ipLocation: 'Changa Cellular Tower (Outside CHARUSAT Wi-Fi Subnet)'
      },
      {
        id: 'sec2',
        studentId: 'st017',
        event: 'Repeated 15s code failure rate',
        severity: 'Medium',
        riskScore: 68,
        time: past(3.2),
        status: 'Needs review',
        reason: 'Five invalid rotating challenge codes submitted within 60 seconds.',
        deviceFingerprint: 'Chrome 125 / Windows 11',
        ipLocation: 'CHARUSAT Central Library Wi-Fi (AP-LIB-02)'
      },
      {
        id: 'sec3',
        studentId: 'st024',
        event: 'Geofence perimeter deviation',
        severity: 'Medium',
        riskScore: 54,
        time: past(24),
        status: 'Reviewed',
        reason: 'Passkey verification attempt initiated 4.1 km outside Changa Campus perimeter.',
        deviceFingerprint: 'Edge 124 / Android 14',
        ipLocation: 'ISP Anand Broadband / IP 103.21.58.12'
      },
      {
        id: 'sec4',
        studentId: 'st010',
        event: 'Replay token reuse blocked',
        severity: 'High',
        riskScore: 94,
        time: past(0.2),
        status: 'Needs review',
        reason: 'QR cryptographic epoch expired (>15 seconds elapsed). Cryptographic nonce was already redeemed by another student.',
        deviceFingerprint: 'Chrome 124 / macOS Sonoma (Proxy attempt suspected)',
        ipLocation: 'CSPIT Hostel Block B Wi-Fi (AP-HST-14)'
      }
    ],
    notifications: [
      {
        id: 'n1',
        title: 'CHARUSAT 75% attendance threshold warning',
        category: 'Early warning',
        time: past(1),
        read: false,
        body: 'Four students in B.Tech CSE 4th Sem (Div A) have moved below the university required 75% minimum.'
      },
      {
        id: 'n2',
        title: 'Anti-proxy hardware token flagged',
        category: 'Security',
        time: past(1.5),
        read: false,
        body: 'Unrecognized biometric hardware token detected for student 22DCSE005 in Room 204.'
      },
      {
        id: 'n3',
        title: 'Weekly academic attendance digest generated',
        category: 'Reports',
        time: past(9),
        read: true,
        body: 'Weekly attendance report for CSPIT and DEPSTAR is available to export for department deans.'
      },
      {
        id: 'n4',
        title: 'CHARUSAT Anti-Proxy engine active',
        category: 'Security',
        time: past(0.1),
        read: false,
        body: '15-second rotating QR codes, Wi-Fi BSSID enforcement, and FIDO2 passkeys active for ongoing lectures.'
      }
    ],
    auditEvents: [
      {
        id: 'a1',
        actor: 'Dr. Amit Ganatra',
        action: 'Initiated live lecture attendance for B.Tech CSE 4th Sem (Room 204) with 15s rotating QR',
        time: past(1.2),
        severity: 'Info'
      },
      {
        id: 'a2',
        actor: 'CHARUSAT Anti-Proxy Guard',
        action: 'Blocked expired QR replay token reuse for student 22DCSE010 (Risk Score: 94/100)',
        time: past(0.2),
        severity: 'Critical'
      },
      {
        id: 'a3',
        actor: 'Prof. Trushit Upadhyaya',
        action: 'Completed CE252 Data Structures attendance verification session (11 verified)',
        time: past(25),
        severity: 'Info'
      },
      {
        id: 'a4',
        actor: 'Dr. Parth Shah',
        action: 'Reviewed and dismissed geofence deviation event for student 22DCSE024',
        time: past(22),
        severity: 'Info'
      },
      {
        id: 'a5',
        actor: 'System Engine',
        action: 'Generated CHARUSAT University weekly attendance compliance report',
        time: past(32),
        severity: 'Info'
      }
    ],
    currentUser: {
      id: 'u1',
      name: 'Dr. Amit Ganatra',
      email: 'amit.ganatra@charusat.ac.in',
      role: 'Administrator',
      avatar: 'AG',
      department: 'Dean & Principal, CSPIT'
    },
    settings: {
      campus: 'Charotar University of Science and Technology (CHARUSAT)',
      attendanceThreshold: 75,
      sessionLength: 60,
      compact: false,
      notifications: true,
      bssidLock: true,
      geofenceRadiusMeters: 45
    }
  };
}

const STORE_KEY = 'charusat-attendance-platform-v1';
let memory: Store | null = null;
const listeners = new Set<() => void>();
function notify() { listeners.forEach(fn => fn()); }

function read(): Store {
  if (memory) return memory;
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      memory = JSON.parse(raw) as Store;
      return memory;
    }
  } catch { /* fall through */ }
  memory = seedStore();
  try { localStorage.setItem(STORE_KEY, JSON.stringify(memory)); } catch { /* ignore */ }
  return memory;
}

function write(next: Store) {
  memory = next;
  try { localStorage.setItem(STORE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  notify();
}

export const dataService = {
  get: read,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  update(mutator: (store: Store) => Store) {
    write(mutator(read()));
  },
  reset() {
    memory = seedStore();
    try { localStorage.removeItem(STORE_KEY); } catch { /* ignore */ }
    write(memory);
  },
  switchRole(role: Role) {
    const email =
      role === 'Teacher'
        ? 'trushit.ce@charusat.ac.in'
        : role === 'Student'
        ? '22dcse001@charusat.edu.in'
        : 'amit.ganatra@charusat.ac.in';

    this.update(s => {
      const user =
        role === 'Teacher'
          ? {
              id: 't2',
              name: 'Prof. Trushit Upadhyaya',
              email,
              role,
              avatar: 'TU',
              department: 'Computer Engineering, CSPIT'
            }
          : role === 'Student'
          ? {
              id: 'st001',
              name: 'Aarav Patel',
              email,
              role,
              avatar: 'AP',
              department: 'B.Tech CSE - 4th Sem (CSPIT)'
            }
          : {
              id: 'u1',
              name: 'Dr. Amit Ganatra',
              email,
              role,
              avatar: 'AG',
              department: 'Dean & Principal, CSPIT'
            };
      return { ...s, currentUser: user };
    });

    // Authenticate with real backend in the background and sync data
    api.loginWithBackend(email, 'charusat123')
      .then(res => {
        if (res.success) {
          return api.fetchStoreData(role);
        }
        return null;
      })
      .then(realData => {
        if (realData && Object.keys(realData).length > 0) {
          this.update(s => ({
            ...s,
            ...realData,
          }));
        }
      })
      .catch(err => {
        console.warn('Backend sync on role switch:', err);
      });
  },
  async syncWithBackend() {
    const current = read();
    try {
      const email = current.currentUser.email || 'amit.ganatra@charusat.ac.in';
      const loginRes = await api.loginWithBackend(email, 'charusat123');
      if (loginRes.success) {
        const realData = await api.fetchStoreData(current.currentUser.role);
        if (realData && Object.keys(realData).length > 0) {
          this.update(s => ({
            ...s,
            ...realData,
          }));
        }
      }
    } catch (e) {
      console.warn('syncWithBackend note:', e);
    }
  },
  updateCurrentUser(updates: Partial<User>) {
    this.update(s => ({
      ...s,
      currentUser: {
        ...s.currentUser,
        ...updates,
        avatar: updates.name ? updates.name.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase() : s.currentUser.avatar
      }
    }));
  },
  addSession(classId: string, teacherId: string) {
    const s = read();
    const tempId = `se${Date.now()}`;
    const session: Session = {
      id: tempId,
      classId,
      teacherId,
      start: nowISO(),
      end: null,
      status: 'Live',
      code: String(Math.floor(100000 + Math.random() * 900000)).replace(/(\d{3})(\d{3})/, '$1 $2'),
      attendanceRecords: []
    };
    const room = s.classes.find(c => c.id === classId);
    this.update(state => ({
      ...state,
      sessions: [session, ...state.sessions],
      auditEvents: [
        {
          id: `a${Date.now()}`,
          actor: state.currentUser.name,
          action: `Started live attendance lecture for ${room?.name ?? 'cohort'} (${room?.room}) with 15s rotating dynamic QR`,
          time: nowISO(),
          severity: 'Info'
        },
        ...state.auditEvents
      ]
    }));

    // Trigger real backend session creation
    api.apiCreateSession(classId).then(res => {
      if (res.success && res.data?.id) {
        const realId = res.data.id;
        const realCode = res.data.code;
        this.update(st => ({
          ...st,
          sessions: st.sessions.map(sess =>
            sess.id === tempId ? { ...sess, id: realId, code: realCode || sess.code } : sess
          )
        }));
      }
    }).catch(err => console.warn('Backend addSession note:', err));

    return session.id;
  },
  mark(sessionId: string, studentId: string, status: AttendanceStatus) {
    this.update(state => {
      const sessions = state.sessions.map(session => {
        if (session.id !== sessionId) return session;
        const existing = session.attendanceRecords.find(r => r.studentId === studentId);
        const record: AttendanceRecord = {
          id: existing?.id ?? `r${Date.now()}`,
          sessionId,
          studentId,
          status,
          time: nowISO(),
          verified: status === 'Present',
          verificationMethod: existing?.verificationMethod ?? 'Manual Override',
          riskScore: existing?.riskScore ?? (status === 'Present' ? 5 : 20)
        };
        return {
          ...session,
          attendanceRecords: existing
            ? session.attendanceRecords.map(r => (r.studentId === studentId ? record : r))
            : [...session.attendanceRecords, record]
        };
      });
      const student = state.students.find(s => s.id === studentId);
      const auditEvents = [
        {
          id: `a${Date.now()}`,
          actor: state.currentUser.name,
          action: `Manual correction: marked ${student?.name ?? 'student'} (${student?.studentId}) as ${status.toLowerCase()}`,
          time: nowISO(),
          severity: 'Info' as const
        },
        ...state.auditEvents
      ];
      return { ...state, sessions, auditEvents };
    });

    // Trigger real backend attendance marking
    api.apiMarkAttendanceManual(sessionId, studentId, status).catch(err =>
      console.warn('Backend mark note:', err)
    );
  },
  confirmStudentPresence(
    sessionId: string,
    studentId: string,
    method: 'QR + Rotating Code' | 'Passkey (WebAuthn)' = 'Passkey (WebAuthn)'
  ) {
    this.update(state => {
      const sessions = state.sessions.map(session => {
        if (session.id !== sessionId) return session;
        const existing = session.attendanceRecords.find(r => r.studentId === studentId);
        const record: AttendanceRecord = {
          id: existing?.id ?? `r${Date.now()}`,
          sessionId,
          studentId,
          status: 'Present',
          time: nowISO(),
          verified: true,
          verificationMethod: method,
          riskScore: method === 'Passkey (WebAuthn)' ? 4 : 8
        };
        return {
          ...session,
          attendanceRecords: existing
            ? session.attendanceRecords.map(r => (r.studentId === studentId ? record : r))
            : [...session.attendanceRecords, record]
        };
      });

      const student = state.students.find(s => s.id === studentId);
      const updatedPercent = student ? Math.min(100, student.attendancePercent + 3) : 85;
      const students = state.students.map(s =>
        s.id === studentId
          ? {
              ...s,
              attendancePercent: updatedPercent,
              status: updatedPercent < state.settings.attendanceThreshold ? ('At risk' as const) : ('Active' as const)
            }
          : s
      );

      const auditEvents = [
        {
          id: `a${Date.now()}`,
          actor: student?.name ?? 'Student',
          action: `Verified in-person presence via ${method} (CHARUSAT Geofence & Hardware token validated, Risk: 4/100)`,
          time: nowISO(),
          severity: 'Info' as const
        },
        ...state.auditEvents
      ];

      return { ...state, sessions, students, auditEvents };
    });

    // Trigger real backend mark
    api.apiMarkAttendanceManual(sessionId, studentId, 'Present').catch(err =>
      console.warn('Backend confirmStudentPresence note:', err)
    );
  },
  triggerSpotCheck(sessionId: string) {
    this.update(state => {
      const sessions = state.sessions.map(session => {
        if (session.id !== sessionId) return session;
        return {
          ...session,
          activeSpotCheck: {
            startedAt: nowISO(),
            durationSeconds: 60,
            prompt: 'CHARUSAT Mid-Lecture In-Person Re-check',
            completedStudentIds: []
          }
        };
      });
      const session = state.sessions.find(s => s.id === sessionId);
      const room = state.classes.find(c => c.id === session?.classId);
      const auditEvents = [
        {
          id: `a${Date.now()}`,
          actor: state.currentUser.name,
          action: `Triggered random mid-class spot check (60s countdown) for ${room?.name ?? 'cohort'} (${room?.room})`,
          time: nowISO(),
          severity: 'Warning' as const
        },
        ...state.auditEvents
      ];
      const notifications = [
        {
          id: `n${Date.now()}`,
          title: 'CHARUSAT Mid-lecture spot check active',
          category: 'Security',
          time: nowISO(),
          read: false,
          body: `A 60-second in-person presence re-check was initiated for ${room?.name ?? 'the lecture'}.`
        },
        ...state.notifications
      ];
      return { ...state, sessions, auditEvents, notifications };
    });

    // Trigger real backend spot re-check
    api.apiTriggerSpotRecheck(sessionId).catch(err =>
      console.warn('Backend spot check trigger note:', err)
    );
  },
  submitSpotCheck(sessionId: string, studentId: string) {
    this.update(state => {
      const sessions = state.sessions.map(session => {
        if (session.id !== sessionId || !session.activeSpotCheck) return session;
        const completedStudentIds = Array.from(new Set([...session.activeSpotCheck.completedStudentIds, studentId]));
        const updatedRecords = session.attendanceRecords.map(r =>
          r.studentId === studentId
            ? {
                ...r,
                verificationMethod: 'Spot Check Verified' as const
              }
            : r
        );
        return {
          ...session,
          activeSpotCheck: { ...session.activeSpotCheck, completedStudentIds },
          attendanceRecords: updatedRecords
        };
      });
      const student = state.students.find(s => s.id === studentId);
      const auditEvents = [
        {
          id: `a${Date.now()}`,
          actor: student?.name ?? 'Student',
          action: `Completed CHARUSAT mid-class spot check (In-person presence validated in Room)`,
          time: nowISO(),
          severity: 'Info' as const
        },
        ...state.auditEvents
      ];
      return { ...state, sessions, auditEvents };
    });

    api.apiCompleteRecheck(sessionId).catch(err =>
      console.warn('Backend complete recheck note:', err)
    );
  },
  finishSession(sessionId: string, status: 'Completed' | 'Paused' | 'Live') {
    this.update(s => ({
      ...s,
      sessions: s.sessions.map(x =>
        x.id === sessionId
          ? {
              ...x,
              status,
              end: status === 'Completed' ? nowISO() : null,
              activeSpotCheck: status === 'Completed' ? null : x.activeSpotCheck
            }
          : x
      ),
      auditEvents:
        status === 'Completed'
          ? [
              {
                id: `a${Date.now()}`,
                actor: s.currentUser.name,
                action: `Concluded attendance window and committed records for lecture session ${sessionId}`,
                time: nowISO(),
                severity: 'Info' as const
              },
              ...s.auditEvents
            ]
          : s.auditEvents
    }));

    if (status === 'Completed') {
      api.apiEndSession(sessionId).catch(err =>
        console.warn('Backend finishSession note:', err)
      );
    }
  },
  updateAttendanceThreshold(studentId: string, percent: number) {
    this.update(s => ({
      ...s,
      students: s.students.map(st =>
        st.id === studentId
          ? {
              ...st,
              attendancePercent: percent,
              status: percent < s.settings.attendanceThreshold ? 'At risk' : 'Active'
            }
          : st
      )
    }));
  },
  upsert<K extends 'students' | 'teachers' | 'classes' | 'subjects'>(collection: K, item: Store[K][number]) {
    this.update(s => ({
      ...s,
      [collection]: [item as never, ...(s[collection] as Array<{ id: string }>).filter(row => row.id !== item.id)]
    }));

    // Dispatch to real backend
    try {
      if (collection === 'classes') {
        const c = item as any;
        api.apiCreateClass({ name: c.name, section: c.section, semester: c.semester, room: c.room, institute: c.institute }).catch(err => console.warn('apiCreateClass note:', err));
      } else if (collection === 'subjects') {
        const sub = item as any;
        api.apiCreateSubject({ name: sub.name, code: sub.code, threshold: sub.threshold, credits: sub.credits }).catch(err => console.warn('apiCreateSubject note:', err));
      } else if (collection === 'students') {
        const st = item as any;
        api.apiCreateStudent({ name: st.name, email: st.email, studentId: st.studentId, classId: st.classId, institute: st.institute }).catch(err => console.warn('apiCreateStudent note:', err));
      } else if (collection === 'teachers') {
        const t = item as any;
        api.apiCreateTeacher({ name: t.name, email: t.email, department: t.department, institute: t.institute }).catch(err => console.warn('apiCreateTeacher note:', err));
      }
    } catch (e) {
      console.warn('upsert backend call error:', e);
    }
  },
  remove(collection: 'students' | 'teachers' | 'classes' | 'subjects', id: string) {
    this.update(s => {
      const next = { ...s, [collection]: (s[collection] as Array<{ id: string }>).filter(item => item.id !== id) } as Store;
      if (collection === 'students') {
        next.classes = s.classes.map(room => ({ ...room, studentIds: room.studentIds.filter(studentId => studentId !== id) }));
        next.sessions = s.sessions.map(session => ({
          ...session,
          attendanceRecords: session.attendanceRecords.filter(record => record.studentId !== id)
        }));
      }
      if (collection === 'classes') {
        next.students = s.students.map(student => (student.classId === id ? { ...student, classId: '' } : student));
        next.subjects = s.subjects.map(subject => ({ ...subject, classIds: subject.classIds.filter(classId => classId !== id) }));
      }
      if (collection === 'subjects') {
        next.classes = s.classes.map(room => ({ ...room, subjectIds: room.subjectIds.filter(subjectId => subjectId !== id) }));
      }
      if (collection === 'teachers') {
        next.classes = s.classes.map(room => (room.teacherId === id ? { ...room, teacherId: '' } : room));
        next.subjects = s.subjects.map(subject => (subject.teacherId === id ? { ...subject, teacherId: '' } : subject));
      }
      return next;
    });

    api.apiDeleteEntity(collection, id).catch(err => console.warn('apiDeleteEntity note:', err));
  },
  reviewSecurity(id: string, resolution: 'Reviewed' | 'Dismissed' | 'Marked as Proxy' = 'Reviewed', reasonNote?: string) {
    this.update(s => {
      const event = s.securityEvents.find(e => e.id === id);
      const student = s.students.find(st => st.id === event?.studentId);
      const status: 'Reviewed' | 'Dismissed' = resolution === 'Dismissed' ? 'Dismissed' : 'Reviewed';
      const securityEvents = s.securityEvents.map(e => (e.id === id ? { ...e, status } : e));
      const auditEvents = [
        {
          id: `a${Date.now()}`,
          actor: s.currentUser.name,
          action: `CHARUSAT Security review for ${student?.name ?? 'student'} (${student?.studentId}): ${resolution} ${
            reasonNote ? `(${reasonNote})` : ''
          }`,
          time: nowISO(),
          severity: resolution === 'Marked as Proxy' ? ('Critical' as const) : ('Info' as const)
        },
        ...s.auditEvents
      ];
      return { ...s, securityEvents, auditEvents };
    });

    api.apiReviewSecurityEvent(id, resolution === 'Dismissed' ? 'Dismissed' : 'Reviewed', reasonNote).catch(err =>
      console.warn('Backend reviewSecurity note:', err)
    );
  },
  markNotificationRead(id: string) {
    this.update(s => ({
      ...s,
      notifications: s.notifications.map(n => (n.id === id ? { ...n, read: true } : n))
    }));
    api.apiMarkNotificationRead(id).catch(err => console.warn('apiMarkNotificationRead note:', err));
  },
  markAllNotificationsRead() {
    this.update(s => ({
      ...s,
      notifications: s.notifications.map(n => ({ ...n, read: true }))
    }));
    api.apiMarkAllNotificationsRead().catch(err => console.warn('apiMarkAllNotificationsRead note:', err));
  },
  setSettings(settings: Store['settings']) {
    this.update(s => ({ ...s, settings }));
    api.apiUpdateSettings({
      campus: settings.campus,
      attendanceThreshold: String(settings.attendanceThreshold),
      sessionLength: String(settings.sessionLength),
      bssidLock: String(settings.bssidLock),
      geofenceRadiusMeters: String(settings.geofenceRadiusMeters),
    }).catch(err => console.warn('apiUpdateSettings note:', err));
  }
};