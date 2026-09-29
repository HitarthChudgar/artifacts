"use client";

/* eslint-disable @next/next/no-img-element -- canvas media are arbitrary user images */

import { memo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { LinkPreview, MediaItem } from "../lib/media";
import { capturePointer } from "../lib/pointer";
import { HEADER_HEIGHT } from "./ArtifactCard";

const MIN_SIZE = 40;

type Props = {
  id: string;
  item: MediaItem;
  selected: boolean;
  getScale: () => number;
  onChange: (id: string, patch: Partial<MediaItem>) => void;
  onSelect: (id: string) => void;
};

type Corner = { sx: 1 | -1; sy: 1 | -1 };

const CORNERS: (Corner & { className: string })[] = [
  { sx: -1, sy: -1, className: "-top-1.5 -left-1.5 cursor-nwse-resize" },
  { sx: 1, sy: -1, className: "-top-1.5 -right-1.5 cursor-nesw-resize" },
  { sx: -1, sy: 1, className: "-bottom-1.5 -left-1.5 cursor-nesw-resize" },
  { sx: 1, sy: 1, className: "-right-1.5 -bottom-1.5 cursor-nwse-resize" },
];

type Drag = {
  mode: "move" | "resize";
  corner: Corner;
  startX: number;
  startY: number;
  origin: MediaItem;
};

function MediaNodeImpl({ id, item, selected, getScale, onChange, onSelect }: Props) {
  const drag = useRef<Drag | null>(null);

  const startDrag = (e: ReactPointerEvent<HTMLElement>, mode: Drag["mode"], corner: Corner = { sx: 1, sy: 1 }) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button, a")) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect(id);
    capturePointer(e.currentTarget, e.pointerId);
    drag.current = { mode, corner, startX: e.clientX, startY: e.clientY, origin: item };
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d) return;
    const scale = getScale();
    const dx = (e.clientX - d.startX) / scale;
    const dy = (e.clientY - d.startY) / scale;
    const o = d.origin;
    if (d.mode === "move") {
      onChange(id, { x: o.x + dx, y: o.y + dy });
    } else if (o.kind === "image") {
      // Grow by whichever axis moved further, then derive the other from the aspect ratio,
      // keeping the opposite corner fixed.
      const { sx, sy } = d.corner;
      const ratio = o.w / o.h;
      const w = Math.max(MIN_SIZE, o.w + Math.max(sx * dx, sy * dy * ratio));
      const h = w / ratio;
      onChange(id, { w, h, x: sx < 0 ? o.x + o.w - w : o.x, y: sy < 0 ? o.y + o.h - h : o.y });
    } else {
      onChange(id, { w: Math.max(MIN_SIZE * 3, o.w + dx), h: Math.max(MIN_SIZE * 2, o.h + dy) });
    }
  };

  const endDrag = () => {
    drag.current = null;
  };

  const ring = selected ? "ring-2 ring-blue-500/70" : "ring-1 ring-black/5";

  const resizeHandle = (
    <div
      className="absolute right-0 bottom-0 z-10 h-4 w-4 cursor-nwse-resize"
      onPointerDown={(e) => startDrag(e, "resize")}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    />
  );

  if (item.kind === "image") {
    return (
      <div
        className={`absolute cursor-grab active:cursor-grabbing ${ring}`}
        style={{ transform: `translate(${item.x}px, ${item.y}px)`, width: item.w, height: item.h, zIndex: item.z }}
        onPointerDown={(e) => startDrag(e, "move")}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {item.svg ? (
          <object
            data={item.src}
            type="image/svg+xml"
            aria-label={item.name ?? ""}
            className="pointer-events-none h-full w-full"
          />
        ) : (
          <img
            src={item.src}
            alt={item.name ?? ""}
            draggable={false}
            className="pointer-events-none h-full w-full object-fill select-none"
          />
        )}
        {item.uploading && (
          <div className="absolute top-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white">
            Uploading…
          </div>
        )}
        {selected &&
          CORNERS.map(({ className, ...corner }) => (
            <div
              key={className}
              title="Drag to resize"
              className={`absolute z-10 h-3 w-3 scale-(--inv-scale) rounded-full border-2 border-blue-500 bg-white ${className}`}
              onPointerDown={(e) => startDrag(e, "resize", corner)}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            />
          ))}
      </div>
    );
  }

  const { preview } = item;
  const host = safeHost(item.url);

  return (
    <div
      className="group absolute"
      style={{ transform: `translate(${item.x}px, ${item.y}px)`, width: item.w, zIndex: item.z }}
    >
      <div
        className="flex cursor-grab items-center gap-1.5 px-1 select-none active:cursor-grabbing"
        style={{ height: HEADER_HEIGHT }}
        onPointerDown={(e) => startDrag(e, "move")}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {preview?.favicon && (
          <img src={preview.favicon} alt="" className="h-3.5 w-3.5 shrink-0 rounded-sm" draggable={false} />
        )}
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-zinc-500" title={item.url}>
          {preview?.title ? `${host} · ${preview.title}` : host}
        </span>
        <div
          className={`flex shrink-0 items-center gap-0.5 text-zinc-500 transition-opacity ${
            selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        >
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            title="Open in new tab"
            className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-black/5 hover:text-zinc-900"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
            </svg>
          </a>
        </div>
      </div>

      <div className={`relative overflow-hidden bg-white ${ring}`} style={{ height: item.h }}>
        {preview ? (
          <LiveFrame preview={preview} interactive={selected} />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-zinc-400">Loading page…</div>
        )}
        {resizeHandle}
      </div>
    </div>
  );
}

function LiveFrame({ preview, interactive }: { preview: LinkPreview; interactive: boolean }) {
  const [loaded, setLoaded] = useState(false);
  const { url, embeddable } = preview;
  return (
    <>
      <iframe
        src={embeddable ? url : `/api/frame?url=${encodeURIComponent(url)}`}
        title={url}
        onLoad={() => setLoaded(true)}
        // Proxied pages are served from our origin, so they must not get allow-same-origin.
        sandbox={`allow-scripts allow-forms allow-popups${embeddable ? " allow-same-origin" : ""}`}
        referrerPolicy="no-referrer"
        // Iframes swallow pointer events; only let them through once the node is selected.
        className={`h-full w-full border-0 ${interactive ? "" : "pointer-events-none"}`}
      />
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-white text-xs text-zinc-400">
          Loading page…
        </div>
      )}
    </>
  );
}

function safeHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export const MediaNode = memo(MediaNodeImpl);
