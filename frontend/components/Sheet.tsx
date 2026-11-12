"use client";

import { useEffect, useRef, useState } from "react";

const SNAPS = [0.14, 0.46, 0.92];

/** Mobile bottom sheet, map-app style: always present, drag the handle between peek, half and full.
 *  Tapping the handle toggles half/full. `snapKey` changing resets it to `initial`. */
export default function Sheet({ label, children, initial = 0.46, snapKey }: {
  label: string; children: React.ReactNode; initial?: number; snapKey?: string;
}) {
  const [frac, setFrac] = useState(initial);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ y: number; frac: number } | null>(null);

  useEffect(() => { setFrac(initial); }, [snapKey, initial]);

  const onDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    start.current = { y: e.clientY, frac };
    setDragging(true);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!start.current) return;
    const dy = (start.current.y - e.clientY) / window.innerHeight;
    setFrac(Math.min(0.94, Math.max(0.1, start.current.frac + dy)));
  };
  const onUp = (e: React.PointerEvent) => {
    if (!start.current) return;
    const moved = Math.abs(start.current.y - e.clientY) > 6;
    start.current = null;
    setDragging(false);
    if (!moved) { setFrac((f) => (f > 0.7 ? SNAPS[1] : SNAPS[2])); return; }
    setFrac((f) => SNAPS.reduce((best, s) => (Math.abs(s - f) < Math.abs(best - f) ? s : best), SNAPS[1]));
  };

  return (
    <section aria-label={label}
      className={`fixed inset-x-0 bottom-0 z-30 flex flex-col glass rounded-t-[24px] ${dragging ? "" : "transition-[height] duration-200 ease-out"}`}
      style={{ height: `${frac * 100}dvh` }}>
      <button type="button" aria-label={frac > 0.7 ? "Collapse panel" : "Expand panel"}
        className="flex h-7 shrink-0 touch-none items-center justify-center"
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <span className="h-[5px] w-9 rounded-full bg-muted/40" />
      </button>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
    </section>
  );
}
