// Shared date/attendance helpers — no Node-only APIs, safe to import
// from client components, API routes, or middleware.

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const WEEKDAY_NAMES = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
];

// Temporary development/testing start date.
export const ATTENDANCE_START_DATE = "2026-10-05";

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

  return isoDate(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );
}

export function weekdaysInMonth(year, month) {
  const out = [];
  const daysInMonth = new Date(year, month, 0).getDate();

  for (let d = 1; d <= daysInMonth; d++) {
    out.push(isoDate(year, month - 1, d));
  }

  return out;
}

export function blankRow() {
  return {
    startTime: "",
    lunchOut: "",
    lunchIn: "",
    endTime: "",
    studentSig: "",
    staffSig: "",

    // Existing field:
    // "absent" represents an ADMIN-CONTROLLED HOLIDAY.
    absent: false,

    holidayNote: "",

    // Student-controlled absence.
    studentAbsent: false,
  };
}

/**
 * Fields students may change during their 7-day editing window.
 *
 * Holiday ("absent") and holidayNote are NOT included because
 * those remain admin-controlled.
 */
export const STUDENT_ROW_FIELDS = [
  "startTime",
  "lunchOut",
  "lunchIn",
  "endTime",
  "studentSig",
  "studentAbsent",
];

/** Fields instructors may write per day. */
export const STAFF_ROW_FIELDS = ["staffSig"];

export function rollingWindowStart(referenceIso = todayIso()) {
  const [year, month, day] = referenceIso
    .split("-")
    .map(Number);

  const date = new Date(year, month - 1, day);

  // Today + previous 6 calendar days = 7 days total.
  date.setDate(date.getDate() - 6);

  const calculated = isoDate(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );

  return calculated < ATTENDANCE_START_DATE
    ? ATTENDANCE_START_DATE
    : calculated;
}

export function isWithinAttendanceEditWindow(
  iso,
  referenceIso = todayIso()
) {
  if (!iso) return false;

  const earliest = rollingWindowStart(referenceIso);

  return iso >= earliest && iso <= referenceIso;
}

export function isBeforeAttendanceStart(iso) {
  return iso < ATTENDANCE_START_DATE;
}

export function isFutureDate(
  iso,
  referenceIso = todayIso()
) {
  return iso > referenceIso;
}

export function isAllowedAttendanceMonth(year, month) {
  if (year < 2026) return false;
  if (year === 2026 && month < 10) return false;

  return (
    Number.isInteger(year) &&
    Number.isInteger(month) &&
    month >= 1 &&
    month <= 12 &&
    year <= 2100
  );
}

export function rowWarning(row) {
  if (!row || row.absent || row.studentAbsent) {
    return null;
  }

  return null;
}

export function completionInfo(sheet) {
  const dates = weekdaysInMonth(
    sheet.year,
    sheet.month
  );

  const filled = dates.filter(
    (d) =>
      sheet.rows &&
      sheet.rows[d] &&
      (
        sheet.rows[d].startTime ||
        sheet.rows[d].absent ||
        sheet.rows[d].studentAbsent
      )
  ).length;

  return {
    total: dates.length,
    filled,
  };
}

export function todayStatus(sheet) {
  const t = todayIso();

  const dates = weekdaysInMonth(
    sheet.year,
    sheet.month
  );

  if (!dates.includes(t)) return "n/a";

  const row =
    sheet.rows && sheet.rows[t];

  if (
    row &&
    (
      row.startTime ||
      row.absent ||
      row.studentAbsent
    )
  ) {
    return "done";
  }

  return "pending";
}

export function newSheet(overrides) {
  const now = new Date();
  const iso = now.toISOString();

  return {
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    caseManager: "",
    instructor: "",
    startDate: "",
    endDate: "",
    rows: {},
    approvedStaffName: "",
    approvedStaffSig: "",
    comments: "",
    signedAt: null,
    signedBy: null,
    createdAt: iso,
    updatedAt: iso,
    ...overrides,
  };
}