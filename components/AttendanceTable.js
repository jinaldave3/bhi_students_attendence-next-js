"use client";

import {
  useEffect,
  useRef,
} from "react";

import {
  weekdaysInMonth,
  displayDate,
  dayNameFor,
  todayIso,
  blankRow,
  ATTENDANCE_START_DATE,
  isWithinAttendanceEditWindow,
} from "@/lib/dateUtils";

function DrawingCanvas({
  value,
  disabled,
  onChange,
  ariaLabel,
}) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    ctx.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    if (
      value &&
      typeof value === "string" &&
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

  function startDrawing(event) {
    if (disabled) return;

    event.preventDefault();

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const point = getPoint(event);

    drawingRef.current = true;

    canvas.setPointerCapture?.(
      event.pointerId
    );

    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
  }

  function draw(event) {
    if (
      disabled ||
      !drawingRef.current
    ) {
      return;
    }

    event.preventDefault();

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const point = getPoint(event);

    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#000000";

    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  }

  function stopDrawing(event) {
    if (
      disabled ||
      !drawingRef.current
    ) {
      return;
    }

    drawingRef.current = false;

    const canvas = canvasRef.current;

    try {
      canvas.releasePointerCapture?.(
        event.pointerId
      );
    } catch {
      // Safe to ignore.
    }

    onChange(
      canvas.toDataURL("image/png")
    );
  }

  function clear() {
    if (disabled) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    ctx.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    onChange("");
  }

  return (
    <div style={{ minWidth: 120 }}>
      <canvas
        ref={canvasRef}
        width={180}
        height={65}
        aria-label={ariaLabel}
        onPointerDown={startDrawing}
        onPointerMove={draw}
        onPointerUp={stopDrawing}
        onPointerCancel={stopDrawing}
        onPointerLeave={(event) => {
          if (drawingRef.current) {
            stopDrawing(event);
          }
        }}
        style={{
          width: "100%",
          minWidth: 110,
          height: 52,
          display: "block",
          background: disabled
            ? "#eeeeee"
            : "#ffffff",
          border: "1px solid #9aa7ad",
          borderRadius: 4,
          cursor: disabled
            ? "not-allowed"
            : "crosshair",
          opacity: disabled ? 0.65 : 1,
          touchAction: "none",
        }}
      />

      {!disabled && value && (
        <button
          type="button"
          onClick={clear}
          style={{
            display: "block",
            margin: "4px auto 0",
            padding: "2px 10px",
            border:
              "1px solid #8aaec0",
            borderRadius: "4px",
            background: "#26343b",
            color: "#ffffff",
            fontSize: "11px",
            lineHeight: "16px",
            cursor: "pointer",
          }}
        >
          Clear
        </button>
      )}
    </div>
  );
}

export default function AttendanceTable({
  year,
  month,
  rows,
  editable,
  onChange,
  accessMode = "student",
}) {
  const dates =
    weekdaysInMonth(year, month);

  const today = todayIso();

  function attendanceFieldDisabled(
    iso,
    field,
    row
  ) {
    if (iso < ATTENDANCE_START_DATE) {
      return true;
    }

    if (
      row?.absent ||
      row?.studentAbsent
    ) {
      return true;
    }

    if (accessMode === "admin") {
      if (iso > today) return true;

      return !editable[field];
    }

    if (
      !isWithinAttendanceEditWindow(
        iso,
        today
      )
    ) {
      return true;
    }

    return !editable[field];
  }

  function holidayDisabled(iso) {
    if (iso < ATTENDANCE_START_DATE) {
      return true;
    }

    return accessMode !== "admin";
  }

  function studentAbsentDisabled(
    iso,
    row
  ) {
    if (iso < ATTENDANCE_START_DATE) {
      return true;
    }

    // Holiday overrides student absence.
    if (row?.absent) {
      return true;
    }

    // Student and instructor can both
    // record/correct an absence.
    if (
      accessMode !== "student" &&
      accessMode !== "teacher"
    ) {
      return true;
    }

    return !isWithinAttendanceEditWindow(
      iso,
      today
    );
  }

  return (
    <div className="table-scroll">
      <table className="att">
        <thead>
          <tr>
            <th>Date</th>
            <th>Start time</th>
            <th>Lunch out</th>
            <th>Lunch in</th>
            <th>End time</th>
            <th>Student sig.</th>
            <th>Staff sig.</th>
            <th>Status</th>
          </tr>
        </thead>

        <tbody>
          {dates.length === 0 ? (
            <tr>
              <td
                colSpan={8}
                style={{
                  textAlign: "center",
                  padding: 18,
                  color:
                    "var(--ink-faint)",
                }}
              >
                No dates in this month.
              </td>
            </tr>
          ) : (
            dates.map((iso) => {
              const row =
                (rows && rows[iso]) ||
                blankRow();

              const isToday =
                iso === today;

              const beforeStart =
                iso <
                ATTENDANCE_START_DATE;

              const future =
                iso > today;

              const holidayLocked =
                holidayDisabled(iso);

              const absentLocked =
                studentAbsentDisabled(
                  iso,
                  row
                );

              return (
                <tr
                  key={iso}
                  className={
                    row.absent ||
                    row.studentAbsent
                      ? "is-absent"
                      : ""
                  }
                >
                  <td
                    className={`date-cell ${
                      isToday
                        ? "is-today"
                        : ""
                    }`}
                    title={
                      beforeStart
                        ? "Attendance tracking had not started yet."
                        : future
                        ? "Future attendance cannot be entered."
                        : undefined
                    }
                  >
                    {displayDate(iso)}

                    <span className="day">
                      {dayNameFor(iso).slice(
                        0,
                        3
                      )}

                      {isToday
                        ? " · today"
                        : ""}
                    </span>
                  </td>

                  {row.absent ? (
                    <td
                      colSpan={4}
                      style={{
                        textAlign:
                          "center",
                        verticalAlign:
                          "middle",
                      }}
                    >
                      <strong>
                        HOLIDAY
                      </strong>

                      <input
                        type="text"
                        placeholder="Optional note"
                        value={
                          row.holidayNote ||
                          ""
                        }
                        disabled={
                          holidayLocked
                        }
                        onChange={(e) =>
                          onChange(
                            iso,
                            "holidayNote",
                            e.target.value
                          )
                        }
                        style={{
                          display: "block",
                          width: "100%",
                          marginTop: 6,
                        }}
                      />
                    </td>
                  ) : row.studentAbsent ? (
                    <td
                      colSpan={4}
                      style={{
                        textAlign:
                          "center",
                        verticalAlign:
                          "middle",
                      }}
                    >
                      <strong>
                        ABSENT
                      </strong>
                    </td>
                  ) : (
                    <>
                      <td>
                        <DrawingCanvas
                          value={
                            row.startTime
                          }
                          disabled={attendanceFieldDisabled(
                            iso,
                            "startTime",
                            row
                          )}
                          ariaLabel={`Start time ${displayDate(
                            iso
                          )}`}
                          onChange={(value) =>
                            onChange(
                              iso,
                              "startTime",
                              value
                            )
                          }
                        />
                      </td>

                      <td>
                        <DrawingCanvas
                          value={
                            row.lunchOut
                          }
                          disabled={attendanceFieldDisabled(
                            iso,
                            "lunchOut",
                            row
                          )}
                          ariaLabel={`Lunch out ${displayDate(
                            iso
                          )}`}
                          onChange={(value) =>
                            onChange(
                              iso,
                              "lunchOut",
                              value
                            )
                          }
                        />
                      </td>

                      <td>
                        <DrawingCanvas
                          value={
                            row.lunchIn
                          }
                          disabled={attendanceFieldDisabled(
                            iso,
                            "lunchIn",
                            row
                          )}
                          ariaLabel={`Lunch in ${displayDate(
                            iso
                          )}`}
                          onChange={(value) =>
                            onChange(
                              iso,
                              "lunchIn",
                              value
                            )
                          }
                        />
                      </td>

                      <td>
                        <DrawingCanvas
                          value={
                            row.endTime
                          }
                          disabled={attendanceFieldDisabled(
                            iso,
                            "endTime",
                            row
                          )}
                          ariaLabel={`End time ${displayDate(
                            iso
                          )}`}
                          onChange={(value) =>
                            onChange(
                              iso,
                              "endTime",
                              value
                            )
                          }
                        />
                      </td>
                    </>
                  )}

                  <td>
                    <DrawingCanvas
                      value={row.studentSig}
                      disabled={attendanceFieldDisabled(
                        iso,
                        "studentSig",
                        row
                      )}
                      ariaLabel={`Student signature ${displayDate(
                        iso
                      )}`}
                      onChange={(value) =>
                        onChange(
                          iso,
                          "studentSig",
                          value
                        )
                      }
                    />
                  </td>

                  <td>
                    <DrawingCanvas
                      value={row.staffSig}
                      disabled={attendanceFieldDisabled(
                        iso,
                        "staffSig",
                        row
                      )}
                      ariaLabel={`Staff signature ${displayDate(
                        iso
                      )}`}
                      onChange={(value) =>
                        onChange(
                          iso,
                          "staffSig",
                          value
                        )
                      }
                    />
                  </td>

                  <td
                    style={{
                      minWidth: 115,
                      verticalAlign:
                        "middle",
                    }}
                  >
                    <label
                      className="absent-toggle"
                      style={{
                        display: "block",
                        marginBottom: 6,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={
                          !!row.studentAbsent
                        }
                        disabled={
                          absentLocked
                        }
                        onChange={(e) =>
                          onChange(
                            iso,
                            "studentAbsent",
                            e.target.checked
                          )
                        }
                      />

                      {" "}Absent
                    </label>

                    <label
                      className="absent-toggle"
                      style={{
                        display: "block",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={
                          !!row.absent
                        }
                        disabled={
                          holidayLocked
                        }
                        onChange={(e) =>
                          onChange(
                            iso,
                            "absent",
                            e.target.checked
                          )
                        }
                      />

                      {" "}Holiday
                    </label>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}