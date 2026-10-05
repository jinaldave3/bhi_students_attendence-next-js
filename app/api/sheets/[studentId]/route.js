import {
  NextResponse,
} from "next/server";

import {
  ObjectId,
} from "mongodb";

import {
  getDb,
} from "@/lib/mongodb";

import {
  requireSession,
} from "@/lib/session";

import {
  buildSheetView,
} from "@/lib/sheetView";

import {
  newSheet,
  blankRow,
  ATTENDANCE_START_DATE,
  isWithinAttendanceEditWindow,
  isAllowedAttendanceMonth,
  todayIso,
} from "@/lib/dateUtils";

async function canAccessStudent(
  db,
  session,
  studentId
) {
  if (session.role === "admin") {
    return true;
  }

  if (
    session.role !== "teacher"
  ) {
    return false;
  }

  const student =
    await db
      .collection("users")
      .findOne({
        _id:
          new ObjectId(
            studentId
          ),
      });

  if (
    !student ||
    !student.courseId
  ) {
    return false;
  }

  return (
    session.courseIds || []
  ).includes(
    student.courseId.toString()
  );
}

export async function GET(
  request,
  { params }
) {
  const session =
    await requireSession([
      "admin",
      "teacher",
    ]);

  if (
    session instanceof
    NextResponse
  ) {
    return session;
  }

  try {
    const db =
      await getDb();

    if (
      !(await canAccessStudent(
        db,
        session,
        params.studentId
      ))
    ) {
      return NextResponse.json(
        {
          error: "Not allowed",
        },
        {
          status: 403,
        }
      );
    }

    const studentId =
      new ObjectId(
        params.studentId
      );

    let sheet =
      await db
        .collection("sheets")
        .findOne({
          _id: studentId,
        });

    if (!sheet) {
      const student =
        await db
          .collection("users")
          .findOne({
            _id: studentId,
          });

      sheet = newSheet({
        _id: studentId,
        studentId,
        courseId:
          student?.courseId ||
          null,
      });

      await db
        .collection("sheets")
        .insertOne(sheet);
    }

    return NextResponse.json(
      await buildSheetView(
        db,
        sheet
      )
    );
  } catch (e) {
    console.error(e);

    return NextResponse.json(
      {
        error:
          "Failed to load sheet",
      },
      {
        status: 500,
      }
    );
  }
}

export async function PUT(
  request,
  { params }
) {
  const session =
    await requireSession([
      "admin",
      "teacher",
    ]);

  if (
    session instanceof
    NextResponse
  ) {
    return session;
  }

  const body =
    await request
      .json()
      .catch(() => ({}));

  try {
    const db =
      await getDb();

    if (
      !(await canAccessStudent(
        db,
        session,
        params.studentId
      ))
    ) {
      return NextResponse.json(
        {
          error: "Not allowed",
        },
        {
          status: 403,
        }
      );
    }

    const studentId =
      new ObjectId(
        params.studentId
      );

    const existing =
      await db
        .collection("sheets")
        .findOne({
          _id: studentId,
        });

    if (!existing) {
      return NextResponse.json(
        {
          error: "Not found",
        },
        {
          status: 404,
        }
      );
    }

    const isAdmin =
      session.role === "admin";

    const patch = {
      updatedAt:
        new Date().toISOString(),
    };

    if (isAdmin) {
      const requestedMonth =
        Number.isInteger(
          body.month
        )
          ? body.month
          : existing.month;

      const requestedYear =
        Number.isInteger(
          body.year
        )
          ? body.year
          : existing.year;

      if (
        ("month" in body ||
          "year" in body) &&
        !isAllowedAttendanceMonth(
          requestedYear,
          requestedMonth
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Attendance records before October 2026 are not available.",
          },
          {
            status: 403,
          }
        );
      }

      if (
        Number.isInteger(
          body.month
        )
      ) {
        patch.month =
          body.month;
      }

      if (
        Number.isInteger(
          body.year
        )
      ) {
        patch.year =
          body.year;
      }

      if (
        typeof body.caseManager ===
        "string"
      ) {
        patch.caseManager =
          body.caseManager;
      }

      if (
        typeof body.instructor ===
        "string"
      ) {
        patch.instructor =
          body.instructor;
      }

      if (
        typeof body.startDate ===
        "string"
      ) {
        patch.startDate =
          body.startDate;
      }

      if (
        typeof body.endDate ===
        "string"
      ) {
        patch.endDate =
          body.endDate;
      }
    }

    if (
      body.rows &&
      typeof body.rows ===
        "object"
    ) {
      const rows = {
        ...(existing.rows || {}),
      };

      const today = todayIso();

      for (const [
        iso,
        incoming,
      ] of Object.entries(
        body.rows
      )) {
        if (
          !/^\d{4}-\d{2}-\d{2}$/.test(
            iso
          )
        ) {
          continue;
        }

        if (
          iso <
          ATTENDANCE_START_DATE
        ) {
          return NextResponse.json(
            {
              error:
                "Attendance cannot be changed before the system start date.",
            },
            {
              status: 403,
            }
          );
        }

        const merged = {
          ...(rows[iso] ||
            blankRow()),
        };

        if (!isAdmin) {
          /*
           * INSTRUCTOR PERMISSIONS
           *
           * Instructor may:
           * - correct attendance times
           * - mark/unmark student Absent
           * - add/edit daily staff signature
           *
           * Instructor may NOT:
           * - change student signature
           * - control Holiday
           *
           * All instructor edits are
           * restricted to the rolling
           * seven-day window.
           */
          if (
            !isWithinAttendanceEditWindow(
              iso,
              today
            )
          ) {
            return NextResponse.json(
              {
                error:
                  "That attendance date is outside your seven-day editing window.",
              },
              {
                status: 403,
              }
            );
          }

          const teacherFields = [
            "startTime",
            "lunchOut",
            "lunchIn",
            "endTime",
            "staffSig",
          ];

          for (const field of teacherFields) {
            if (field in incoming) {
              merged[field] =
                typeof incoming[field] ===
                "string"
                  ? incoming[field]
                  : "";
            }
          }

          if (
            "studentAbsent" in
            incoming
          ) {
            /*
             * Absent is NON-DESTRUCTIVE.
             *
             * We only change the status.
             * Existing student attendance
             * data remains stored.
             *
             * AttendanceTable hides and
             * locks those values while
             * studentAbsent is true.
             *
             * If Absent is unchecked,
             * the original data becomes
             * visible again.
             */
            merged.studentAbsent =
              !!incoming.studentAbsent;
          }
        } else {
          /*
           * ADMIN PERMISSIONS
           */
          const future =
            iso > today;

          if (future) {
            const attemptedAttendance =
              [
                "startTime",
                "lunchOut",
                "lunchIn",
                "endTime",
                "studentSig",
                "staffSig",
                "studentAbsent",
              ].some(
                (field) =>
                  field in incoming
              );

            if (
              attemptedAttendance
            ) {
              return NextResponse.json(
                {
                  error:
                    "Future attendance cannot be entered. Only Holiday information may be changed in advance.",
                },
                {
                  status: 403,
                }
              );
            }

            if (
              "absent" in incoming
            ) {
              merged.absent =
                !!incoming.absent;
            }

            if (
              "holidayNote" in
              incoming
            ) {
              merged.holidayNote =
                typeof incoming.holidayNote ===
                "string"
                  ? incoming.holidayNote
                  : "";
            }
          } else {
            const adminFields = [
              "startTime",
              "lunchOut",
              "lunchIn",
              "endTime",
              "studentSig",
              "staffSig",
              "studentAbsent",
              "absent",
              "holidayNote",
            ];

            for (const field of adminFields) {
              if (field in incoming) {
                if (
                  field === "absent" ||
                  field ===
                    "studentAbsent"
                ) {
                  /*
                   * Both status fields
                   * are non-destructive.
                   */
                  merged[field] =
                    !!incoming[field];
                } else {
                  merged[field] =
                    incoming[field];
                }
              }
            }
          }
        }

        rows[iso] = merged;
      }

      patch.rows = rows;
    }

    const result =
      await db
        .collection("sheets")
        .findOneAndUpdate(
          {
            _id: studentId,
          },
          {
            $set: patch,
          },
          {
            returnDocument:
              "after",
          }
        );

    return NextResponse.json(
      await buildSheetView(
        db,
        result
      )
    );
  } catch (e) {
    console.error(e);

    return NextResponse.json(
      {
        error: "Failed to save",
      },
      {
        status: 500,
      }
    );
  }
}