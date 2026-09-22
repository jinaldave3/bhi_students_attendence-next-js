import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireSession } from "@/lib/session";
import { buildSheetView } from "@/lib/sheetView";

async function canAccessStudent(db, session, studentId) {
  if (session.role === "admin") return true;
  if (session.role !== "teacher") return false;
  const student = await db.collection("users").findOne({ _id: new ObjectId(studentId) });
  if (!student || !student.courseId) return false;
  return (session.courseIds || []).includes(student.courseId.toString());
}

// Convenience action for a teacher/admin's final sign-off — sets the
// approval block and stamps who signed and when, in one call, rather
// than making the reviewer save the approval fields separately.
export async function POST(request, { params }) {
  const session = await requireSession(["admin", "teacher"]);
  if (session instanceof NextResponse) return session;

  const body = await request.json().catch(() => ({}));

  try {
    const db = await getDb();
    if (!(await canAccessStudent(db, session, params.studentId))) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }
    const studentId = new ObjectId(params.studentId);
    const now = new Date().toISOString();
    const patch = {
      updatedAt: now,
      signedAt: now,
      signedBy: session.name,
      approvedStaffName: (body.approvedStaffName || session.name || "").trim(),
      approvedStaffSig: (body.approvedStaffSig || session.name || "").trim(),
    };
    if (typeof body.comments === "string") patch.comments = body.comments;

    const result = await db.collection("sheets").findOneAndUpdate(
      { _id: studentId },
      { $set: patch },
      { returnDocument: "after" }
    );
    if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(await buildSheetView(db, result));
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to sign" }, { status: 500 });
  }
}
