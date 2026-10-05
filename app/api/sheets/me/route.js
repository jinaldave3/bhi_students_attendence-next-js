import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { getDb } from "@/lib/mongodb";
import { requireSession } from "@/lib/session";
import { buildSheetView } from "@/lib/sheetView";

import {
  newSheet,
  blankRow,
  STUDENT_ROW_FIELDS,
  isWithinAttendanceEditWindow,
  isAllowedAttendanceMonth,
} from "@/lib/dateUtils";

export async function GET() {
  const session =
    await requireSession([
      "student",
    ]);

  if (
    session instanceof NextResponse
  ) {
    return session;
  }

  try {
    const db = await getDb();

    const studentId =
      new ObjectId(session.sub);

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
          "Failed to load your sheet",
      },
      {
        status: 500,
      }
    );
  }
}

export async function PUT(
  request
) {
  const session =
    await requireSession([
      "student",
    ]);

  if (
    session instanceof NextResponse
  ) {
    return session;
  }

  const body =
    await request
      .json()
      .catch(() => ({}));

  const patch = {
    updatedAt:
      new Date().toISOString(),
  };

  try {
    const db = await getDb();

    const studentId =
      new ObjectId(session.sub);

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

    const requestedMonth =
      Number.isInteger(body.month)
        ? body.month
        : existing.month;

    const requestedYear =
      Number.isInteger(body.year)
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
      Number.isInteger(body.month)
    ) {
      patch.month = body.month;
    }

    if (
      Number.isInteger(body.year)
    ) {
      patch.year = body.year;
    }

    if (
      body.rows &&
      typeof body.rows ===
        "object"
    ) {
      const rows = {
        ...(existing.rows || {}),
      };

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
          !isWithinAttendanceEditWindow(
            iso
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

        const merged = {
          ...(rows[iso] ||
            blankRow()),
        };

        for (
          const field
          of STUDENT_ROW_FIELDS
        ) {
          if (
            field in incoming
          ) {
            merged[field] =
              incoming[field];
          }
        }

        /*
         * If the student marks themselves absent,
         * remove student attendance handwriting
         * for that day.
         *
         * Holiday remains untouched because only
         * an admin controls it.
         */
        if (
          incoming.studentAbsent === true
        ) {
          merged.startTime = "";
          merged.lunchOut = "";
          merged.lunchIn = "";
          merged.endTime = "";
          merged.studentSig = "";
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
        error:
          "Failed to save",
      },
      {
        status: 500,
      }
    );
  }
}