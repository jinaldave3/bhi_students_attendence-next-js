"use client";

import { useEffect, useState, useCallback } from "react";
import { useToast } from "@/components/Toast";

export default function AdminUsersPage() {
  const showToast = useToast();
  const [teachers, setTeachers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", username: "", password: "", courseIds: [] });
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const [teachersRes, coursesRes] = await Promise.all([
        fetch("/api/users?role=teacher", { cache: "no-store" }),
        fetch("/api/courses", { cache: "no-store" }),
      ]);
      if (!teachersRes.ok || !coursesRes.ok) throw new Error("bad response");
      setTeachers(await teachersRes.json());
      setCourses(await coursesRes.json());
    } catch (e) {
      console.error(e);
      showToast("Couldn't load staff", true);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  function toggleCourse(id) {
    setForm((f) => ({
      ...f,
      courseIds: f.courseIds.includes(id) ? f.courseIds.filter((c) => c !== id) : [...f.courseIds, id],
    }));
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.username.trim() || !form.password) {
      showToast("Name, username, and password are required", true);
      return;
    }
    if (form.password.length < 8) {
      showToast("Password must be at least 8 characters", true);
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, role: "teacher" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "create failed");
      setForm({ name: "", username: "", password: "", courseIds: [] });
      showToast("Teacher account created");
      load();
    } catch (e) {
      showToast(e.message === "create failed" ? "Couldn't create account" : e.message, true);
    } finally {
      setCreating(false);
    }
  }

  async function handleRemove(id, name) {
    if (!confirm(`Remove ${name}'s account?`)) return;
    try {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "delete failed");
      showToast("Account removed");
      load();
    } catch (e) {
      showToast(e.message === "delete failed" ? "Couldn't remove account" : e.message, true);
    }
  }

  return (
    <div className="app">
      <div className="hero">
        <h1>Staff</h1>
        <p>Create teacher accounts and assign them to the courses they'll review.</p>
      </div>

      <div className="card">
        <h2>New teacher</h2>
        <form onSubmit={handleCreate}>
          <div className="field-grid">
            <div className="field required"><label>Full name</label><input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
            <div className="field required"><label>Username</label><input type="text" value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} /></div>
            <div className="field required"><label>Password</label><input type="text" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="8+ characters — share this with them" /></div>
          </div>
          <div className="field" style={{ marginTop: 14 }}>
            <label>Courses</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
              {courses.length === 0 ? <span className="hint" style={{ margin: 0 }}>No courses yet.</span> : courses.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="btn btn-sm"
                  style={form.courseIds.includes(c.id) ? { background: "var(--brand)", borderColor: "var(--brand)", color: "#FBFAF7" } : undefined}
                  onClick={() => toggleCourse(c.id)}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
          <div className="form-actions"><button type="submit" className="btn btn-primary" disabled={creating}>{creating ? "Creating…" : "Create teacher account"}</button></div>
        </form>
      </div>

      <div className="card">
        <h2>Teachers ({teachers.length})</h2>
        {loading ? (
          <p className="hint">Loading…</p>
        ) : teachers.length === 0 ? (
          <p className="hint">No teacher accounts yet.</p>
        ) : (
          <div className="dash-table-wrap">
            <table className="dash">
              <thead><tr><th>Name</th><th>Username</th><th>Courses</th><th></th></tr></thead>
              <tbody>
                {teachers.map((t) => (
                  <tr key={t.id}>
                    <td><strong>{t.name}</strong></td>
                    <td>{t.username}</td>
                    <td>{(t.courseIds || []).length}</td>
                    <td style={{ textAlign: "right" }}><button className="link-btn" style={{ color: "var(--danger)" }} onClick={() => handleRemove(t.id, t.name)}>Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
