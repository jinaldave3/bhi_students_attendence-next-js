"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SheetDocument from "@/components/SheetDocument";
import { useToast } from "@/components/Toast";

export default function StudentSheetPage() {
  const showToast = useToast();
  const [sheet, setSheet] = useState(null);
  const [loading, setLoading] = useState(true);

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
  }, [showToast]);

  if (loading) return <div className="app"><p className="hint">Loading…</p></div>;
  if (!sheet) return <div className="app"><p className="hint">Couldn't load your sheet.</p></div>;

  return (
    <div className="app">
      <div className="view-header">
        <Link href="/student" className="back-link">&larr; Back to editing</Link>
        <div className="top-actions">
          <a className="btn btn-accent" href="/api/sheets/me/docx">Download Word (.docx)</a>
          <button className="btn btn-primary" onClick={() => window.print()}>Print / Save as PDF</button>
        </div>
      </div>
      <div className="sheet-wrap">
        <SheetDocument sheet={sheet} />
      </div>
    </div>
  );
}
