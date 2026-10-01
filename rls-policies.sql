-- RLS Policies for Supabase PostgreSQL

-- Enable RLS on core tables
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE passkeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_assignments ENABLE ROW LEVEL SECURITY;

-- 1. Students: Can read only their own profile
CREATE POLICY student_select_own_profile ON students
  FOR SELECT
  USING (user_id = auth.uid());

-- Admin/Teacher can view students they manage (simplified for admin/teacher access)
CREATE POLICY non_student_select_students ON students
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('ADMIN', 'TEACHER')
    )
  );

-- 2. Attendance: Student can read only their own attendance
CREATE POLICY student_select_own_attendance ON attendance
  FOR SELECT
  USING (
    student_id IN (
      SELECT id FROM students WHERE user_id = auth.uid()
    )
  );

-- Teacher can access attendance for their sessions
CREATE POLICY teacher_select_attendance ON attendance
  FOR SELECT
  USING (
    session_id IN (
      SELECT id FROM class_sessions WHERE teacher_id IN (
        SELECT id FROM teachers WHERE user_id = auth.uid()
      )
    )
  );

-- 3. Enrollments: Student can read only their own enrollments
CREATE POLICY student_select_own_enrollments ON enrollments
  FOR SELECT
  USING (
    student_id IN (
      SELECT id FROM students WHERE user_id = auth.uid()
    )
  );

-- 4. Risk Events/Warnings: Student can read only their own warnings
CREATE POLICY student_select_own_risk_events ON risk_events
  FOR SELECT
  USING (user_id = auth.uid());

-- 5. Notifications: Student can read only their own notifications
CREATE POLICY student_select_own_notifications ON notifications
  FOR SELECT
  USING (user_id = auth.uid());

-- 6. Passkeys: User can read/manage own passkeys
CREATE POLICY user_manage_own_passkeys ON passkeys
  FOR ALL
  USING (user_id = auth.uid());

-- 7. Teachers: Can read assigned classes
CREATE POLICY teacher_select_own_assignments ON teacher_assignments
  FOR SELECT
  USING (
    teacher_id IN (
      SELECT id FROM teachers WHERE user_id = auth.uid()
    )
  );

-- Teachers can manage their own class sessions
CREATE POLICY teacher_manage_own_sessions ON class_sessions
  FOR ALL
  USING (
    teacher_id IN (
      SELECT id FROM teachers WHERE user_id = auth.uid()
    )
  );

-- General Admin blanket access
CREATE POLICY admin_all_access_students ON students FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'ADMIN'));
CREATE POLICY admin_all_access_attendance ON attendance FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'ADMIN'));
CREATE POLICY admin_all_access_enrollments ON enrollments FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'ADMIN'));
CREATE POLICY admin_all_access_risk ON risk_events FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'ADMIN'));
CREATE POLICY admin_all_access_notifications ON notifications FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'ADMIN'));
CREATE POLICY admin_all_access_passkeys ON passkeys FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'ADMIN'));
CREATE POLICY admin_all_access_sessions ON class_sessions FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'ADMIN'));
CREATE POLICY admin_all_access_assignments ON teacher_assignments FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'ADMIN'));
