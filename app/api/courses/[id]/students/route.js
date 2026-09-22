import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireSession } from "@/lib/session";
import { hashPassword } from "@/lib/auth";
import { newSheet, completionInfo, todayStatus } from "@/lib/dateUtils";

function canAccessCourse(session, courseId) {
  if (session.role === "admin") return true;
  if (session.role === "teacher") return (session.courseIds || []).includes(courseId);
  return false;
}

export async function GET(request, { params }) {
  const session = await requireSession(["admin", "teacher"]);
  if (session instanceof NextResponse) return session;
  if (!canAccessCourse(session, params.id)) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  try {
    const db = await getDb();
    const courseId = new ObjectId(params.id);
    const students = await db.collection("users").find({ role: "student", courseId }).sort({ name: 1 }).toArray();
    const sheets = await db.collection("sheets").find({ studentId: { $in: students.map((s) => s._id) } }).toArray();
    const sheetByStudent = new Map(sheets.map((s) => [s.studentId.toString(), s]));

    const out = students.map((s) => {
      const sheet = sheetByStudent.get(s._id.toString()) || newSheet();
      return {
        id: s._id.toString(),
        name: s.name,
        username: s.username,
        month: sheet.month,
        year: sheet.year,
        ...completionInfoWithLabel(sheet),
        todayStatus: todayStatus(sheet),
        signed: !!sheet.signedAt,
        updatedAt: sheet.updatedAt,
      };
    });
    return NextResponse.json(out);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to load students" }, { status: 500 });
  }
}

function completionInfoWithLabel(sheet) {
  const info = completionInfo(sheet);
  return { daysFilled: info.filled, daysTotal: info.total };
}

// Admin creates a student account AND enrolls them in this course in
// one step — separate account-creation and enrollment steps would
// just be extra clicks for the same result.
export async function POST(request, { params }) {
  const session = await requireSession(["admin"]);
  if (session instanceof NextResponse) return session;

  const body = await request.json().catch(() => ({}));
  const name = (body.name || "").trim();
  const username = (body.username || "").trim().toLowerCase();
  const password = body.password || "";
  if (!name || !username || !password) {
    return NextResponse.json({ error: "Name, username, and password are required" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  try {
    const db = await getDb();
    const courseId = new ObjectId(params.id);
    const course = await db.collection("courses").findOne({ _id: courseId });
    if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });

    const now = new Date().toISOString();
    const passwordHash = await hashPassword(password);
    const userDoc = { name, username, passwordHash, role: "student", courseId, createdAt: now, updatedAt: now };
    const result = await db.collection("users").insertOne(userDoc);

    const sheet = newSheet({
      _id: result.insertedId,
      studentId: result.insertedId,
      courseId,
      caseManager: body.caseManager || "",
      instructor: body.instructor || "",
      startDate: body.startDate || "",
      endDate: body.endDate || "",
    });
    await db.collection("sheets").insertOne(sheet);

    return NextResponse.json({ id: result.insertedId.toString(), name, username, role: "student" }, { status: 201 });
  } catch (e) {
    if (e?.code === 11000) {
      return NextResponse.json({ error: "That username is already taken" }, { status: 409 });
    }
    console.error(e);
    return NextResponse.json({ error: "Failed to create student" }, { status: 500 });
  }
}
