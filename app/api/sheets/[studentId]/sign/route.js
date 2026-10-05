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
  todayIso,
  isWithinAttendanceEditWindow,
} from "@/lib/dateUtils";

async function canAccessStudent(
  db,
  session,
  studentId
) {
  if (
    session.role === "admin"
  ) {
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

function isAttendedRow(row) {
  if (!row) {
    return false;
  }

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

export async function POST(
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
          error:
            "Not allowed",
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

    const sheet =
      await db
        .collection("sheets")
        .findOne({
          _id: studentId,
        });

    if (!sheet) {
      return NextResponse.json(
        {
          error:
            "Not found",
        },
        {
          status: 404,
        }
      );
    }

    const approvedStaffName =
      typeof body.approvedStaffName ===
      "string"
        ? body.approvedStaffName.trim()
        : "";

    const approvedStaffSig =
      typeof body.approvedStaffSig ===
      "string"
        ? body.approvedStaffSig
        : "";

    if (
      !approvedStaffName
    ) {
      return NextResponse.json(
        {
          error:
            "Staff name / position is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !approvedStaffSig ||
      !approvedStaffSig.startsWith(
        "data:image"
      )
    ) {
      return NextResponse.json(
        {
          error:
            "A handwritten staff signature is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      session.role ===
      "teacher"
    ) {
      const today =
        todayIso();

      const missing =
        Object.entries(
          sheet.rows || {}
        )
          .filter(
            ([iso, row]) =>
              iso <= today &&
              isWithinAttendanceEditWindow(
                iso,
                today
              ) &&
              isAttendedRow(
                row
              ) &&
              !row.staffSig
          )
          .map(
            ([iso]) => iso
          );

      if (
        missing.length > 0
      ) {
        return NextResponse.json(
          {
            error:
              `Daily staff signature required for: ${missing.join(
                ", "
              )}`,
          },
          {
            status: 400,
          }
        );
      }
    }

    const now =
      new Date().toISOString();

    const patch = {
      updatedAt: now,
      signedAt: now,
      signedBy:
        session.name,

      approvedStaffName,

      approvedStaffSig,
    };

    if (
      typeof body.comments ===
      "string"
    ) {
      patch.comments =
        body.comments;
    }

    const result =
      await db
        .collection("sheets")
        .findOneAndUpdate(
          {
            _id:
              studentId,
          },
          {
            $set: patch,
          },
          {
            returnDocument:
              "after",
          }
        );

    if (!result) {
      return NextResponse.json(
        {
          error:
            "Not found",
        },
        {
          status: 404,
        }
      );
    }

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
        error:
          "Failed to sign",
      },
      {
        status: 500,
      }
    );
  }
}