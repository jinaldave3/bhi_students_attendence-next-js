import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireSession } from "@/lib/session";
import { buildSheetView } from "@/lib/sheetView";
import { newSheet, blankRow, STUDENT_ROW_FIELDS } from "@/lib/dateUtils";

export async function GET() {
  const session = await requireSession(["student"]);
  if (session instanceof NextResponse) return session;

  try {
    const db = await getDb();
    const studentId = new ObjectId(session.sub);
    let sheet = await db.collection("sheets").findOne({ _id: studentId });
    if (!sheet) {
      const student = await db.collection("users").findOne({ _id: studentId });
      sheet = newSheet({ _id: studentId, studentId, courseId: student?.courseId || null });
      await db.collection("sheets").insertOne(sheet);
    }
    return NextResponse.json(await buildSheetView(db, sheet));
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to load your sheet" }, { status: 500 });
  }
}

// Students can only ever change their own row fields (times,
// signature, absent) and which month/year they're filling in — never
// staffSig or the approval block. Enforced server-side, not just
// hidden in the UI.
export async function PUT(request) {
  const session = await requireSession(["student"]);
  if (session instanceof NextResponse) return session;

  const body = await request.json().catch(() => ({}));
  const patch = { updatedAt: new Date().toISOString() };
  if (Number.isInteger(body.month) && body.month >= 1 && body.month <= 12) patch.month = body.month;
  if (Number.isInteger(body.year) && body.year >= 2000 && body.year <= 2100) patch.year = body.year;

  try {
    const db = await getDb();
    const studentId = new ObjectId(session.sub);
    const existing = await db.collection("sheets").findOne({ _id: studentId });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (body.rows && typeof body.rows === "object") {
      const rows = { ...(existing.rows || {}) };
      for (const [iso, incoming] of Object.entries(body.rows)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) continue;
        const merged = { ...(rows[iso] || blankRow()) };
        for (const field of STUDENT_ROW_FIELDS) {
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
