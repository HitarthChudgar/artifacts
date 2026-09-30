"use client";

import { memo, useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { capturePointer } from "../lib/pointer";

export type TextItem = {
  x: number;
  y: number;
  z: number;
  text: string;
  size: number;
};

const MIN_SIZE = 6;
const MAX_SIZE = 1000;

type Corner = { sx: 1 | -1; sy: 1 | -1 };

const CORNERS: (Corner & { className: string; cursor: string })[] = [
  { sx: -1, sy: -1, className: "top-0 left-0", cursor: "cursor-nwse-resize" },
  { sx: 1, sy: -1, className: "top-0 left-full", cursor: "cursor-nesw-resize" },
  { sx: -1, sy: 1, className: "top-full left-0", cursor: "cursor-nesw-resize" },
  { sx: 1, sy: 1, className: "top-full left-full", cursor: "cursor-nwse-resize" },
];

type Props = {
  id: string;
  item: TextItem;
  selected: boolean;
  editing: boolean;
  getScale: () => number;
  onChange: (id: string, patch: Partial<TextItem>) => void;
  onSelect: (id: string) => void;
  onEdit: (id: string | null) => void;
  onDelete: (id: string) => void;
};

function TextNodeImpl({
  id,
  item,
  selected,
  editing,
  getScale,
  onChange,
  onSelect,
  onEdit,
  onDelete,
}: Props) {
  const textRef = useRef<HTMLDivElement>(null);
  const drag = useRef<
    | { mode: "move"; startX: number; startY: number; x: number; y: number }
    | {
        mode: "scale";
        sx: 1 | -1;
        sy: 1 | -1;
        startX: number;
        startY: number;
        x: number;
        y: number;
        w: number;
        h: number;
        size: number;
      }
    | null
  >(null);

  useEffect(() => {
    const el = textRef.current;
    if (!editing || !el) return;
    el.textContent = item.text;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    // Only when entering edit mode; the element owns its text while editing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const commit = () => {
    const text = (textRef.current?.innerText ?? "").replace(/\n+$/, "");
    onEdit(null);
    if (text.trim()) onChange(id, { text });
    else onDelete(id);
  };

  const startMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || editing) return;
    e.stopPropagation();
    e.preventDefault();
    onSelect(id);
    capturePointer(e.currentTarget, e.pointerId);
    drag.current = { mode: "move", startX: e.clientX, startY: e.clientY, x: item.x, y: item.y };
  };

  const startScale = (e: ReactPointerEvent<HTMLDivElement>, sx: 1 | -1, sy: 1 | -1) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const el = textRef.current;
    if (!el) return;
    capturePointer(e.currentTarget, e.pointerId);
    drag.current = {
      mode: "scale",
      sx,
      sy,
      startX: e.clientX,
      startY: e.clientY,
      x: item.x,
      y: item.y,
      w: el.offsetWidth,
      h: el.offsetHeight,
      size: item.size,
    };
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const scale = getScale();
    const dx = (e.clientX - d.startX) / scale;
    const dy = (e.clientY - d.startY) / scale;
    if (d.mode === "move") {
      onChange(id, { x: d.x + dx, y: d.y + dy });
    } else {
      // Project the drag onto the box diagonal so the corner tracks the pointer.
      const factor =
        ((d.w + d.sx * dx) * d.w + (d.h + d.sy * dy) * d.h) / (d.w * d.w + d.h * d.h);
      const size = Math.min(MAX_SIZE, Math.max(MIN_SIZE, d.size * factor));
      const ratio = size / d.size;
      onChange(id, {
        size: Math.round(size * 10) / 10,
        x: d.sx < 0 ? d.x + d.w * (1 - ratio) : d.x,
        y: d.sy < 0 ? d.y + d.h * (1 - ratio) : d.y,
      });
    }
  };

  const endDrag = () => {
    drag.current = null;
  };

  return (
    <div
      className="absolute"
      style={{ transform: `translate(${item.x}px, ${item.y}px)`, zIndex: item.z }}
    >
      <div className="relative">
        <div
          key={editing ? "edit" : "view"}
          ref={textRef}
          contentEditable={editing ? "plaintext-only" : undefined}
          suppressContentEditableWarning
          spellCheck={false}
          onPointerDown={startMove}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onDoubleClick={(e) => {
            e.stopPropagation();
            onEdit(id);
          }}
          onBlur={editing ? commit : undefined}
          onKeyDown={(e) => {
            if (!editing) return;
            if (e.key === "Escape" || (e.key === "Enter" && (e.metaKey || e.ctrlKey))) {
              e.preventDefault();
              e.stopPropagation();
              textRef.current?.blur();
            }
          }}
          className={`min-w-[1ch] px-1 font-semibold tracking-tight whitespace-pre text-zinc-900 outline-none ${
            editing ? "cursor-text shadow-[0_0_0_1px_#3b82f6]" : "cursor-grab select-none active:cursor-grabbing"
          } ${selected && !editing ? "shadow-[0_0_0_1px_#3b82f6]" : ""}`}
          style={{ fontSize: item.size, lineHeight: 1.15 }}
        >
          {editing ? null : item.text}
        </div>

        {selected && !editing &&
          CORNERS.map(({ sx, sy, className, cursor }) => (
            <div
              key={className}
              title="Drag to scale"
              className={`absolute z-10 flex h-3.5 w-3.5 origin-center -translate-x-1/2 -translate-y-1/2 scale-(--inv-scale) items-center justify-center ${cursor} ${className}`}
              onPointerDown={(e) => startScale(e, sx, sy)}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            >
              <span className="h-1.5 w-1.5 bg-white shadow-[0_0_0_1px_#3b82f6]" />
            </div>
          ))}
      </div>
    </div>
  );
}

export const TextNode = memo(TextNodeImpl);
