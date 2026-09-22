"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { MONTH_NAMES } from "@/lib/dateUtils";
import { useToast } from "@/components/Toast";
import AttendanceTable from "@/components/AttendanceTable";

const EDITABLE = { startTime: true, lunchOut: true, lunchIn: true, endTime: true, studentSig: true, staffSig: false, absent: true };
const SAVE_DEBOUNCE_MS = 650;

export default function StudentPage() {
  const showToast = useToast();
  const [sheet, setSheet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState("idle");
  const saveTimer = useRef(null);
  const pendingPatch = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/sheets/me", { cache: "no-store" });
        if (!res.ok) throw new Error("bad response");
        setSheet(await res.json());
      } catch (e) {
        console.error(e);
        showToast("Couldn't load your sheet", true);
      } finally {
        setLoading(false);
      }
    })();
    return () => clearTimeout(saveTimer.current);
  }, [showToast]);

  const persist = useCallback(async (patch) => {
    setSaveState("saving");
    try {
      const res = await fetch("/api/sheets/me", {
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
  }, [showToast]);

  function queueSave(patch) {
    pendingPatch.current = { ...(pendingPatch.current || {}), ...patch };
    if (patch.rows) {
      pendingPatch.current.rows = { ...(pendingPatch.current.rows || {}), ...patch.rows };
    }
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

  function handleMonthYearChange(key, value) {
    setSheet((prev) => {
      const next = { ...prev, [key]: value };
      queueSave({ [key]: value });
      return next;
    });
  }

  if (loading) return <div className="app"><p className="hint">Loading…</p></div>;
  if (!sheet) return <div className="app"><p className="hint">Couldn't load your sheet.</p></div>;

  return (
    <div className="app">
      <div className="hero">
        <h1>My attendance</h1>
        <p>Fill in your times each day. Your teacher signs off separately — you won&apos;t see their signature fields here.</p>
      </div>

      <div className="view-header">
        <div />
        <div className="top-actions">
          <span className={`save-status ${saveState}`}><span className="dot" />{saveState === "saving" ? "Saving…" : "Saved"}</span>
          <Link href="/student/sheet" className="btn btn-accent">View / print sheet</Link>
        </div>
      </div>

      <div className="card">
        <h2>Your details</h2>
        <div className="field-grid">
          <div className="field"><label>Student name</label><input type="text" value={sheet.studentName} disabled /></div>
          <div className="field"><label>Course</label><input type="text" value={sheet.courseName} disabled /></div>
          <div className="field"><label>Case manager</label><input type="text" value={sheet.caseManager} disabled /></div>
          <div className="field"><label>Instructor</label><input type="text" value={sheet.instructor} disabled /></div>
        </div>
        <p className="field-hint">These are set by your admin — let them know if anything here needs correcting.</p>
      </div>

      <div className="card">
        <h2>Month</h2>
        <div className="month-row">
          <div className="field">
            <label>Month</label>
            <select value={sheet.month} onChange={(e) => handleMonthYearChange("month", parseInt(e.target.value, 10))}>
              {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div className="field" style={{ maxWidth: 120 }}>
            <label>Year</label>
            <input type="number" min="2000" max="2100" value={sheet.year} onChange={(e) => handleMonthYearChange("year", parseInt(e.target.value, 10) || sheet.year)} />
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Daily sign-in</h2>
        <AttendanceTable year={sheet.year} month={sheet.month} rows={sheet.rows} editable={EDITABLE} onChange={handleRowChange} />
        <p className="hint">Tick &ldquo;Absent&rdquo; to mark a day you weren&apos;t in. The &ldquo;Staff sig.&rdquo; column is filled in by your teacher, not you.</p>
      </div>
    </div>
  );
}
