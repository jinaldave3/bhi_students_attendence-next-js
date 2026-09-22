import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireSession } from "@/lib/session";

export async function GET() {
  const session = await requireSession(["admin", "teacher"]);
  if (session instanceof NextResponse) return session;

  try {
    const db = await getDb();
    const filter = session.role === "teacher"
      ? { _id: { $in: (session.courseIds || []).map((id) => new ObjectId(id)) } }
      : {};
    const courses = await db.collection("courses").find(filter).sort({ name: 1 }).toArray();
    return NextResponse.json(courses.map((c) => ({ ...c, id: c._id.toString(), _id: undefined })));
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to load courses" }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await requireSession(["admin"]);
  if (session instanceof NextResponse) return session;

  const body = await request.json().catch(() => ({}));
  const name = (body.name || "").trim();
  const code = (body.code || "").trim();
  const duration = (body.duration || "").trim();
  if (!name) return NextResponse.json({ error: "Course name is required" }, { status: 400 });

  try {
    const db = await getDb();
    const now = new Date().toISOString();
    const doc = { name, duration, teacherIds: [], createdAt: now, updatedAt: now };
    if (code) doc.code = code; // omit (not empty-string) so the sparse unique index only applies when a code is actually set
    const result = await db.collection("courses").insertOne(doc);
    return NextResponse.json({ ...doc, id: result.insertedId.toString() }, { status: 201 });
  } catch (e) {
    if (e?.code === 11000) {
      return NextResponse.json({ error: "A course with that code already exists" }, { status: 409 });
    }
    console.error(e);
    return NextResponse.json({ error: "Failed to create course" }, { status: 500 });
  }
}
