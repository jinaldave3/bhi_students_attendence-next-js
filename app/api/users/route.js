import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireSession } from "@/lib/session";
import { hashPassword } from "@/lib/auth";

export async function GET(request) {
  const session = await requireSession(["admin"]);
  if (session instanceof NextResponse) return session;

  const role = request.nextUrl.searchParams.get("role");
  try {
    const db = await getDb();
    const filter = role ? { role } : {};
    const users = await db.collection("users").find(filter).sort({ name: 1 }).toArray();
    return NextResponse.json(users.map((u) => ({
      id: u._id.toString(),
      name: u.name,
      username: u.username,
      role: u.role,
      courseId: u.courseId ? u.courseId.toString() : undefined,
      courseIds: Array.isArray(u.courseIds) ? u.courseIds.map(String) : undefined,
    })));
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to load users" }, { status: 500 });
  }
}

// Creates a teacher (or another admin) account. Students are created
// via POST /api/courses/[id]/students instead, since a student
// always needs a course assigned at creation time.
export async function POST(request) {
  const session = await requireSession(["admin"]);
  if (session instanceof NextResponse) return session;

  const body = await request.json().catch(() => ({}));
  const name = (body.name || "").trim();
  const username = (body.username || "").trim().toLowerCase();
  const password = body.password || "";
  const role = body.role === "admin" ? "admin" : "teacher";
  const courseIds = Array.isArray(body.courseIds) ? body.courseIds.filter(Boolean).map((id) => new ObjectId(id)) : [];

  if (!name || !username || !password) {
    return NextResponse.json({ error: "Name, username, and password are required" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  try {
    const db = await getDb();
    const now = new Date().toISOString();
    const passwordHash = await hashPassword(password);
    const doc = { name, username, passwordHash, role, courseIds, createdAt: now, updatedAt: now };
    const result = await db.collection("users").insertOne(doc);
    return NextResponse.json({ id: result.insertedId.toString(), name, username, role }, { status: 201 });
  } catch (e) {
    if (e?.code === 11000) {
      return NextResponse.json({ error: "That username is already taken" }, { status: 409 });
    }
    console.error(e);
    return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
  }
}
