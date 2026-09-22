"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useToast } from "@/components/Toast";

const POLL_MS = 20000;

export default function AdminCourseDetailPage({ params }) {
  const { courseId } = params;
  const showToast = useToast();
  const [course, setCourse] = useState(null);
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [studentForm, setStudentForm] = useState({ name: "", username: "", password: "", caseManager: "", instructor: "", startDate: "", endDate: "" });
  const [creatingStudent, setCreatingStudent] = useState(false);
  const [savingTeachers, setSavingTeachers] = useState(false);

  const load = useCallback(async () => {
    try {
      const [courseRes, studentsRes, teachersRes] = await Promise.all([
        fetch(`/api/courses/${courseId}`, { cache: "no-store" }),
        fetch(`/api/courses/${courseId}/students`, { cache: "no-store" }),
        fetch("/api/users?role=teacher", { cache: "no-store" }),
      ]);
      if (!courseRes.ok || !studentsRes.ok || !teachersRes.ok) throw new Error("bad response");
      setCourse(await courseRes.json());
      setStudents(await studentsRes.json());
      setTeachers(await teachersRes.json());
    } catch (e) {
      console.error(e);
      showToast("Couldn't load this course", true);
    } finally {
      setLoading(false);
    }
  }, [courseId, showToast]);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  async function toggleTeacher(teacherId) {
    const current = course.teacherIds || [];
    const next = current.includes(teacherId) ? current.filter((id) => id !== teacherId) : [...current, teacherId];
    setSavingTeachers(true);
    try {
      const res = await fetch(`/api/courses/${courseId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherIds: next }),
      });
      if (!res.ok) throw new Error("save failed");
      setCourse(await res.json());
    } catch (e) {
      showToast("Couldn't update teachers", true);
    } finally {
      setSavingTeachers(false);
    }
  }

  async function handleCreateStudent(e) {
    e.preventDefault();
    if (!studentForm.name.trim() || !studentForm.username.trim() || !studentForm.password) {
      showToast("Name, username, and password are required", true);
      return;
    }
    if (studentForm.password.length < 8) {
      showToast("Password must be at least 8 characters", true);
      return;
    }
    setCreatingStudent(true);
    try {
      const res = await fetch(`/api/courses/${courseId}/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(studentForm),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "create failed");
      setStudentForm({ name: "", username: "", password: "", caseManager: "", instructor: "", startDate: "", endDate: "" });
      showToast("Student account created");
      load();
    } catch (e) {
      showToast(e.message === "create failed" ? "Couldn't create student" : e.message, true);
    } finally {
      setCreatingStudent(false);
    }
  }

  async function handleRemoveStudent(id, name) {
    if (!confirm(`Remove ${name}'s account and attendance record? This can't be undone.`)) return;
    try {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
      showToast("Student removed");
      load();
    } catch (e) {
      showToast("Couldn't remove student", true);
    }
  }

  if (loading) return <div className="app"><p className="hint">Loading…</p></div>;
  if (!course) return <div className="app"><p className="hint">Course not found.</p></div>;

  return (
    <div className="app">
      <div className="view-header"><Link href="/admin/courses" className="back-link">&larr; All courses</Link></div>
      <div className="hero">
        <h1>{course.name}</h1>
        <p>{course.code ? `${course.code} · ` : ""}{course.duration}</p>
      </div>

      <div className="card">
        <h2>Teachers</h2>
        {teachers.length === 0 ? (
          <p className="hint">No teacher accounts yet — create one from <Link href="/admin/users">Staff</Link>.</p>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {teachers.map((t) => {
              const active = (course.teacherIds || []).includes(t.id);
              return (
                <button
                  key={t.id}
                  className="btn btn-sm"
                  style={active ? { background: "var(--brand)", borderColor: "var(--brand)", color: "#FBFAF7" } : undefined}
                  disabled={savingTeachers}
                  onClick={() => toggleTeacher(t.id)}
                >
                  {t.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="card">
        <h2>Add a student</h2>
        <form onSubmit={handleCreateStudent}>
          <div className="field-grid">
            <div className="field required"><label>Full name</label><input type="text" value={studentForm.name} onChange={(e) => setStudentForm((f) => ({ ...f, name: e.target.value }))} /></div>
            <div className="field required"><label>Username</label><input type="text" value={studentForm.username} onChange={(e) => setStudentForm((f) => ({ ...f, username: e.target.value }))} placeholder="for logging in" /></div>
            <div className="field required"><label>Password</label><input type="text" value={studentForm.password} onChange={(e) => setStudentForm((f) => ({ ...f, password: e.target.value }))} placeholder="8+ characters — share this with them" /></div>
            <div className="field"><label>Case manager</label><input type="text" value={studentForm.caseManager} onChange={(e) => setStudentForm((f) => ({ ...f, caseManager: e.target.value }))} /></div>
            <div className="field"><label>Instructor</label><input type="text" value={studentForm.instructor} onChange={(e) => setStudentForm((f) => ({ ...f, instructor: e.target.value }))} /></div>
            <div className="field"><label>Start date</label><input type="date" value={studentForm.startDate} onChange={(e) => setStudentForm((f) => ({ ...f, startDate: e.target.value }))} /></div>
            <div className="field"><label>End date</label><input type="date" value={studentForm.endDate} onChange={(e) => setStudentForm((f) => ({ ...f, endDate: e.target.value }))} /></div>
          </div>
          <div className="form-actions"><button type="submit" className="btn btn-primary" disabled={creatingStudent}>{creatingStudent ? "Creating…" : "Create student account"}</button></div>
        </form>
      </div>

      <div className="card">
        <h2>Students ({students.length})</h2>
        {students.length === 0 ? (
          <p className="hint">No students enrolled yet.</p>
        ) : (
          <div className="dash-table-wrap">
            <table className="dash">
              <thead><tr><th>Name</th><th>Username</th><th>Progress</th><th>Today</th><th>Sign-off</th><th></th></tr></thead>
              <tbody>
                {students.map((s) => {
                  const pct = s.daysTotal ? Math.round((s.daysFilled / s.daysTotal) * 100) : 0;
                  return (
                    <tr key={s.id}>
                      <td><Link href={`/admin/students/${s.id}`} className="link-btn"><strong>{s.name}</strong></Link></td>
                      <td>{s.username}</td>
                      <td><span className="progress-bar"><span style={{ width: `${pct}%` }} /></span>{s.daysFilled}/{s.daysTotal}</td>
                      <td>{s.todayStatus === "pending" ? <span className="badge badge-flag">Pending</span> : s.todayStatus === "done" ? <span className="badge badge-ok">Done</span> : <span className="badge">—</span>}</td>
                      <td>{s.signed ? <span className="badge badge-complete">Signed</span> : <span className="badge badge-progress">Awaiting</span>}</td>
                      <td style={{ textAlign: "right" }}><button className="link-btn" style={{ color: "var(--danger)" }} onClick={() => handleRemoveStudent(s.id, s.name)}>Remove</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}