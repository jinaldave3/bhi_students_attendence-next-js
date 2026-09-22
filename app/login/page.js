"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const HOME_FOR_ROLE = { admin: "/admin", teacher: "/teacher", student: "/student" };

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!username.trim() || !password) {
      setError("Enter your username and password.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Couldn't sign in — try again.");
        setLoading(false);
        return;
      }
      router.push(HOME_FOR_ROLE[data.user.role] || "/");
      router.refresh();
    } catch (e) {
      setError("Couldn't reach the server — check your connection.");
      setLoading(false);
    }
  }

  return (
    <div className="app-narrow">
      <div className="login-card">
        <h1>Sign in</h1>
        <p>Students, teachers, and admins all sign in here — accounts are created by an admin.</p>

        {error && <div className="error-banner"><span>&#9888;</span><div>{error}</div></div>}

        <form onSubmit={handleSubmit}>
          <div className="field" style={{ marginBottom: 14 }}>
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
            />
          </div>
          <div className="field" style={{ marginBottom: 20 }}>
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
