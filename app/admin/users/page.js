"use client";

import {
  useEffect,
  useState,
  useCallback,
} from "react";

import { useToast } from "@/components/Toast";

export default function AdminUsersPage() {
  const showToast = useToast();

  const [teachers, setTeachers] =
    useState([]);

  const [courses, setCourses] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [form, setForm] = useState({
    name: "",
    username: "",
    password: "",
    courseIds: [],
  });

  const [creating, setCreating] =
    useState(false);

  const [savingId, setSavingId] =
    useState(null);

  const load = useCallback(async () => {
    try {
      const [
        teachersRes,
        coursesRes,
      ] = await Promise.all([
        fetch(
          "/api/users?role=teacher",
          {
            cache: "no-store",
          }
        ),

        fetch("/api/courses", {
          cache: "no-store",
        }),
      ]);

      if (
        !teachersRes.ok ||
        !coursesRes.ok
      ) {
        throw new Error(
          "bad response"
        );
      }

      setTeachers(
        await teachersRes.json()
      );

      setCourses(
        await coursesRes.json()
      );
    } catch (e) {
      console.error(e);

      showToast(
        "Couldn't load staff",
        true
      );
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  function toggleNewTeacherCourse(id) {
    setForm((f) => ({
      ...f,

      courseIds:
        f.courseIds.includes(id)
          ? f.courseIds.filter(
              (courseId) =>
                courseId !== id
            )
          : [...f.courseIds, id],
    }));
  }

  function toggleExistingTeacherCourse(
    teacherId,
    courseId
  ) {
    setTeachers((current) =>
      current.map((teacher) => {
        if (
          teacher.id !== teacherId
        ) {
          return teacher;
        }

        const currentCourseIds =
          teacher.courseIds || [];

        const nextCourseIds =
          currentCourseIds.includes(
            courseId
          )
            ? currentCourseIds.filter(
                (id) =>
                  id !== courseId
              )
            : [
                ...currentCourseIds,
                courseId,
              ];

        return {
          ...teacher,
          courseIds: nextCourseIds,
        };
      })
    );
  }

  async function handleCreate(e) {
    e.preventDefault();

    if (
      !form.name.trim() ||
      !form.username.trim() ||
      !form.password
    ) {
      showToast(
        "Name, username, and password are required",
        true
      );

      return;
    }

    if (form.password.length < 8) {
      showToast(
        "Password must be at least 8 characters",
        true
      );

      return;
    }

    setCreating(true);

    try {
      const res = await fetch(
        "/api/users",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            ...form,
            role: "teacher",
          }),
        }
      );

      const data = await res
        .json()
        .catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          data.error ||
            "create failed"
        );
      }

      setForm({
        name: "",
        username: "",
        password: "",
        courseIds: [],
      });

      showToast(
        "Teacher account created"
      );

      await load();
    } catch (e) {
      showToast(
        e.message === "create failed"
          ? "Couldn't create account"
          : e.message,
        true
      );
    } finally {
      setCreating(false);
    }
  }

  async function saveTeacher(
    teacher,
    options = {}
  ) {
    setSavingId(teacher.id);

    try {
      const payload = {
        courseIds:
          teacher.courseIds || [],
      };

      if (
        typeof options.approved ===
        "boolean"
      ) {
        payload.approved =
          options.approved;
      }

      const res = await fetch(
        `/api/users/${teacher.id}`,
        {
          method: "PUT",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify(
            payload
          ),
        }
      );

      const data = await res
        .json()
        .catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          data.error ||
            "update failed"
        );
      }

      showToast(
        options.approved === true
          ? "Instructor approved"
          : "Teacher updated"
      );

      await load();
    } catch (e) {
      showToast(
        e.message === "update failed"
          ? "Couldn't update teacher"
          : e.message,
        true
      );
    } finally {
      setSavingId(null);
    }
  }

  async function handleRemove(
    id,
    name
  ) {
    if (
      !confirm(
        `Remove ${name}'s account?`
      )
    ) {
      return;
    }

    try {
      const res = await fetch(
        `/api/users/${id}`,
        {
          method: "DELETE",
        }
      );

      const data = await res
        .json()
        .catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          data.error ||
            "delete failed"
        );
      }

      showToast(
        "Account removed"
      );

      await load();
    } catch (e) {
      showToast(
        e.message === "delete failed"
          ? "Couldn't remove account"
          : e.message,
        true
      );
    }
  }

  const pendingTeachers =
    teachers.filter(
      (teacher) =>
        teacher.approved === false
    );

  const approvedTeachers =
    teachers.filter(
      (teacher) =>
        teacher.approved !== false
    );

  return (
    <div className="app">
      <div className="hero">
        <h1>Staff</h1>

        <p>
          Approve instructor signups,
          assign courses, or create
          teacher accounts directly.
        </p>
      </div>

      {pendingTeachers.length > 0 && (
        <div className="card">
          <h2>
            Pending instructor requests (
            {pendingTeachers.length})
          </h2>

          <p className="hint">
            Review each instructor,
            assign the courses they
            should access, then approve
            the account.
          </p>

          <div
            style={{
              display: "grid",
              gap: 14,
              marginTop: 16,
            }}
          >
            {pendingTeachers.map(
              (teacher) => (
                <div
                  key={teacher.id}
                  style={{
                    border:
                      "1px solid var(--line)",
                    borderRadius: 8,
                    padding: 16,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent:
                        "space-between",
                      gap: 16,
                      alignItems:
                        "flex-start",
                    }}
                  >
                    <div>
                      <strong>
                        {teacher.name}
                      </strong>

                      <div
                        className="hint"
                        style={{
                          marginTop: 3,
                        }}
                      >
                        Username:{" "}
                        {teacher.username}
                      </div>
                    </div>

                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        padding:
                          "4px 8px",
                        borderRadius: 999,
                        border:
                          "1px solid var(--line)",
                      }}
                    >
                      PENDING
                    </span>
                  </div>

                  <div
                    className="field"
                    style={{
                      marginTop: 14,
                    }}
                  >
                    <label>
                      Course access
                    </label>

                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 8,
                        marginTop: 6,
                      }}
                    >
                      {courses.length ===
                      0 ? (
                        <span
                          className="hint"
                          style={{
                            margin: 0,
                          }}
                        >
                          No courses yet.
                        </span>
                      ) : (
                        courses.map(
                          (course) => (
                            <button
                              key={
                                course.id
                              }
                              type="button"
                              className="btn btn-sm"
                              style={
                                (
                                  teacher.courseIds ||
                                  []
                                ).includes(
                                  course.id
                                )
                                  ? {
                                      background:
                                        "var(--brand)",
                                      borderColor:
                                        "var(--brand)",
                                      color:
                                        "#FBFAF7",
                                    }
                                  : undefined
                              }
                              onClick={() =>
                                toggleExistingTeacherCourse(
                                  teacher.id,
                                  course.id
                                )
                              }
                            >
                              {
                                course.name
                              }
                            </button>
                          )
                        )
                      )}
                    </div>
                  </div>

                  <div
                    className="form-actions"
                    style={{
                      marginTop: 14,
                    }}
                  >
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={
                        savingId ===
                        teacher.id
                      }
                      onClick={() =>
                        saveTeacher(
                          teacher,
                          {
                            approved:
                              true,
                          }
                        )
                      }
                    >
                      {savingId ===
                      teacher.id
                        ? "Approving…"
                        : "Approve instructor"}
                    </button>

                    <button
                      type="button"
                      className="btn"
                      style={{
                        color:
                          "var(--danger)",
                      }}
                      onClick={() =>
                        handleRemove(
                          teacher.id,
                          teacher.name
                        )
                      }
                    >
                      Remove request
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}

      <div className="card">
        <h2>
          Create teacher manually
        </h2>

        <p className="hint">
          Accounts created here are
          approved immediately.
        </p>

        <form onSubmit={handleCreate}>
          <div className="field-grid">
            <div className="field required">
              <label>
                Full name
              </label>

              <input
                type="text"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    name:
                      e.target.value,
                  }))
                }
              />
            </div>

            <div className="field required">
              <label>
                Username
              </label>

              <input
                type="text"
                value={form.username}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    username:
                      e.target.value,
                  }))
                }
              />
            </div>

            <div className="field required">
              <label>
                Password
              </label>

              <input
                type="text"
                value={form.password}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    password:
                      e.target.value,
                  }))
                }
                placeholder="8+ characters — share this with them"
              />
            </div>
          </div>

          <div
            className="field"
            style={{
              marginTop: 14,
            }}
          >
            <label>
              Courses
            </label>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                marginTop: 4,
              }}
            >
              {courses.length === 0 ? (
                <span
                  className="hint"
                  style={{ margin: 0 }}
                >
                  No courses yet.
                </span>
              ) : (
                courses.map(
                  (course) => (
                    <button
                      key={course.id}
                      type="button"
                      className="btn btn-sm"
                      style={
                        form.courseIds.includes(
                          course.id
                        )
                          ? {
                              background:
                                "var(--brand)",
                              borderColor:
                                "var(--brand)",
                              color:
                                "#FBFAF7",
                            }
                          : undefined
                      }
                      onClick={() =>
                        toggleNewTeacherCourse(
                          course.id
                        )
                      }
                    >
                      {course.name}
                    </button>
                  )
                )
              )}
            </div>
          </div>

          <div className="form-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={creating}
            >
              {creating
                ? "Creating…"
                : "Create teacher account"}
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2>
          Approved teachers (
          {approvedTeachers.length})
        </h2>

        {loading ? (
          <p className="hint">
            Loading…
          </p>
        ) : approvedTeachers.length ===
          0 ? (
          <p className="hint">
            No approved teacher
            accounts yet.
          </p>
        ) : (
          <div className="dash-table-wrap">
            <table className="dash">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Username</th>
                  <th>Courses</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {approvedTeachers.map(
                  (teacher) => (
                    <tr
                      key={teacher.id}
                    >
                      <td>
                        <strong>
                          {teacher.name}
                        </strong>
                      </td>

                      <td>
                        {teacher.username}
                      </td>

                      <td>
                        <div
                          style={{
                            display:
                              "flex",
                            flexWrap:
                              "wrap",
                            gap: 6,
                          }}
                        >
                          {courses.map(
                            (course) => (
                              <button
                                key={
                                  course.id
                                }
                                type="button"
                                className="btn btn-sm"
                                style={
                                  (
                                    teacher.courseIds ||
                                    []
                                  ).includes(
                                    course.id
                                  )
                                    ? {
                                        background:
                                          "var(--brand)",
                                        borderColor:
                                          "var(--brand)",
                                        color:
                                          "#FBFAF7",
                                      }
                                    : undefined
                                }
                                onClick={() =>
                                  toggleExistingTeacherCourse(
                                    teacher.id,
                                    course.id
                                  )
                                }
                              >
                                {
                                  course.name
                                }
                              </button>
                            )
                          )}

                          {courses.length ===
                            0 && (
                            <span className="hint">
                              No courses
                            </span>
                          )}
                        </div>
                      </td>

                      <td
                        style={{
                          textAlign:
                            "right",
                          whiteSpace:
                            "nowrap",
                        }}
                      >
                        <button
                          type="button"
                          className="link-btn"
                          disabled={
                            savingId ===
                            teacher.id
                          }
                          onClick={() =>
                            saveTeacher(
                              teacher
                            )
                          }
                          style={{
                            marginRight: 12,
                          }}
                        >
                          {savingId ===
                          teacher.id
                            ? "Saving…"
                            : "Save"}
                        </button>

                        <button
                          type="button"
                          className="link-btn"
                          style={{
                            color:
                              "var(--danger)",
                          }}
                          onClick={() =>
                            handleRemove(
                              teacher.id,
                              teacher.name
                            )
                          }
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}