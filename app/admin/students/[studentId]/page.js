"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { MONTH_NAMES } from "@/lib/dateUtils";
import { useToast } from "@/components/Toast";
import AttendanceTable from "@/components/AttendanceTable";

const EDITABLE = { startTime: true, lunchOut: true, lunchIn: true, endTime: true, studentSig: true, staffSig: true, absent: true };
const SAVE_DEBOUNCE_MS = 650;

export default function AdminStudentSheetPage({ params }) {
  const { studentId } = params;
  const showToast = useToast();
  const [sheet, setSheet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState("idle");
  const [signing, setSigning] = useState(false);
  const saveTimer = useRef(null);
  const pendingPatch = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/sheets/${studentId}`, { cache: "no-store" });
        if (!res.ok) throw new Error("bad response");
        setSheet(await res.json());
      } catch (e) {
        console.error(e);
        showToast("Couldn't load this sheet", true);
      } finally {
        setLoading(false);
      }
    })();
    return () => clearTimeout(saveTimer.current);
  }, [studentId, showToast]);

  const persist = useCallback(async (patch) => {
    setSaveState("saving");
    try {
      const res = await fetch(`/api/sheets/${studentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("save failed");
      setSaveState("saved");
    } catch (e) {
      console.error(e);
      setSaveState("idle");
      showToast("Couldn't save — check your connection", true);
    }
  }, [studentId, showToast]);

  function queueSave(patch) {
    pendingPatch.current = { ...(pendingPatch.current || {}), ...patch };
    if (patch.rows) pendingPatch.current.rows = { ...(pendingPatch.current.rows || {}), ...patch.rows };
    setSaveState("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const p = pendingPatch.current;
      pendingPatch.current = null;
      persist(p);
    }, SAVE_DEBOUNCE_MS);
  }

  function handleRowChange(iso, field, value) {
    setSheet((prev) => {
      const rows = { ...(prev.rows || {}) };
      rows[iso] = { ...(rows[iso] || {}), [field]: value };
      queueSave({ rows: { [iso]: { [field]: value } } });
      return { ...prev, rows };
    });
  }

  function handleField(key, value) {
    setSheet((prev) => {
      const next = { ...prev, [key]: value };
      queueSave({ [key]: value });
      return next;
    });
  }

  async function handleSign() {
    setSigning(true);
    try {
      const res = await fetch(`/api/sheets/${studentId}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvedStaffName: sheet.approvedStaffName, approvedStaffSig: sheet.approvedStaffSig, comments: sheet.comments }),
      });
      if (!res.ok) throw new Error("sign failed");
      setSheet(await res.json());
      showToast("Sheet signed off");
    } catch (e) {
      showToast("Couldn't sign — try again", true);
    } finally {
      setSigning(false);
    }
  }

  if (loading) return <div className="app"><p className="hint">Loading…</p></div>;
  if (!sheet) return <div className="app"><p className="hint">Couldn't load this sheet.</p></div>;

  return (
    <div className="app">
      <div className="view-header">
        <Link href={sheet.courseId ? `/admin/courses/${sheet.courseId}` : "/admin/courses"} className="back-link">&larr; {sheet.courseName || "Course"}</Link>
        <div className="top-actions">
          <span className={`save-status ${saveState}`}><span className="dot" />{saveState === "saving" ? "Saving…" : "Saved"}</span>
          <a className="btn" href={`/api/sheets/${studentId}/docx`}>Download Word (.docx)</a>
        </div>
      </div>

      <div className="hero"><h1>{sheet.studentName}</h1><p>Admin view — every field here is editable, for corrections.</p></div>

      <div className="card">
        <h2>Enrollment details</h2>
        <div className="field-grid">
          <div className="field"><label>Case manager</label><input type="text" value={sheet.caseManager} onChange={(e) => handleField("caseManager", e.target.value)} /></div>
          <div className="field"><label>Instructor</label><input type="text" value={sheet.instructor} onChange={(e) => handleField("instructor", e.target.value)} /></div>
          <div className="field"><label>Start date</label><input type="date" value={sheet.startDate || ""} onChange={(e) => handleField("startDate", e.target.value)} /></div>
          <div className="field"><label>End date</label><input type="date" value={sheet.endDate || ""} onChange={(e) => handleField("endDate", e.target.value)} /></div>
        </div>
      </div>

      <div className="card">
        <h2>Month</h2>
        <div className="month-row">
          <div className="field">
            <label>Month</label>
            <select value={sheet.month} onChange={(e) => handleField("month", parseInt(e.target.value, 10))}>
              {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div className="field" style={{ maxWidth: 120 }}>
            <label>Year</label>
            <input type="number" min="2000" max="2100" value={sheet.year} onChange={(e) => handleField("year", parseInt(e.target.value, 10) || sheet.year)} />
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Daily sign-in</h2>
        <AttendanceTable year={sheet.year} month={sheet.month} rows={sheet.rows} editable={EDITABLE} onChange={handleRowChange} />
      </div>

      <div className="card">
        <h2>Sign off</h2>
        <div className="field-grid">
          <div className="field"><label>Staff name / position</label><input type="text" value={sheet.approvedStaffName} onChange={(e) => handleField("approvedStaffName", e.target.value)} /></div>
          <div className="field"><label>Staff signature</label><input type="text" style={{ fontFamily: "var(--font-script)", fontSize: 18 }} value={sheet.approvedStaffSig} onChange={(e) => handleField("approvedStaffSig", e.target.value)} /></div>
        </div>
        <div className="field" style={{ marginTop: 14 }}>
          <label>Comments</label>
          <textarea value={sheet.comments} onChange={(e) => handleField("comments", e.target.value)} />
        </div>
        {sheet.signedAt && <div className="signed-stamp">&#10003; Signed by {sheet.signedBy} on {new Date(sheet.signedAt).toLocaleString()}</div>}
        <div className="form-actions"><button className="btn btn-primary" onClick={handleSign} disabled={signing}>{signing ? "Signing…" : sheet.signedAt ? "Re-sign" : "Sign & approve"}</button></div>
      </div>
    </div>
  );
}
