"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useToast } from "@/components/Toast";

export default function TeacherCoursesPage() {
  const showToast = useToast();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/courses", { cache: "no-store" });
        if (!res.ok) throw new Error("bad response");
        setCourses(await res.json());
      } catch (e) {
        console.error(e);
        showToast("Couldn't load your courses", true);
      } finally {
        setLoading(false);
      }
    })();
  }, [showToast]);

  return (
    <div className="app">
      <div className="hero">
        <h1>My courses</h1>
        <p>Open a course to see its students, check who&apos;s signed in today, and sign off their sheets.</p>
      </div>

      {loading ? (
        <p className="hint">Loading…</p>
      ) : courses.length === 0 ? (
        <div className="empty-state"><p>You're not assigned to any courses yet — ask your admin to add you to one.</p></div>
      ) : (
        <div className="card-grid">
          {courses.map((c) => (
            <Link key={c.id} href={`/teacher/courses/${c.id}`} className="tile">
              <div className="name">{c.name}</div>
              <div className="course">{c.code || "No course code"}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
