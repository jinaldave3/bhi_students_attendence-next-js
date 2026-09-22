"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useToast } from "@/components/Toast";

export default function AdminCoursesPage() {
  const showToast = useToast();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", code: "", duration: "" });
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/courses", { cache: "no-store" });
      if (!res.ok) throw new Error("bad response");
      setCourses(await res.json());
    } catch (e) {
      console.error(e);
      showToast("Couldn't load courses", true);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.name.trim()) { showToast("Course name is required", true); return; }
    setCreating(true);
    try {
      const res = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "create failed");
      setForm({ name: "", code: "", duration: "" });
      showToast("Course created");
      load();
    } catch (e) {
      showToast(e.message === "create failed" ? "Couldn't create course" : e.message, true);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="app">
      <div className="hero">
        <h1>Courses</h1>
        <p>Create courses, then open one to assign a teacher and enroll students.</p>
      </div>

      <div className="card">
        <h2>New course</h2>
        <form onSubmit={handleCreate}>
          <div className="field-grid">
            <div className="field required"><label>Name</label><input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Culinary Arts I" /></div>
            <div className="field"><label>Code</label><input type="text" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder="e.g. CUL-101" /></div>
            <div className="field"><label>Duration</label><input type="text" value={form.duration} onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))} placeholder="e.g. 12 weeks" /></div>
          </div>
          <div className="form-actions"><button type="submit" className="btn btn-primary" disabled={creating}>{creating ? "Creating…" : "Create course"}</button></div>
        </form>
      </div>

      {loading ? (
        <p className="hint">Loading…</p>
      ) : courses.length === 0 ? (
        <div className="empty-state"><p>No courses yet — create the first one above.</p></div>
      ) : (
        <div className="card-grid">
          {courses.map((c) => (
            <Link key={c.id} href={`/admin/courses/${c.id}`} className="tile">
              <div className="name">{c.name}</div>
              <div className="course">{c.code || "No code"}{c.duration ? ` · ${c.duration}` : ""}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
