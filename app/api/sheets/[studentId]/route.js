import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireSession } from "@/lib/session";
import { buildSheetView } from "@/lib/sheetView";
import { newSheet, blankRow } from "@/lib/dateUtils";

async function canAccessStudent(db, session, studentId) {
  if (session.role === "admin") return true;
  if (session.role !== "teacher") return false;
  const student = await db.collection("users").findOne({ _id: new ObjectId(studentId) });
  if (!student || !student.courseId) return false;
  return (session.courseIds || []).includes(student.courseId.toString());
}

export async function GET(request, { params }) {
  const session = await requireSession(["admin", "teacher"]);
  if (session instanceof NextResponse) return session;

  try {
    const db = await getDb();
    if (!(await canAccessStudent(db, session, params.studentId))) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }
    const studentId = new ObjectId(params.studentId);
    let sheet = await db.collection("sheets").findOne({ _id: studentId });
    if (!sheet) {
      const student = await db.collection("users").findOne({ _id: studentId });
      sheet = newSheet({ _id: studentId, studentId, courseId: student?.courseId || null });
      await db.collection("sheets").insertOne(sheet);
    }
    return NextResponse.json(await buildSheetView(db, sheet));
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to load sheet" }, { status: 500 });
  }
}

// Teachers may only fill in staffSig per day, plus the approval
// block (name/signature/comments). Admins may edit everything,
// including the student's own row fields and enrollment info — for
// corrections. Enforced here, not just in the UI.
export async function PUT(request, { params }) {
  const session = await requireSession(["admin", "teacher"]);
  if (session instanceof NextResponse) return session;

  const body = await request.json().catch(() => ({}));

  try {
    const db = await getDb();
    if (!(await canAccessStudent(db, session, params.studentId))) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }
    const studentId = new ObjectId(params.studentId);
    const existing = await db.collection("sheets").findOne({ _id: studentId });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const isAdmin = session.role === "admin";
    const patch = { updatedAt: new Date().toISOString() };

    if (isAdmin) {
      if (Number.isInteger(body.month) && body.month >= 1 && body.month <= 12) patch.month = body.month;
      if (Number.isInteger(body.year) && body.year >= 2000 && body.year <= 2100) patch.year = body.year;
      if (typeof body.caseManager === "string") patch.caseManager = body.caseManager;
      if (typeof body.instructor === "string") patch.instructor = body.instructor;
      if (typeof body.startDate === "string") patch.startDate = body.startDate;
      if (typeof body.endDate === "string") patch.endDate = body.endDate;
    }

    if (typeof body.approvedStaffName === "string") patch.approvedStaffName = body.approvedStaffName;
    if (typeof body.approvedStaffSig === "string") patch.approvedStaffSig = body.approvedStaffSig;
    if (typeof body.comments === "string") patch.comments = body.comments;

    if (body.rows && typeof body.rows === "object") {
      const rows = { ...(existing.rows || {}) };
      const allowedFields = isAdmin
        ? ["startTime", "lunchOut", "lunchIn", "endTime", "studentSig", "absent", "staffSig"]
        : ["staffSig"];
      for (const [iso, incoming] of Object.entries(body.rows)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) continue;
        const merged = { ...(rows[iso] || blankRow()) };
        for (const field of allowedFields) {
          if (field in incoming) merged[field] = incoming[field];
        }
        rows[iso] = merged;
      }
      patch.rows = rows;
    }

    const result = await db.collection("sheets").findOneAndUpdate(
      { _id: studentId },
      { $set: patch },
      { returnDocument: "after" }
    );
    return NextResponse.json(await buildSheetView(db, result));
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
