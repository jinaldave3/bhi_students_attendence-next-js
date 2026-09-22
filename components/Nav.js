"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useToast } from "./Toast";

const TABS = {
  student: [{ href: "/student", label: "My sheet" }],
  teacher: [{ href: "/teacher", label: "My courses" }],
  admin: [
    { href: "/admin", label: "Overview" },
    { href: "/admin/courses", label: "Courses" },
    { href: "/admin/users", label: "Staff" },
  ],
};

export default function Nav({ user }) {
  const pathname = usePathname();
  const router = useRouter();
  const showToast = useToast();

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (e) {
      // fall through — redirecting to /login is safe either way
    }
    router.push("/login");
    router.refresh();
  }

  const tabs = user ? TABS[user.role] || [] : [];

  return (
    <div className="topbar">
      <div className="brandmark">
        <span className="glyph">A</span>
        <div>
          <div className="title">Attendance Records</div>
          <div className="sub">Individual student sign-in sheets</div>
        </div>
      </div>
      {tabs.length > 0 && (
        <nav className="nav-tabs">
          {tabs.map((t) => (
            <Link key={t.href} href={t.href} className={`nav-tab ${pathname === t.href ? "active" : ""}`}>
              {t.label}
            </Link>
          ))}
        </nav>
      )}
      {user && (
        <div className="top-actions">
          <span className="user-chip">
            {user.name} <span className="role-pill">{user.role}</span>
          </span>
          <button className="btn btn-sm" onClick={handleLogout}>Sign out</button>
        </div>
      )}
    </div>
  );
}
