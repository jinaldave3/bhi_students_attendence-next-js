"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { MONTH_NAMES } from "@/lib/dateUtils";
import { useToast } from "@/components/Toast";
import AttendanceTable from "@/components/AttendanceTable";

const EDITABLE = { startTime: false, lunchOut: false, lunchIn: false, endTime: false, studentSig: false, staffSig: true, absent: false };
const SAVE_DEBOUNCE_MS = 650;

export default function TeacherStudentSheetPage({ params }) {
  const { studentId } = params;
  const showToast = useToast();
  const [sheet, setSheet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [saveState, setSaveState] = useState("idle");
  const [signing, setSigning] = useState(false);
  const saveTimer = useRef(null);
  const pendingPatch = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/sheets/${studentId}`, { cache: "no-store" });
        if (res.status === 403) { setForbidden(true); return; }
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
    if (!sheet.approvedStaffName?.trim()) {
      showToast("Add a staff name/position before signing", true);
      return;
    }
    setSigning(true);
    try {
      const res = await fetch(`/api/sheets/${studentId}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approvedStaffName: sheet.approvedStaffName,
          approvedStaffSig: sheet.approvedStaffSig,
          comments: sheet.comments,
        }),
      });
      if (!res.ok) throw new Error("sign failed");
      setSheet(await res.json());
      showToast("Sheet signed off");
    } catch (e) {
      console.error(e);
      showToast("Couldn't sign — try again", true);
    } finally {
      setSigning(false);
    }
  }

  if (loading) return <div className="app"><p className="hint">Loading…</p></div>;
  if (forbidden) {
    return (
      <div className="app">
        <div className="empty-state"><p>You don&apos;t have access to this student.</p><Link href="/teacher" className="btn btn-primary">Back to my courses</Link></div>
      </div>
    );
  }
  if (!sheet) return <div className="app"><p className="hint">Couldn't load this sheet.</p></div>;

  return (
    <div className="app">
      <div className="view-header">
        <Link href={`/teacher/courses/${sheet.courseId}`} className="back-link">&larr; {sheet.courseName}</Link>
        <div className="top-actions">
          <span className={`save-status ${saveState}`}><span className="dot" />{saveState === "saving" ? "Saving…" : "Saved"}</span>
          <a className="btn" href={`/api/sheets/${studentId}/docx`}>Download Word (.docx)</a>
        </div>
      </div>

      <div className="hero">
        <h1>{sheet.studentName}</h1>
        <p>{MONTH_NAMES[sheet.month - 1]} {sheet.year} · {sheet.courseName}</p>
      </div>

      <div className="card">
        <h2>Daily sign-in</h2>
        <AttendanceTable year={sheet.year} month={sheet.month} rows={sheet.rows} editable={EDITABLE} onChange={handleRowChange} />
        <p className="hint">You can only fill in the &ldquo;Staff sig.&rdquo; column here — the student&apos;s own times and signature come from them.</p>
      </div>

      <div className="card">
        <h2>Sign off</h2>
        <div className="field-grid">
          <div className="field"><label>Staff name / position</label><input type="text" value={sheet.approvedStaffName} onChange={(e) => handleField("approvedStaffName", e.target.value)} /></div>
          <div className="field"><label>Staff signature</label><input type="text" style={{ fontFamily: "var(--font-script)", fontSize: 18 }} placeholder="type to sign" value={sheet.approvedStaffSig} onChange={(e) => handleField("approvedStaffSig", e.target.value)} /></div>
        </div>
        <div className="field" style={{ marginTop: 14 }}>
          <label>Comments</label>
          <textarea value={sheet.comments} onChange={(e) => handleField("comments", e.target.value)} />
        </div>
        {sheet.signedAt && (
          <div className="signed-stamp">&#10003; Signed by {sheet.signedBy} on {new Date(sheet.signedAt).toLocaleString()}</div>
        )}
        <div className="form-actions">
          <button className="btn btn-primary" onClick={handleSign} disabled={signing}>{signing ? "Signing…" : sheet.signedAt ? "Re-sign" : "Sign & approve"}</button>
        </div>
      </div>
    </div>
  );
}
