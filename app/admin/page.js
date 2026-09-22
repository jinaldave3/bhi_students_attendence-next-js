"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useToast } from "@/components/Toast";

const POLL_MS = 20000;

export default function AdminOverviewPage() {
  const showToast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/overview", { cache: "no-store" });
      if (!res.ok) throw new Error("bad response");
      setData(await res.json());
    } catch (e) {
      console.error(e);
      showToast("Couldn't refresh the overview", true);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  if (loading) return <div className="app"><p className="hint">Loading…</p></div>;
  if (!data) return <div className="app"><p className="hint">Couldn't load the overview.</p></div>;

  return (
    <div className="app">
      <div className="hero">
        <h1>Overview</h1>
        <p>Attendance across every course, refreshing automatically.</p>
      </div>

      <div className="stat-row">
        <div className="stat-card"><div className="num">{data.totals.courses}</div><div className="lbl">Courses</div></div>
        <div className="stat-card"><div className="num">{data.totals.students}</div><div className="lbl">Students</div></div>
        <div className="stat-card"><div className="num">{data.totals.teachers}</div><div className="lbl">Teachers</div></div>
        <div className={`stat-card ${data.totals.pendingToday > 0 ? "flag" : ""}`}><div className="num">{data.totals.pendingToday}</div><div className="lbl">Pending today</div></div>
        <div className="stat-card"><div className="num">{data.totals.complete}</div><div className="lbl">Fully signed off</div></div>
      </div>

      <div className="view-header"><h2 style={{ fontFamily: "var(--font-display)", fontSize: 17, margin: 0 }}>By course</h2><Link href="/admin/courses" className="btn btn-primary">Manage courses</Link></div>

      <div className="dash-table-wrap">
        <table className="dash">
          <thead><tr><th>Course</th><th>Students</th><th>Teachers</th><th>Pending today</th><th>Fully signed off</th></tr></thead>
          <tbody>
            {data.courses.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--ink-faint)", padding: 24 }}>No courses yet.</td></tr>
            ) : data.courses.map((c) => (
              <tr key={c.id}>
                <td><Link href={`/admin/courses/${c.id}`} className="link-btn"><strong>{c.name}</strong></Link>{c.code && <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>{c.code}</div>}</td>
                <td>{c.studentCount}</td>
                <td>{c.teacherCount}</td>
                <td>{c.pendingToday > 0 ? <span className="badge badge-flag">{c.pendingToday}</span> : <span className="badge badge-ok">0</span>}</td>
                <td>{c.complete}/{c.studentCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
