"use client";

import {
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";

import Link from "next/link";

import {
  MONTH_NAMES,
  todayIso,
  isWithinAttendanceEditWindow,
} from "@/lib/dateUtils";

import {
  useToast,
} from "@/components/Toast";

import AttendanceTable from "@/components/AttendanceTable";

const EDITABLE = {
  startTime: true,
  lunchOut: true,
  lunchIn: true,
  endTime: true,

  // Instructor can view the student's
  // signature but cannot redraw it.
  studentSig: false,

  staffSig: true,
  absent: true,
};

const SAVE_DEBOUNCE_MS = 650;

function SignatureCanvas({
  value,
  onChange,
}) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const ctx =
      canvas.getContext("2d");

    ctx.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    if (
      value &&
      value.startsWith("data:image")
    ) {
      const image = new Image();

      image.onload = () => {
        ctx.clearRect(
          0,
          0,
          canvas.width,
          canvas.height
        );

        ctx.drawImage(
          image,
          0,
          0,
          canvas.width,
          canvas.height
        );
      };

      image.src = value;
    }
  }, [value]);

  function getPoint(event) {
    const canvas = canvasRef.current;

    const rect =
      canvas.getBoundingClientRect();

    return {
      x:
        ((event.clientX - rect.left) /
          rect.width) *
        canvas.width,

      y:
        ((event.clientY - rect.top) /
          rect.height) *
        canvas.height,
    };
  }

  function start(event) {
    event.preventDefault();

    const canvas = canvasRef.current;
    const ctx =
      canvas.getContext("2d");
    const point = getPoint(event);

    drawingRef.current = true;

    canvas.setPointerCapture?.(
      event.pointerId
    );

    ctx.beginPath();

    ctx.moveTo(
      point.x,
      point.y
    );
  }

  function draw(event) {
    if (!drawingRef.current) {
      return;
    }

    event.preventDefault();

    const canvas = canvasRef.current;
    const ctx =
      canvas.getContext("2d");
    const point = getPoint(event);

    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#000000";

    ctx.lineTo(
      point.x,
      point.y
    );

    ctx.stroke();
  }

  function stop(event) {
    if (!drawingRef.current) {
      return;
    }

    drawingRef.current = false;

    const canvas = canvasRef.current;

    try {
      canvas.releasePointerCapture?.(
        event.pointerId
      );
    } catch {}

    onChange(
      canvas.toDataURL("image/png")
    );
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx =
      canvas.getContext("2d");

    ctx.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    onChange("");
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={500}
        height={120}
        aria-label="Final staff signature"
        onPointerDown={start}
        onPointerMove={draw}
        onPointerUp={stop}
        onPointerCancel={stop}
        onPointerLeave={(event) => {
          if (drawingRef.current) {
            stop(event);
          }
        }}
        style={{
          width: "100%",
          height: 80,
          display: "block",
          background: "#ffffff",
          border:
            "1px solid #9aa7ad",
          borderRadius: 4,
          cursor: "crosshair",
          touchAction: "none",
        }}
      />

      {value && (
        <button
          type="button"
          className="btn btn-sm"
          onClick={clear}
          style={{
            marginTop: 6,
          }}
        >
          Clear signature
        </button>
      )}
    </div>
  );
}

function isAttendedRow(row) {
  if (!row) return false;

  if (
    row.absent ||
    row.studentAbsent
  ) {
    return false;
  }

  return !!(
    row.startTime ||
    row.lunchOut ||
    row.lunchIn ||
    row.endTime ||
    row.studentSig
  );
}

export default function TeacherStudentSheetPage({
  params,
}) {
  const { studentId } = params;

  const showToast = useToast();

  const [
    sheet,
    setSheet,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    forbidden,
    setForbidden,
  ] = useState(false);

  const [
    saveState,
    setSaveState,
  ] = useState("idle");

  const [
    signing,
    setSigning,
  ] = useState(false);

  /*
   * This is a fresh sign-off form.
   * It is intentionally separate
   * from the saved approval.
   */
  const [
    signOff,
    setSignOff,
  ] = useState({
    staffName: "",
    signature: "",
    comments: "",
  });

  const saveTimer = useRef(null);
  const pendingPatch = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(
          `/api/sheets/${studentId}`,
          {
            cache: "no-store",
          }
        );

        if (res.status === 403) {
          setForbidden(true);
          return;
        }

        if (!res.ok) {
          throw new Error(
            "bad response"
          );
        }

        setSheet(
          await res.json()
        );
      } catch (e) {
        console.error(e);

        showToast(
          "Couldn't load this sheet",
          true
        );
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      clearTimeout(
        saveTimer.current
      );
    };
  }, [
    studentId,
    showToast,
  ]);

  const persist = useCallback(
    async (patch) => {
      if (!patch) {
        return true;
      }

      setSaveState("saving");

      try {
        const res = await fetch(
          `/api/sheets/${studentId}`,
          {
            method: "PUT",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(patch),
          }
        );

        if (!res.ok) {
          const data = await res
            .json()
            .catch(() => ({}));

          throw new Error(
            data.error ||
              "save failed"
          );
        }

        setSaveState("saved");

        return true;
      } catch (e) {
        console.error(e);

        setSaveState("idle");

        showToast(
          e.message ||
            "Couldn't save — check your connection",
          true
        );

        return false;
      }
    },
    [
      studentId,
      showToast,
    ]
  );

  function queueSave(patch) {
    const current =
      pendingPatch.current || {};

    const next = {
      ...current,
      ...patch,
    };

    /*
     * Preserve pending row changes
     * instead of replacing previous
     * unsaved row changes.
     */
    if (patch.rows) {
      next.rows = {
        ...(current.rows || {}),
      };

      for (const [
        iso,
        rowPatch,
      ] of Object.entries(
        patch.rows
      )) {
        next.rows[iso] = {
          ...(next.rows[iso] ||
            {}),
          ...rowPatch,
        };
      }
    }

    pendingPatch.current = next;

    setSaveState("saving");

    clearTimeout(
      saveTimer.current
    );

    saveTimer.current =
      setTimeout(
        async () => {
          const patchToSave =
            pendingPatch.current;

          pendingPatch.current =
            null;

          await persist(
            patchToSave
          );
        },
        SAVE_DEBOUNCE_MS
      );
  }

  async function flushPendingSave() {
    clearTimeout(
      saveTimer.current
    );

    const patch =
      pendingPatch.current;

    pendingPatch.current =
      null;

    if (!patch) {
      return true;
    }

    return await persist(patch);
  }

  function handleRowChange(
    iso,
    field,
    value
  ) {
    setSheet((prev) => {
      const rows = {
        ...(prev.rows || {}),
      };

      const currentRow = {
        ...(rows[iso] || {}),
      };

      /*
       * IMPORTANT:
       *
       * Absent is only a status.
       * We DO NOT delete the student's
       * existing attendance entries.
       *
       * AttendanceTable hides/locks
       * them while Absent is checked.
       * If Absent is unchecked, the
       * original values appear again.
       */
      currentRow[field] = value;

      rows[iso] = currentRow;

      queueSave({
        rows: {
          [iso]: {
            [field]: value,
          },
        },
      });

      return {
        ...prev,
        rows,
      };
    });
  }

  const today = todayIso();

  const missingDailySignatures =
    sheet
      ? Object.entries(
          sheet.rows || {}
        )
          .filter(
            ([iso, row]) =>
              iso <= today &&
              isWithinAttendanceEditWindow(
                iso,
                today
              ) &&
              isAttendedRow(row) &&
              !row.staffSig
          )
          .map(
            ([iso]) => iso
          )
      : [];

  const signOffReady =
    !!signOff.staffName.trim() &&
    !!signOff.signature &&
    missingDailySignatures.length ===
      0;

  function updateSignOff(
    field,
    value
  ) {
    setSignOff((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSign() {
    if (
      !signOff.staffName.trim()
    ) {
      showToast(
        "Staff name / position is required",
        true
      );

      return;
    }

    if (!signOff.signature) {
      showToast(
        "Handwritten staff signature is required",
        true
      );

      return;
    }

    if (
      missingDailySignatures.length >
      0
    ) {
      showToast(
        "Complete the required daily staff signature before signing off.",
        true
      );

      return;
    }

    setSigning(true);

    try {
      /*
       * Save any pending attendance
       * correction or daily staff
       * signature before final
       * approval validation.
       */
      const saved =
        await flushPendingSave();

      if (!saved) {
        throw new Error(
          "Attendance changes could not be saved."
        );
      }

      const res = await fetch(
        `/api/sheets/${studentId}/sign`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            approvedStaffName:
              signOff.staffName.trim(),

            approvedStaffSig:
              signOff.signature,

            comments:
              signOff.comments,
          }),
        }
      );

      const data = await res
        .json()
        .catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          data.error ||
            "Couldn't sign the sheet."
        );
      }

      const wasSigned =
        !!sheet.signedAt;

      /*
       * Keep the persisted approval
       * returned by the server.
       */
      setSheet(data);

      /*
       * Clear the form after successful
       * Sign & approve / Re-sign.
       */
      setSignOff({
        staffName: "",
        signature: "",
        comments: "",
      });

      showToast(
        wasSigned
          ? "Sheet re-signed and saved"
          : "Sheet signed and saved"
      );
    } catch (e) {
      console.error(e);

      showToast(
        e.message ||
          "Couldn't sign — try again",
        true
      );
    } finally {
      setSigning(false);
    }
  }

  if (loading) {
    return (
      <div className="app">
        <p className="hint">
          Loading…
        </p>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="app">
        <div className="empty-state">
          <p>
            You don&apos;t have
            access to this student.
          </p>

          <Link
            href="/teacher"
            className="btn btn-primary"
          >
            Back to my courses
          </Link>
        </div>
      </div>
    );
  }

  if (!sheet) {
    return (
      <div className="app">
        <p className="hint">
          Couldn't load this sheet.
        </p>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="view-header">
        <Link
          href={`/teacher/courses/${sheet.courseId}`}
          className="back-link"
        >
          &larr;{" "}
          {sheet.courseName}
        </Link>

        <div className="top-actions">
          <span
            className={`save-status ${saveState}`}
          >
            <span className="dot" />

            {saveState ===
            "saving"
              ? "Saving…"
              : "Saved"}
          </span>

          <a
            className="btn"
            href={`/api/sheets/${studentId}/docx`}
          >
            Download Word (.docx)
          </a>
        </div>
      </div>

      <div className="hero">
        <h1>
          {sheet.studentName}
        </h1>

        <p>
          {
            MONTH_NAMES[
              sheet.month - 1
            ]
          }{" "}
          {sheet.year} ·{" "}
          {sheet.courseName}
        </p>
      </div>

      <div className="card">
        <h2>
          Daily sign-in
        </h2>

        <AttendanceTable
          year={sheet.year}
          month={sheet.month}
          rows={sheet.rows}
          editable={EDITABLE}
          onChange={
            handleRowChange
          }
          accessMode="teacher"
        />

        <p className="hint">
          Review or correct
          attendance times and
          Absent status during
          the rolling seven-day
          window. Student
          signatures are
          read-only. Add your
          daily staff signature
          after reviewing an
          attended day. Holidays
          are controlled by the
          admin.
        </p>
      </div>

      <div className="card">
        <h2>
          Sign off
        </h2>

        {sheet.signedAt && (
          <div
            className="signed-stamp"
            style={{
              marginBottom: 18,
            }}
          >
            &#10003; Signed by{" "}
            {sheet.signedBy} on{" "}
            {new Date(
              sheet.signedAt
            ).toLocaleString()}
          </div>
        )}

        <div className="field-grid">
          <div className="field">
            <label>
              Staff name /
              position *
            </label>

            <input
              type="text"
              value={
                signOff.staffName
              }
              onChange={(e) =>
                updateSignOff(
                  "staffName",
                  e.target.value
                )
              }
            />
          </div>

          <div className="field">
            <label>
              Staff signature *
            </label>

            <SignatureCanvas
              value={
                signOff.signature
              }
              onChange={(value) =>
                updateSignOff(
                  "signature",
                  value
                )
              }
            />

            <div className="field-hint">
              Required handwritten
              signature.
            </div>
          </div>
        </div>

        <div
          className="field"
          style={{
            marginTop: 14,
          }}
        >
          <label>
            Comments
            <span
              style={{
                fontWeight:
                  "normal",
                marginLeft: 6,
              }}
            >
              (optional)
            </span>
          </label>

          <textarea
            value={
              signOff.comments
            }
            onChange={(e) =>
              updateSignOff(
                "comments",
                e.target.value
              )
            }
          />
        </div>

        {missingDailySignatures.length >
          0 && (
          <div
            className="hint"
            style={{
              marginTop: 14,
            }}
          >
            Add the daily staff
            signature for{" "}
            {missingDailySignatures
              .map((iso) => {
                const [
                  year,
                  month,
                  day,
                ] =
                  iso.split("-");

                return `${month}/${day}/${year}`;
              })
              .join(", ")}{" "}
            before final approval.
          </div>
        )}

        <div className="form-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSign}
            disabled={
              signing ||
              !signOffReady
            }
          >
            {signing
              ? "Saving…"
              : sheet.signedAt
              ? "Re-sign"
              : "Sign & approve"}
          </button>
        </div>
      </div>
    </div>
  );
}