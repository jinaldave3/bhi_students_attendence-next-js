import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requireSession } from "@/lib/session";
import { completionInfo, todayStatus } from "@/lib/dateUtils";

export async function GET() {
  const session = await requireSession(["admin"]);
  if (session instanceof NextResponse) return session;

  try {
    const db = await getDb();
    const [courses, students, sheets, teachers] = await Promise.all([
      db.collection("courses").find({}).sort({ name: 1 }).toArray(),
      db.collection("users").find({ role: "student" }).toArray(),
      db.collection("sheets").find({}).toArray(),
      db.collection("users").find({ role: "teacher" }).toArray(),
    ]);

    const sheetByStudent = new Map(sheets.map((s) => [s.studentId.toString(), s]));
    const studentsByCourse = new Map();
    for (const s of students) {
      const key = s.courseId ? s.courseId.toString() : "none";
      if (!studentsByCourse.has(key)) studentsByCourse.set(key, []);
      studentsByCourse.get(key).push(s);
    }

    let totalPendingToday = 0;
    let totalComplete = 0;

    const courseSummaries = courses.map((c) => {
      const courseStudents = studentsByCourse.get(c._id.toString()) || [];
      let pendingToday = 0;
      let complete = 0;
      for (const s of courseStudents) {
        const sheet = sheetByStudent.get(s._id.toString());
        if (!sheet) continue;
        if (todayStatus(sheet) === "pending") pendingToday++;
        const info = completionInfo(sheet);
        if (info.total > 0 && info.filled === info.total) complete++;
      }
      totalPendingToday += pendingToday;
      totalComplete += complete;
      return {
        id: c._id.toString(),
        name: c.name,
        code: c.code || "",
        teacherCount: (c.teacherIds || []).length,
        studentCount: courseStudents.length,
        pendingToday,
        complete,
      };
    });

    return NextResponse.json({
      totals: {
        courses: courses.length,
        students: students.length,
        teachers: teachers.length,
        pendingToday: totalPendingToday,
        complete: totalComplete,
      },
      courses: courseSummaries,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to load overview" }, { status: 500 });
  }
}
