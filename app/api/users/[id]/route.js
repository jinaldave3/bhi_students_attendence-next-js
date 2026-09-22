import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireSession } from "@/lib/session";
import { hashPassword } from "@/lib/auth";

export async function PUT(request, { params }) {
  const session = await requireSession(["admin"]);
  if (session instanceof NextResponse) return session;

  const body = await request.json().catch(() => ({}));
  const patch = { updatedAt: new Date().toISOString() };
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim();
  if (Array.isArray(body.courseIds)) patch.courseIds = body.courseIds.filter(Boolean).map((id) => new ObjectId(id));
  if (typeof body.password === "string" && body.password) {
    if (body.password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }
    patch.passwordHash = await hashPassword(body.password);
  }

  try {
    const db = await getDb();
    const result = await db.collection("users").findOneAndUpdate(
      { _id: new ObjectId(params.id) },
      { $set: patch },
      { returnDocument: "after" }
    );
    if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ id: result._id.toString(), name: result.name, username: result.username, role: result.role });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to update account" }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const session = await requireSession(["admin"]);
  if (session instanceof NextResponse) return session;

  if (params.id === session.sub) {
    return NextResponse.json({ error: "You can't delete your own account while signed in as it" }, { status: 400 });
  }

  try {
    const db = await getDb();
    const userId = new ObjectId(params.id);
    const user = await db.collection("users").findOne({ _id: userId });
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await db.collection("users").deleteOne({ _id: userId });
    if (user.role === "student") {
      await db.collection("sheets").deleteOne({ _id: userId });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }
}
