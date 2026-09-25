"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { artifacts } from "../lib/artifacts";
import { ArtifactBody, ArtifactCard, HEADER_HEIGHT, type CardLayout } from "./ArtifactCard";
import { DialPanel } from "./DialPanel";
import { clampScale, useCamera, type Camera } from "./useCamera";

type Saved = { camera: Camera; layouts: Record<string, CardLayout> };

const STORAGE_KEY = "artifact-canvas:v1";
const GAP = 24;
const WHEEL_ZOOM_STEP = 1.25;
const BUTTON_ZOOM_STEP = 1.2;
const DEFAULT_CAMERA: Camera = { x: 48, y: 72, scale: 1 };

function loadSaved(): Saved {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Saved;
  } catch {}
  return { camera: DEFAULT_CAMERA, layouts: {} };
}

// Trackpads send many small pixel deltas; mouse wheels send few large (or line-based) ones.
const isMouseWheel = (e: WheelEvent) =>
  e.deltaMode !== 0 || (e.deltaX === 0 && Number.isInteger(e.deltaY) && Math.abs(e.deltaY) >= 50);

export default function Canvas() {
  const [initial] = useState(loadSaved);
  const [stored, setStored] = useState<Record<string, CardLayout>>(initial.layouts);
  const [selected, setSelected] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [panning, setPanning] = useState(false);

  const viewportRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const zoomLabelRef = useRef<HTMLSpanElement>(null);
  const spaceDown = useRef(false);
  const pan = useRef<{ lastX: number; lastY: number } | null>(null);
  const savedCamera = useRef(initial.camera);

  // Artifacts without a saved layout are placed in a row to the right of everything else.
  const layouts = useMemo(() => {
    const result: Record<string, CardLayout> = {};
    let right = 0;
    let topZ = 0;
    for (const a of artifacts) {
      const l = stored[a.id];
      if (l) {
        result[a.id] = l;
        right = Math.max(right, l.x + l.w + GAP);
        topZ = Math.max(topZ, l.z);
      }
    }
    for (const a of artifacts) {
      if (result[a.id]) continue;
      result[a.id] = { x: right, y: 0, w: a.width, h: a.height, z: ++topZ };
      right += a.width + GAP;
    }
    return result;
  }, [stored]);

  const layoutsRef = useRef(layouts);
  useLayoutEffect(() => {
    layoutsRef.current = layouts;
  }, [layouts]);

  const save = useCallback(() => {
    const data: Saved = { camera: savedCamera.current, layouts: layoutsRef.current };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, []);

  useEffect(() => {
    const t = setTimeout(save, 250);
    return () => clearTimeout(t);
  }, [layouts, save]);

  const camera = useCamera({
    initial: initial.camera,
    viewportRef,
    worldRef,
    labelRef: zoomLabelRef,
    onChange: useCallback(
      (c: Camera) => {
        savedCamera.current = c;
        save();
      },
      [save],
    ),
  });
  const { getCamera, panBy, zoomBy, zoomTo, setCamera } = camera;

  const getScale = useCallback(() => getCamera().scale, [getCamera]);

  const updateLayout = useCallback((id: string, patch: Partial<CardLayout>) => {
    setStored((prev) => ({ ...prev, [id]: { ...layoutsRef.current[id], ...prev[id], ...patch } }));
  }, []);

  const select = useCallback((id: string) => {
    setSelected(id);
    const all = layoutsRef.current;
    const topZ = Math.max(...Object.values(all).map((l) => l.z));
    if (all[id] && all[id].z < topZ) {
      setStored((prev) => ({ ...prev, [id]: { ...all[id], ...prev[id], z: topZ + 1 } }));
    }
  }, []);

  const center = useCallback(() => {
    const el = viewportRef.current;
    return el ? { x: el.clientWidth / 2, y: el.clientHeight / 2 } : { x: 0, y: 0 };
  }, []);

  const zoomStep = (factor: number) => {
    const c = center();
    zoomBy(c.x, c.y, factor, true);
  };

  const resetZoom = useCallback(() => {
    const c = center();
    zoomTo(c.x, c.y, 1, true);
  }, [center, zoomTo]);

  const fitAll = useCallback(() => {
    const el = viewportRef.current;
    const all = Object.values(layoutsRef.current);
    if (!el || all.length === 0) return;
    const minX = Math.min(...all.map((l) => l.x));
    const minY = Math.min(...all.map((l) => l.y));
    const maxX = Math.max(...all.map((l) => l.x + l.w));
    const maxY = Math.max(...all.map((l) => l.y + l.h + HEADER_HEIGHT));
    const pad = 64;
    const scale = clampScale(
      Math.min(1, (el.clientWidth - pad * 2) / (maxX - minX), (el.clientHeight - pad * 2) / (maxY - minY)),
    );
    setCamera(
      {
        scale,
        x: (el.clientWidth - (maxX - minX) * scale) / 2 - minX * scale,
        y: (el.clientHeight - (maxY - minY) * scale) / 2 - minY * scale,
      },
      true,
    );
  }, [setCamera]);

  // Wheel: pan by default, zoom with ctrl/cmd (also what trackpad pinch sends).
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const zooming = e.ctrlKey || e.metaKey;
      if (!zooming && canScroll(e.target, e.deltaX, e.deltaY, el)) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const mouse = isMouseWheel(e);

      if (zooming) {
        if (mouse) {
          zoomBy(sx, sy, e.deltaY > 0 ? 1 / WHEEL_ZOOM_STEP : WHEEL_ZOOM_STEP, true);
        } else {
          zoomBy(sx, sy, Math.exp(-Math.max(-30, Math.min(30, e.deltaY)) * 0.01));
        }
      } else {
        const unit = e.deltaMode === 1 ? 16 : 1;
        panBy(-e.deltaX * unit, -e.deltaY * unit, mouse);
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [panBy, zoomBy]);

  useEffect(() => {
    const isTyping = (t: EventTarget | null) =>
      t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      if (e.code === "Space") {
        spaceDown.current = true;
        e.preventDefault();
      }
      if (e.key === "Escape") {
        setExpanded(null);
        setSelected(null);
      }
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "0") {
        e.preventDefault();
        resetZoom();
      }
      if (e.shiftKey && e.key === "!") fitAll();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") spaceDown.current = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [fitAll, resetZoom]);

  const onPointerDownCapture = (e: ReactPointerEvent<HTMLDivElement>) => {
    const onBackground = e.target === e.currentTarget || (e.target as HTMLElement).dataset.world;
    const wantsPan = e.button === 1 || (e.button === 0 && (spaceDown.current || onBackground));
    if (!wantsPan) return;
    if (onBackground) setSelected(null);
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    pan.current = { lastX: e.clientX, lastY: e.clientY };
    setPanning(true);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const p = pan.current;
    if (!p) return;
    panBy(e.clientX - p.lastX, e.clientY - p.lastY);
    p.lastX = e.clientX;
    p.lastY = e.clientY;
  };

  const endPan = () => {
    pan.current = null;
    setPanning(false);
  };

  const expandedArtifact = artifacts.find((a) => a.id === expanded);
  const dialTarget = expanded ?? selected;
  const dialTargetName = dialTarget
    ? layouts[dialTarget]?.name || artifacts.find((a) => a.id === dialTarget)?.title
    : undefined;

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#f4f4f5] text-zinc-900">
      <div
        ref={viewportRef}
        className={`absolute inset-0 touch-none ${panning ? "cursor-grabbing" : ""}`}
        onPointerDownCapture={onPointerDownCapture}
        onPointerMove={onPointerMove}
        onPointerUp={endPan}
        onPointerCancel={endPan}
      >
        <div ref={worldRef} data-world className="absolute top-0 left-0 origin-top-left">
          {artifacts.map((a) => (
            <ArtifactCard
              key={a.id}
              artifact={a}
              layout={layouts[a.id]}
              selected={selected === a.id}
              getScale={getScale}
              onChange={updateLayout}
              onSelect={select}
              onExpand={setExpanded}
            />
          ))}
        </div>

        {artifacts.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="text-center text-sm text-zinc-500">
              <div className="font-medium text-zinc-700">No artifacts yet</div>
              Drop a <code className="font-mono">.tsx</code> file with a default export into{" "}
              <code className="font-mono">/artifacts</code>
            </div>
          </div>
        )}
      </div>

      <div className="absolute right-4 bottom-4 flex items-center gap-0.5 rounded-full bg-white p-1 text-xs text-zinc-600 shadow-sm ring-1 ring-black/5 select-none">
        <ToolbarButton label="Zoom out" onClick={() => zoomStep(1 / BUTTON_ZOOM_STEP)}>
          −
        </ToolbarButton>
        <button
          type="button"
          title="Reset zoom (⌘0)"
          onClick={resetZoom}
          className="h-7 w-12 rounded-full font-mono tabular-nums hover:bg-black/5"
        >
          <span ref={zoomLabelRef} />
        </button>
        <ToolbarButton label="Zoom in" onClick={() => zoomStep(BUTTON_ZOOM_STEP)}>
          +
        </ToolbarButton>
        <div className="mx-0.5 h-4 w-px bg-black/10" />
        <button
          type="button"
          title="Fit all (⇧1)"
          onClick={fitAll}
          className="h-7 rounded-full px-2.5 hover:bg-black/5"
        >
          Fit
        </button>
      </div>

      {expandedArtifact && (
        <div
          className="fixed inset-0 z-[100000] flex flex-col bg-black/40 p-6 backdrop-blur-sm"
          onPointerDown={(e) => e.target === e.currentTarget && setExpanded(null)}
        >
          <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex h-10 shrink-0 items-center justify-between border-b border-black/5 px-3">
              <span className="font-mono text-xs text-zinc-500">
                {layouts[expandedArtifact.id]?.name || expandedArtifact.title}
              </span>
              <button
                type="button"
                onClick={() => setExpanded(null)}
                className="h-7 rounded-md px-2 text-xs text-zinc-500 hover:bg-black/5 hover:text-zinc-900"
              >
                Close (Esc)
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <ArtifactBody id={expandedArtifact.id} Component={expandedArtifact.Component} />
            </div>
          </div>
        </div>
      )}

      <div className="relative z-[100001]">
        <DialPanel artifactId={dialTarget} title={dialTargetName} />
      </div>
    </div>
  );
}

function canScroll(target: EventTarget | null, dx: number, dy: number, stop: Element) {
  let node = target instanceof Element ? target : null;
  while (node && node !== stop) {
    const style = getComputedStyle(node);
    const scrollY = /(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight;
    const scrollX = /(auto|scroll)/.test(style.overflowX) && node.scrollWidth > node.clientWidth;
    if (scrollY && dy !== 0) {
      const atEnd = dy > 0 ? node.scrollTop + node.clientHeight >= node.scrollHeight - 1 : node.scrollTop <= 0;
      if (!atEnd) return true;
    }
    if (scrollX && dx !== 0) {
      const atEnd = dx > 0 ? node.scrollLeft + node.clientWidth >= node.scrollWidth - 1 : node.scrollLeft <= 0;
      if (!atEnd) return true;
    }
    node = node.parentElement;
  }
  return false;
}

function ToolbarButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-full text-sm hover:bg-black/5"
    >
      {children}
    </button>
  );
}
