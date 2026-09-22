import { MONTH_NAMES, weekdaysInMonth, displayDate, dayNameFor, blankRow } from "@/lib/dateUtils";

export default function SheetDocument({ sheet }) {
  const dates = weekdaysInMonth(sheet.year, sheet.month);
  return (
    <div className="sheet">
      <h1 className="sheet-title">Individual Student Attendance Sheet</h1>
      <table className="info">
        <tbody>
          <tr><td className="k">Student name:</td><td className="v">{sheet.studentName || "\u00A0"}</td><td className="k">Course name:</td><td className="v">{sheet.courseName || "\u00A0"}</td></tr>
          <tr><td className="k">Course duration:</td><td className="v">{sheet.courseDuration || "\u00A0"}</td><td className="k">Course code:</td><td className="v">{sheet.courseCode || "\u00A0"}</td></tr>
          <tr><td className="k">Case manager:</td><td className="v">{sheet.caseManager || "\u00A0"}</td><td className="k">Start date:</td><td className="v">{sheet.startDate ? displayDate(sheet.startDate) : "\u00A0"}</td></tr>
          <tr><td className="k">Instructor:</td><td className="v">{sheet.instructor || "\u00A0"}</td><td className="k">End date:</td><td className="v">{sheet.endDate ? displayDate(sheet.endDate) : "\u00A0"}</td></tr>
        </tbody>
      </table>

      <div className="month-year-line">MONTH: <span>{MONTH_NAMES[sheet.month - 1]}</span> &nbsp; YEAR: <span>{sheet.year}</span></div>

      <table className="sheet-att">
        <thead>
          <tr><th>Day</th><th>Date</th><th>Start time</th><th>Lunch out</th><th>Lunch in</th><th>End time</th><th>Student signature</th><th>Staff signature</th></tr>
        </thead>
        <tbody>
          {dates.map((iso) => {
            const row = (sheet.rows && sheet.rows[iso]) || blankRow();
            if (row.absent) {
              return (
                <tr key={iso} className="absent-row">
                  <td className="day-cell">{dayNameFor(iso)}</td><td>{displayDate(iso)}</td>
                  <td colSpan={4}>ABSENT</td>
                  <td className="sig-cell">{row.studentSig}</td>
                  <td className="sig-cell">{row.staffSig}</td>
                </tr>
              );
            }
            return (
              <tr key={iso}>
                <td className="day-cell">{dayNameFor(iso)}</td><td>{displayDate(iso)}</td>
                <td>{row.startTime || "—"}</td><td>{row.lunchOut || "—"}</td><td>{row.lunchIn || "—"}</td><td>{row.endTime || "—"}</td>
                <td className="sig-cell">{row.studentSig}</td>
                <td className="sig-cell">{row.staffSig}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="approved-block">
        <div className="row" style={{ marginTop: 14, fontWeight: 700, textDecoration: "underline" }}>Approved by:</div>
        <div className="row">
          <span>Staff name/position: <span className="plain-line">{sheet.approvedStaffName || "\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0"}</span></span>
          <span>Staff signature: <span className="sig-line">{sheet.approvedStaffSig || "\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0"}</span></span>
        </div>
        <div className="comments-line">Comments: <span className="fill">{sheet.comments || "\u00A0"}</span></div>
        {sheet.signedAt && (
          <div className="signed-stamp">&#10003; Signed by {sheet.signedBy} on {new Date(sheet.signedAt).toLocaleString()}</div>
        )}
      </div>
    </div>
  );
}
