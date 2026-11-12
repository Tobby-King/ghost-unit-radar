"use client";

import { useEffect, useRef, useState } from "react";

/** Mobile bottom sheet. Drag the handle (or tap it) to move between a half and a full snap;
 *  dragging well below the half snap closes it. */
export default function Sheet({ open, onClose, label, children, initial = 0.5 }: {
  open: boolean; onClose: () => void; label: string; children: React.ReactNode; initial?: number;
}) {
  const [frac, setFrac] = useState(initial);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ y: number; frac: number } | null>(null);

  useEffect(() => { if (open) setFrac(initial); }, [open, initial]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const onDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    start.current = { y: e.clientY, frac };
    setDragging(true);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!start.current) return;
    const dy = (start.current.y - e.clientY) / window.innerHeight;
    setFrac(Math.min(0.92, Math.max(0.1, start.current.frac + dy)));
  };
  const onUp = (e: React.PointerEvent) => {
    if (!start.current) return;
    const moved = Math.abs(start.current.y - e.clientY) > 6;
    start.current = null;
    setDragging(false);
    if (!moved) { setFrac((f) => (f > 0.7 ? 0.5 : 0.92)); return; }
    setFrac((f) => {
      if (f < 0.3) { onClose(); return initial; }
      return f > 0.7 ? 0.92 : 0.5;
    });
  };

  if (!open) return null;
  return (
    <div role="dialog" aria-label={label}
      className={`fixed inset-x-0 bottom-0 z-40 flex flex-col rounded-t-[14px] border-t border-line bg-surface ${dragging ? "" : "transition-[height] duration-200"}`}
      style={{ height: `${frac * 100}dvh` }}>
      <button type="button" aria-label={frac > 0.7 ? "Collapse panel" : "Expand panel"}
        className="flex h-7 shrink-0 touch-none items-center justify-center"
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <span className="h-1 w-10 rounded-full bg-line" />
      </button>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
    </div>
  );
}
