// Joins a raw sheet document with its student's and course's names,
// for API responses and for docx generation. Never returns the raw
// Mongo _id/ObjectId types to the client — everything is stringified.

export async function buildSheetView(db, sheet) {
  const [student, course] = await Promise.all([
    db.collection("users").findOne({ _id: sheet.studentId }),
    sheet.courseId ? db.collection("courses").findOne({ _id: sheet.courseId }) : null,
  ]);
  return {
    ...sheet,
    id: sheet._id.toString(),
    studentId: sheet.studentId.toString(),
    courseId: sheet.courseId ? sheet.courseId.toString() : null,
    studentName: student?.name || "",
    courseName: course?.name || "",
    courseCode: course?.code || "",
    courseDuration: course?.duration || "",
    _id: undefined,
  };
}
