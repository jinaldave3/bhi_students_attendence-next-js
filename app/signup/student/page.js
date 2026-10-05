"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function StudentSignupPage() {
  const router = useRouter();

  const [courses, setCourses] = useState([]);

  const [form, setForm] = useState({
    name: "",
    username: "",
    password: "",
    confirmPassword: "",
    courseId: "",
  });

  const [loadingCourses, setLoadingCourses] =
    useState(true);

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] = useState("");

  useEffect(() => {
    async function loadCourses() {
      try {
        const res = await fetch(
          "/api/public/courses",
          { cache: "no-store" }
        );

        const data = await res.json().catch(
          () => []
        );

        if (!res.ok) {
          throw new Error(
            data.error || "Failed to load courses."
          );
        }

        setCourses(data);
      } catch (e) {
        setError(
          "Couldn't load the available courses."
        );
      } finally {
        setLoadingCourses(false);
      }
    }

    loadCourses();
  }, []);

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
      !form.courseId
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
      form.password !== form.confirmPassword
    ) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch(
        "/api/signup/student",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name,
            username,
            password: form.password,
            courseId: form.courseId,
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
        "/login?registered=student"
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
        <h1>Student Sign Up</h1>

        <p>
          Create your Bright Horizon Institute
          attendance account.
        </p>

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
              sign in each day.
            </div>
          </div>

          <div
            className="field required"
            style={{ marginBottom: 14 }}
          >
            <label htmlFor="course">
              Course
            </label>

            <select
              id="course"
              value={form.courseId}
              disabled={loadingCourses}
              onChange={(e) =>
                updateField(
                  "courseId",
                  e.target.value
                )
              }
            >
              <option value="">
                {loadingCourses
                  ? "Loading courses..."
                  : "Select your course"}
              </option>

              {courses.map((course) => (
                <option
                  key={course.id}
                  value={course.id}
                >
                  {course.name}
                  {course.code
                    ? ` (${course.code})`
                    : ""}
                </option>
              ))}
            </select>

            {!loadingCourses &&
              courses.length === 0 && (
                <div className="field-hint">
                  No courses are currently
                  available. Please contact BHI.
                </div>
              )}
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
            disabled={
              submitting ||
              loadingCourses ||
              courses.length === 0
            }
          >
            {submitting
              ? "Creating account…"
              : "Create student account"}
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