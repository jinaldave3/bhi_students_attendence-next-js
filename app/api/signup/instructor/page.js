"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function InstructorSignupPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    name: "",
    username: "",
    password: "",
    confirmPassword: "",
  });

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] = useState("");

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    const name = form.name.trim();
    const username = form.username.trim();

    if (
      !name ||
      !username ||
      !form.password ||
      !form.confirmPassword
    ) {
      setError("Please complete all fields.");
      return;
    }

    if (form.password.length < 8) {
      setError(
        "Password must be at least 8 characters."
      );
      return;
    }

    if (
      form.password !==
      form.confirmPassword
    ) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch(
        "/api/signup/instructor",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            name,
            username,
            password: form.password,
          }),
        }
      );

      const data = await res
        .json()
        .catch(() => ({}));

      if (!res.ok) {
        setError(
          data.error ||
            "Couldn't create your account."
        );

        setSubmitting(false);
        return;
      }

      router.push(
        "/login?registered=instructor"
      );
    } catch (e) {
      setError(
        "Couldn't reach the server. Please try again."
      );

      setSubmitting(false);
    }
  }

  return (
    <div className="app-narrow">
      <div className="login-card">
        <h1>Instructor Sign Up</h1>

        <p>
          Create your Bright Horizon Institute
          instructor account.
        </p>

        <div
          className="hint"
          style={{
            marginBottom: 20,
          }}
        >
          Your account will need to be approved
          by an administrator before you can
          access student attendance records.
        </div>

        {error && (
          <div className="error-banner">
            <span>&#9888;</span>
            <div>{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div
            className="field required"
            style={{ marginBottom: 14 }}
          >
            <label htmlFor="name">
              Full name
            </label>

            <input
              id="name"
              type="text"
              autoComplete="name"
              value={form.name}
              onChange={(e) =>
                updateField(
                  "name",
                  e.target.value
                )
              }
              autoFocus
            />
          </div>

          <div
            className="field required"
            style={{ marginBottom: 14 }}
          >
            <label htmlFor="username">
              Username
            </label>

            <input
              id="username"
              type="text"
              autoComplete="username"
              value={form.username}
              onChange={(e) =>
                updateField(
                  "username",
                  e.target.value
                )
              }
            />

            <div className="field-hint">
              You will use this username to
              sign in after approval.
            </div>
          </div>

          <div
            className="field required"
            style={{ marginBottom: 14 }}
          >
            <label htmlFor="password">
              Password
            </label>

            <input
              id="password"
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) =>
                updateField(
                  "password",
                  e.target.value
                )
              }
            />

            <div className="field-hint">
              Minimum 8 characters.
            </div>
          </div>

          <div
            className="field required"
            style={{ marginBottom: 20 }}
          >
            <label htmlFor="confirmPassword">
              Confirm password
            </label>

            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={(e) =>
                updateField(
                  "confirmPassword",
                  e.target.value
                )
              }
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={submitting}
          >
            {submitting
              ? "Creating account…"
              : "Create instructor account"}
          </button>
        </form>

        <div
          style={{
            marginTop: 20,
            textAlign: "center",
            fontSize: 13,
          }}
        >
          Already have an account?{" "}
          <Link href="/login">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}