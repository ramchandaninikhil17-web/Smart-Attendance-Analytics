/**
 * Database seed — populates the database with the existing frontend's seed data.
 * Maps the frontend's data.ts structure to proper relational tables.
 * Run once to initialize.
 */
import { db } from "@workspace/db";
import {
  usersTable, studentsTable, teachersTable, classesTable, subjectsTable,
  enrollmentsTable, teacherAssignmentsTable, classSessionsTable, attendanceTable,
  riskEventsTable, notificationsTable, auditLogsTable, attendanceSettingsTable
} from "@workspace/db/schema";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";
import { logger } from "../lib/logger";
import { eq } from "drizzle-orm";

const SEED_PASSWORD = process.env.DEFAULT_SEED_PASSWORD || "charusat123";
const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS) || 12;

export async function seedDatabase() {
  // Check if already seeded
  const [existingUser] = await db.select({ id: usersTable.id }).from(usersTable).limit(1);
  if (existingUser) {
    logger.info("Database already seeded, skipping.");
    return;
  }

  logger.info("Seeding database...");
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, SALT_ROUNDS);

  // ===== ADMIN USER =====
  const adminUserId = uuidv4();
  await db.insert(usersTable).values({
    id: adminUserId,
    email: "amit.ganatra@charusat.ac.in",
    passwordHash,
    name: "Dr. Amit Ganatra",
    role: "ADMIN",
    department: "Dean & Principal, CSPIT",
    institute: "CSPIT",
    avatar: "AG",
    isActive: true,
  });

  // ===== TEACHERS =====
  const teacherData = [
    { name: "Dr. Amit Ganatra", email: "amit.ganatra.teacher@charusat.ac.in", dept: "Computer Science & Engineering", inst: "CSPIT", id: "t1" },
    { name: "Prof. Trushit Upadhyaya", email: "trushit.ce@charusat.ac.in", dept: "Computer Engineering", inst: "CSPIT", id: "t2" },
    { name: "Dr. Parth Shah", email: "parth.it@charusat.ac.in", dept: "Information Technology", inst: "DEPSTAR", id: "t3" },
    { name: "Prof. Nilay Vaidya", email: "nilay.ce@charusat.ac.in", dept: "Computer Engineering", inst: "CSPIT", id: "t4" },
    { name: "Prof. Ritesh Patel", email: "ritesh.mca@charusat.ac.in", dept: "Computer Applications", inst: "CMPICA", id: "t5" },
  ];

  const teacherMap: Record<string, { userId: string; teacherId: string }> = {};

  for (const t of teacherData) {
    const userId = uuidv4();
    const teacherId = uuidv4();
    const avatar = t.name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();

    await db.insert(usersTable).values({
      id: userId,
      email: t.email,
      passwordHash,
      name: t.name,
      role: "TEACHER",
      department: t.dept,
      institute: t.inst,
      avatar,
      isActive: true,
    });

    await db.insert(teachersTable).values({
      id: teacherId,
      userId,
      department: t.dept,
      institute: t.inst,
    });

    teacherMap[t.id] = { userId, teacherId };
  }

  // ===== CLASSES =====
  const classData = [
    { name: "B.Tech CSE - 4th Sem", section: "Div A", semester: "Semester 4", room: "CSPIT Room 204 (Aryabhatta)", inst: "CSPIT", id: "c1" },
    { name: "B.Tech IT - 6th Sem", section: "Div B", semester: "Semester 6", room: "DEPSTAR Lab 302 (Kalam Complex)", inst: "DEPSTAR", id: "c2" },
    { name: "B.Tech CE - 4th Sem", section: "Div C", semester: "Semester 4", room: "CSPIT Lab 118 (Ramanujan)", inst: "CSPIT", id: "c3" },
    { name: "MCA - 2nd Sem", section: "Div 1", semester: "Semester 2", room: "CMPICA Hall 101 (Bhabha)", inst: "CMPICA", id: "c4" },
  ];

  const classMap: Record<string, string> = {};

  for (const c of classData) {
    const classId = uuidv4();
    await db.insert(classesTable).values({
      id: classId,
      name: c.name,
      section: c.section,
      semester: c.semester,
      room: c.room,
      institute: c.inst,
    });
    classMap[c.id] = classId;
  }

  // ===== SUBJECTS =====
  const subjectData = [
    { name: "Object Oriented Programming with Java", code: "CE251", threshold: 75, credits: 4, teacherKey: "t2", classKeys: ["c1", "c4"], id: "s1" },
    { name: "Data Structures & Algorithms", code: "CE252", threshold: 75, credits: 5, teacherKey: "t1", classKeys: ["c1", "c3"], id: "s2" },
    { name: "Database Management Systems", code: "CE257", threshold: 80, credits: 4, teacherKey: "t4", classKeys: ["c1", "c2", "c4"], id: "s3" },
    { name: "Computer Networks & Security", code: "IT254", threshold: 75, credits: 4, teacherKey: "t3", classKeys: ["c2"], id: "s4" },
    { name: "Machine Learning & Artificial Intelligence", code: "CSE301", threshold: 75, credits: 4, teacherKey: "t1", classKeys: ["c3"], id: "s5" },
    { name: "Discrete Mathematics & Graph Theory", code: "MA144", threshold: 75, credits: 4, teacherKey: "t3", classKeys: ["c3"], id: "s6" },
  ];

  const subjectMap: Record<string, string> = {};

  for (const s of subjectData) {
    const subjectId = uuidv4();
    await db.insert(subjectsTable).values({
      id: subjectId,
      name: s.name,
      code: s.code,
      threshold: s.threshold,
      credits: s.credits,
    });
    subjectMap[s.id] = subjectId;

    // Create teacher assignments for each class this subject is in
    for (const ck of s.classKeys) {
      await db.insert(teacherAssignmentsTable).values({
        id: uuidv4(),
        teacherId: teacherMap[s.teacherKey].teacherId,
        classId: classMap[ck],
        subjectId,
        status: "active",
      });
    }
  }

  // Also create teacher-class assignments from frontend data (teacher→classes mapping)
  const teacherClassMap: Record<string, string[]> = {
    t1: ["c1", "c3"],
    t2: ["c1", "c2"],
    t3: ["c2", "c3"],
    t4: ["c1"],
    t5: ["c4"],
  };

  for (const [tKey, cKeys] of Object.entries(teacherClassMap)) {
    for (const ck of cKeys) {
      // Check if assignment already exists (from subject assignments)
      // We'll just add a class-level assignment without subject
      const existingSubjectAssignments = subjectData.filter(
        (s) => s.teacherKey === tKey && s.classKeys.includes(ck)
      );
      if (existingSubjectAssignments.length === 0) {
        await db.insert(teacherAssignmentsTable).values({
          id: uuidv4(),
          teacherId: teacherMap[tKey].teacherId,
          classId: classMap[ck],
          subjectId: null,
          status: "active",
        });
      }
    }
  }

  // ===== STUDENTS =====
  const studentNames = [
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

  const classKeys = ['c1', 'c2', 'c3', 'c4'];
  const studentMap: Record<string, string> = {}; // frontend key → db ID

  for (let i = 0; i < studentNames.length; i++) {
    const name = studentNames[i];
    const classKey = classKeys[i % 4];
    const classDbId = classMap[classKey];
    const inst = classKey === 'c2' ? 'DEPSTAR' : classKey === 'c4' ? 'CMPICA' : 'CSPIT';
    const prefix = inst === 'DEPSTAR' ? '23DIT' : inst === 'CMPICA' ? '23MCA' : '22DCSE';
    const rollNo = `${prefix}${String(i + 1).padStart(3, '0')}`;
    const attendancePercent = [4, 9, 17, 24, 33, 41, 47].includes(i)
      ? 62 + (i % 12)
      : 79 + ((i * 7) % 19);

    const userId = uuidv4();
    const studentId = uuidv4();
    const avatar = name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();

    await db.insert(usersTable).values({
      id: userId,
      email: `${rollNo.toLowerCase()}@charusat.edu.in`,
      passwordHash,
      name,
      role: "STUDENT",
      department: `B.Tech - ${inst}`,
      institute: inst,
      avatar,
      isActive: true,
    });

    await db.insert(studentsTable).values({
      id: studentId,
      userId,
      studentId: rollNo,
      classId: classDbId,
      attendancePercent,
      status: attendancePercent < 75 ? "At risk" : "Active",
    });

    // Create enrollment
    await db.insert(enrollmentsTable).values({
      id: uuidv4(),
      studentId,
      classId: classDbId,
      status: "active",
    });

    const frontendKey = `st${String(i + 1).padStart(3, '0')}`;
    studentMap[frontendKey] = studentId;
  }

  // ===== SETTINGS =====
  const settingsData = [
    { key: "campus", value: "Charotar University of Science and Technology (CHARUSAT)", description: "Campus name" },
    { key: "attendanceThreshold", value: "75", description: "Minimum attendance percentage" },
    { key: "sessionLength", value: "60", description: "Default session length in minutes" },
    { key: "bssidLock", value: "true", description: "Wi-Fi BSSID lock enabled" },
    { key: "geofenceRadiusMeters", value: "45", description: "Geofence radius in meters" },
  ];

  for (const s of settingsData) {
    await db.insert(attendanceSettingsTable).values({
      id: uuidv4(),
      key: s.key,
      value: s.value,
      description: s.description,
    });
  }

  // ===== AUDIT LOGS (initial) =====
  await db.insert(auditLogsTable).values({
    id: uuidv4(),
    actorId: adminUserId,
    actorRole: "ADMIN",
    actorName: "System",
    action: "Database seeded with initial CHARUSAT campus data",
    targetType: "system",
    severity: "Info",
    success: true,
  });

  logger.info("Database seeded successfully!");
  logger.info(`Admin login: amit.ganatra@charusat.ac.in / ${SEED_PASSWORD}`);
  logger.info(`Teacher login (example): trushit.ce@charusat.ac.in / ${SEED_PASSWORD}`);
  logger.info(`Student login (example): 22dcse001@charusat.edu.in / ${SEED_PASSWORD}`);
}
