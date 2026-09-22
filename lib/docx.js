// Server-side Word (.docx) generation, matching the paper form's
// layout. `sheetView` is the flattened object the API routes build
// (student/course names joined in from the users/courses collections
// plus the sheet's own fields) — see app/api/sheets/**/docx/route.js.

import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle, ShadingType, VerticalAlign,
} from "docx";
import { MONTH_NAMES, displayDate, dayNameFor, weekdaysInMonth, blankRow } from "./dateUtils";

const PAGE_W = 12240, PAGE_H = 15840, MARGIN = 1080; // US Letter, DXA
const USABLE = PAGE_W - MARGIN * 2;
const THIN = { style: BorderStyle.SINGLE, size: 4, color: "16202A" };
const BORDERS = { top: THIN, bottom: THIN, left: THIN, right: THIN };

function infoCell(text, width, { label = false } = {}) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: BORDERS,
    shading: label ? { type: ShadingType.CLEAR, fill: "F1EEE6" } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 90, right: 90 },
    children: [new Paragraph({ children: [new TextRun({ text: text || "", bold: label, size: 20 })] })],
  });
}

export async function buildAttendanceDocx(sheetView) {
  const infoColW = [1815, 3225, 1815, 3225];
  const infoTable = new Table({
    width: { size: USABLE, type: WidthType.DXA },
    columnWidths: infoColW,
    rows: [
      new TableRow({ children: [
        infoCell("Student name:", infoColW[0], { label: true }), infoCell(sheetView.studentName, infoColW[1]),
        infoCell("Course name:", infoColW[2], { label: true }), infoCell(sheetView.courseName, infoColW[3]),
      ] }),
      new TableRow({ children: [
        infoCell("Course duration:", infoColW[0], { label: true }), infoCell(sheetView.courseDuration, infoColW[1]),
        infoCell("Course code:", infoColW[2], { label: true }), infoCell(sheetView.courseCode, infoColW[3]),
      ] }),
      new TableRow({ children: [
        infoCell("Case manager:", infoColW[0], { label: true }), infoCell(sheetView.caseManager, infoColW[1]),
        infoCell("Start date:", infoColW[2], { label: true }), infoCell(sheetView.startDate ? displayDate(sheetView.startDate) : "", infoColW[3]),
      ] }),
      new TableRow({ children: [
        infoCell("Instructor:", infoColW[0], { label: true }), infoCell(sheetView.instructor, infoColW[1]),
        infoCell("End date:", infoColW[2], { label: true }), infoCell(sheetView.endDate ? displayDate(sheetView.endDate) : "", infoColW[3]),
      ] }),
    ],
  });

  const dates = weekdaysInMonth(sheetView.year, sheetView.month);
  const attColW = [1200, 1050, 1080, 1080, 1080, 1080, 1755, 1755];
  const headerRow = new TableRow({
    tableHeader: true,
    children: ["Day", "Date", "Start", "Lunch out", "Lunch in", "End", "Student sig.", "Staff sig."].map((t, i) =>
      new TableCell({
        width: { size: attColW[i], type: WidthType.DXA },
        borders: BORDERS,
        shading: { type: ShadingType.CLEAR, fill: "E7E1D2" },
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 50, bottom: 50, left: 60, right: 60 },
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: t, bold: true, size: 16 })] })],
      })
    ),
  });

  const dayRows = dates.map((iso) => {
    const row = (sheetView.rows && sheetView.rows[iso]) || blankRow();
    const dayLabel = dayNameFor(iso);
    const dayShort = dayLabel[0] + dayLabel.slice(1).toLowerCase();
    const values = row.absent
      ? [dayShort, displayDate(iso), "ABSENT", "", "", "", row.studentSig || "", row.staffSig || ""]
      : [dayShort, displayDate(iso), row.startTime || "—", row.lunchOut || "—", row.lunchIn || "—", row.endTime || "—", row.studentSig || "", row.staffSig || ""];
    return new TableRow({
      children: values.map((val, i) =>
        new TableCell({
          width: { size: attColW[i], type: WidthType.DXA },
          borders: BORDERS,
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 40, bottom: 40, left: 60, right: 60 },
          children: [new Paragraph({
            alignment: i <= 1 ? AlignmentType.LEFT : AlignmentType.CENTER,
            children: [new TextRun({ text: String(val), size: 16, italics: row.absent, color: row.absent ? "A83A3A" : "16202A" })],
          })],
        })
      ),
    });
  });

  const attTable = new Table({ width: { size: USABLE, type: WidthType.DXA }, columnWidths: attColW, rows: [headerRow, ...dayRows] });

  const doc = new Document({
    sections: [{
      properties: { page: { size: { width: PAGE_W, height: PAGE_H }, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } } },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER, spacing: { after: 200 }, border: BORDERS,
          children: [new TextRun({ text: "INDIVIDUAL STUDENT ATTENDANCE SHEET", bold: true, size: 26 })],
        }),
        infoTable,
        new Paragraph({
          spacing: { before: 200, after: 200 }, alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: `MONTH: ${MONTH_NAMES[sheetView.month - 1]}    YEAR: ${sheetView.year}`, bold: true, size: 22 })],
        }),
        attTable,
        new Paragraph({ spacing: { before: 260 }, children: [new TextRun({ text: "Approved by:", bold: true, underline: {}, size: 20 })] }),
        new Paragraph({ spacing: { before: 160 }, children: [
          new TextRun({ text: "Staff name/position: ", size: 20 }),
          new TextRun({ text: sheetView.approvedStaffName || "________________________", size: 20 }),
        ] }),
        new Paragraph({ spacing: { before: 120 }, children: [
          new TextRun({ text: "Staff signature: ", size: 20 }),
          new TextRun({ text: sheetView.approvedStaffSig || "________________________", size: 20, italics: !!sheetView.approvedStaffSig }),
        ] }),
        new Paragraph({ spacing: { before: 160 }, children: [
          new TextRun({ text: "Comments: ", size: 20 }),
          new TextRun({ text: sheetView.comments || "", size: 20 }),
        ] }),
      ],
    }],
  });

  return Packer.toBuffer(doc);
}
