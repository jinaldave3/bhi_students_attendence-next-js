import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireSession } from "@/lib/session";

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
    const course = await db.collection("courses").findOne({ _id: new ObjectId(params.id) });
    if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ...course, id: course._id.toString(), _id: undefined });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to load course" }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  const session = await requireSession(["admin"]);
  if (session instanceof NextResponse) return session;

  const body = await request.json().catch(() => ({}));
  const patch = { updatedAt: new Date().toISOString() };
  if (typeof body.name === "string") patch.name = body.name.trim();
  if (typeof body.duration === "string") patch.duration = body.duration.trim();
  if (typeof body.code === "string") patch.code = body.code.trim();
  if (Array.isArray(body.teacherIds)) patch.teacherIds = body.teacherIds.map((id) => new ObjectId(id));

  try {
    const db = await getDb();
    const result = await db.collection("courses").findOneAndUpdate(
      { _id: new ObjectId(params.id) },
      { $set: patch },
      { returnDocument: "after" }
    );
    if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ...result, id: result._id.toString(), _id: undefined });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to update course" }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const session = await requireSession(["admin"]);
  if (session instanceof NextResponse) return session;

  try {
    const db = await getDb();
    const courseId = new ObjectId(params.id);
    const enrolled = await db.collection("users").countDocuments({ courseId });
    if (enrolled > 0) {
      return NextResponse.json(
        { error: `${enrolled} student${enrolled === 1 ? "" : "s"} still enrolled — move or remove them first.` },
        { status: 409 }
      );
    }
    const result = await db.collection("courses").deleteOne({ _id: courseId });
    if (result.deletedCount === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to delete course" }, { status: 500 });
  }
}
