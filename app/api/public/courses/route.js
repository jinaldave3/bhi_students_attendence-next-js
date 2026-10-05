import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export async function GET() {
  try {
    const db = await getDb();

    const courses = await db
      .collection("courses")
      .find({})
      .sort({ name: 1 })
      .project({
        name: 1,
        code: 1,
        duration: 1,
      })
      .toArray();

    return NextResponse.json(
      courses.map((course) => ({
        id: course._id.toString(),
        name: course.name,
        code: course.code || "",
        duration: course.duration || "",
      }))
    );
  } catch (e) {
    console.error(e);

    return NextResponse.json(
      { error: "Failed to load courses" },
      { status: 500 }
    );
  }
}