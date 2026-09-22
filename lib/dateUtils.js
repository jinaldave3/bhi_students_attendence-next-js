// Shared date/attendance helpers — no Node-only APIs, safe to import
// from client components, API routes, or middleware.

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const WEEKDAY_NAMES = [
  "SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY",
];

export function pad2(n) {
  return String(n).padStart(2, "0");
}

export function isoDate(year, monthIndex0, day) {
  return `${year}-${pad2(monthIndex0 + 1)}-${pad2(day)}`;
}

export function displayDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${m}/${d}/${y}`;
}

export function dayNameFor(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return WEEKDAY_NAMES[new Date(y, m - 1, d).getDay()];
}

export function todayIso() {
  const now = new Date();
  return isoDate(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Every Mon–Fri date (ISO strings) in the given month. `month` is 1–12. */
export function weekdaysInMonth(year, month) {
  const out = [];
  const daysInMonth = new Date(year, month, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month - 1, d).getDay();
    if (dow >= 1 && dow <= 5) out.push(isoDate(year, month - 1, d));
  }
  return out;
}

export function blankRow() {
  return {
    startTime: "", lunchOut: "", lunchIn: "", endTime: "",
    studentSig: "", staffSig: "", absent: false,
  };
}

/** Fields the student themself is allowed to write, per day. */
export const STUDENT_ROW_FIELDS = ["startTime", "lunchOut", "lunchIn", "endTime", "studentSig", "absent"];
/** Fields only staff (teacher/admin) may write, per day. */
export const STAFF_ROW_FIELDS = ["staffSig"];

export function rowWarning(row) {
  if (!row || row.absent) return null;
  if (row.startTime && row.endTime && row.endTime <= row.startTime) return "End time is before start time";
  if (row.lunchOut && row.lunchIn && row.lunchIn < row.lunchOut) return "Lunch-in is before lunch-out";
  return null;
}

export function completionInfo(sheet) {
  const dates = weekdaysInMonth(sheet.year, sheet.month);
  const filled = dates.filter(
    (d) => sheet.rows && sheet.rows[d] && (sheet.rows[d].startTime || sheet.rows[d].absent)
  ).length;
  return { total: dates.length, filled };
}

/** 'done' | 'pending' | 'n/a' — whether today's weekday row is filled. */
export function todayStatus(sheet) {
  const t = todayIso();
  const dates = weekdaysInMonth(sheet.year, sheet.month);
  if (!dates.includes(t)) return "n/a";
  const row = sheet.rows && sheet.rows[t];
  if (row && (row.startTime || row.absent)) return "done";
  return "pending";
}

export function newSheet(overrides) {
  const now = new Date();
  const iso = now.toISOString();
  return {
    month: now.getMonth() + 1, year: now.getFullYear(),
    caseManager: "", instructor: "", startDate: "", endDate: "",
    rows: {}, approvedStaffName: "", approvedStaffSig: "", comments: "",
    signedAt: null, signedBy: null,
    createdAt: iso, updatedAt: iso,
    ...overrides,
  };
}
