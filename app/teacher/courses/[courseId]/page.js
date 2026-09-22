"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useToast } from "@/components/Toast";

const POLL_MS = 20000;

export default function TeacherCourseStudentsPage({ params }) {
  const { courseId } = params;
  const showToast = useToast();
  const [course, setCourse] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async () => {
    try {
      const [courseRes, studentsRes] = await Promise.all([
        fetch(`/api/courses/${courseId}`, { cache: "no-store" }),
        fetch(`/api/courses/${courseId}/students`, { cache: "no-store" }),
      ]);
      if (courseRes.status === 403 || studentsRes.status === 403) { setForbidden(true); return; }
      if (!courseRes.ok || !studentsRes.ok) throw new Error("bad response");
      setCourse(await courseRes.json());
      setStudents(await studentsRes.json());
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

  if (loading) return <div className="app"><p className="hint">Loading…</p></div>;
  if (forbidden) {
    return (
      <div className="app">
        <div className="empty-state"><p>You don&apos;t have access to this course.</p><Link href="/teacher" className="btn btn-primary">Back to my courses</Link></div>
      </div>
    );
  }

  const pendingToday = students.filter((s) => s.todayStatus === "pending").length;

  return (
    <div className="app">
      <div className="view-header">
        <Link href="/teacher" className="back-link">&larr; My courses</Link>
      </div>
      <div className="hero">
        <h1>{course?.name}</h1>
        <p>{course?.code ? `${course.code} · ` : ""}{students.length} student{students.length === 1 ? "" : "s"}</p>
      </div>

      <div className="stat-row">
        <div className="stat-card"><div className="num">{students.length}</div><div className="lbl">Students</div></div>
        <div className={`stat-card ${pendingToday > 0 ? "flag" : ""}`}><div className="num">{pendingToday}</div><div className="lbl">Pending today</div></div>
      </div>

      <div className="dash-table-wrap">
        <table className="dash">
          <thead><tr><th>Student</th><th>Days completed</th><th>Today</th><th>Sign-off</th><th></th></tr></thead>
          <tbody>
            {students.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--ink-faint)", padding: 24 }}>No students enrolled yet.</td></tr>
            ) : students.map((s) => {
              const pct = s.daysTotal ? Math.round((s.daysFilled / s.daysTotal) * 100) : 0;
              return (
                <tr key={s.id}>
                  <td><strong>{s.name}</strong></td>
                  <td><span className="progress-bar"><span style={{ width: `${pct}%` }} /></span>{s.daysFilled}/{s.daysTotal}</td>
                  <td>
                    {s.todayStatus === "pending" ? <span className="badge badge-flag">Pending</span>
                      : s.todayStatus === "done" ? <span className="badge badge-ok">Signed in</span>
                      : <span className="badge">—</span>}
                  </td>
                  <td>{s.signed ? <span className="badge badge-complete">Signed off</span> : <span className="badge badge-progress">Awaiting review</span>}</td>
                  <td style={{ textAlign: "right" }}>
                    <Link href={`/teacher/students/${s.id}`} className="link-btn">Open</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
