"use client";

import { weekdaysInMonth, displayDate, dayNameFor, todayIso, blankRow, rowWarning } from "@/lib/dateUtils";

/**
 * editable: { startTime, lunchOut, lunchIn, endTime, studentSig, staffSig, absent } -> booleans.
 * Whatever's false renders disabled — this is a UI convenience only;
 * the real enforcement of who can write what happens server-side in
 * the API routes, since a disabled input is trivial to bypass.
 */
export default function AttendanceTable({ year, month, rows, editable, onChange }) {
  const dates = weekdaysInMonth(year, month);
  const today = todayIso();

  return (
    <div className="table-scroll">
      <table className="att">
        <thead>
          <tr><th>Date</th><th>Start time</th><th>Lunch out</th><th>Lunch in</th><th>End time</th><th>Student sig.</th><th>Staff sig.</th><th></th></tr>
        </thead>
        <tbody>
          {dates.length === 0 ? (
            <tr><td colSpan={8} style={{ textAlign: "center", padding: 18, color: "var(--ink-faint)" }}>No weekdays in this month.</td></tr>
          ) : dates.map((iso) => {
            const row = (rows && rows[iso]) || blankRow();
            const warn = rowWarning(row);
            const isToday = iso === today;
            return (
              <tr key={iso} className={`${row.absent ? "is-absent" : ""} ${warn ? "row-warn" : ""}`}>
                <td className={`date-cell ${isToday ? "is-today" : ""}`}>
                  {displayDate(iso)}<span className="day">{dayNameFor(iso).slice(0, 3)}{isToday ? " · today" : ""}</span>
                </td>
                <td><input type="time" value={row.startTime} disabled={!editable.startTime} title={warn || undefined} onChange={(e) => onChange(iso, "startTime", e.target.value)} /></td>
                <td><input type="time" value={row.lunchOut} disabled={!editable.lunchOut} onChange={(e) => onChange(iso, "lunchOut", e.target.value)} /></td>
                <td><input type="time" value={row.lunchIn} disabled={!editable.lunchIn} onChange={(e) => onChange(iso, "lunchIn", e.target.value)} /></td>
                <td><input type="time" value={row.endTime} disabled={!editable.endTime} title={warn || undefined} onChange={(e) => onChange(iso, "endTime", e.target.value)} /></td>
                <td><input type="text" className="sig-input" placeholder="sign" value={row.studentSig} disabled={!editable.studentSig} onChange={(e) => onChange(iso, "studentSig", e.target.value)} /></td>
                <td><input type="text" className="sig-input" placeholder="sign" value={row.staffSig} disabled={!editable.staffSig} onChange={(e) => onChange(iso, "staffSig", e.target.value)} /></td>
                <td>
                  <label className="absent-toggle">
                    <input type="checkbox" checked={!!row.absent} disabled={!editable.absent} onChange={(e) => onChange(iso, "absent", e.target.checked)} /> Absent
                  </label>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
