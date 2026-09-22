import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireSession } from "@/lib/session";
import { buildSheetView } from "@/lib/sheetView";
import { buildAttendanceDocx } from "@/lib/docx";

function safeFilename(name) {
  return (name || "attendance").replace(/[^a-z0-9\-_ ]/gi, "").trim().replace(/\s+/g, "_") || "attendance";
}

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
    const sheet = await db.collection("sheets").findOne({ _id: new ObjectId(params.studentId) });
    if (!sheet) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const view = await buildSheetView(db, sheet);
    const buffer = await buildAttendanceDocx(view);
    const filename = `${safeFilename(view.studentName)}_${view.month}_${view.year}.docx`;
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to build Word document" }, { status: 500 });
  }
}
