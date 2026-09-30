"use client";

import { memo, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { capturePointer } from "../lib/pointer";
import type { SnapMove } from "../lib/snap";

export type ArrowItem = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  z: number;
};

const STROKE = 2.5;
const HEAD_LENGTH = 14;
const HEAD_WIDTH = 11;

type Props = {
  id: string;
  item: ArrowItem;
  selected: boolean;
  getScale: () => number;
  onChange: (id: string, patch: Partial<ArrowItem>) => void;
  onSelect: (id: string) => void;
  snap: SnapMove;
  onSnapEnd: () => void;
};

type Drag = { part: "body" | "start" | "end"; startX: number; startY: number; origin: ArrowItem };

function ArrowNodeImpl({
  id,
  item,
  selected,
  getScale,
  onChange,
  onSelect,
  snap,
  onSnapEnd,
}: Props) {
  const drag = useRef<Drag | null>(null);
  const { x1, y1, x2, y2 } = item;

  const angle = Math.atan2(y2 - y1, x2 - x1);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  // Stop the line short of the tip so its end doesn't poke through the head.
  const lineEndX = x2 - cos * HEAD_LENGTH * 0.8;
  const lineEndY = y2 - sin * HEAD_LENGTH * 0.8;
  const baseX = x2 - cos * HEAD_LENGTH;
  const baseY = y2 - sin * HEAD_LENGTH;
  const head = [
    [x2, y2],
    [baseX - sin * (HEAD_WIDTH / 2), baseY + cos * (HEAD_WIDTH / 2)],
    [baseX + sin * (HEAD_WIDTH / 2), baseY - cos * (HEAD_WIDTH / 2)],
  ]
    .map((p) => p.join(","))
    .join(" ");

  const start = (e: ReactPointerEvent<SVGElement>, part: Drag["part"]) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    onSelect(id);
    capturePointer(e.currentTarget, e.pointerId);
    drag.current = { part, startX: e.clientX, startY: e.clientY, origin: item };
  };

  const onPointerMove = (e: ReactPointerEvent<SVGElement>) => {
    const d = drag.current;
    if (!d) return;
    const scale = getScale();
    const dx = (e.clientX - d.startX) / scale;
    const dy = (e.clientY - d.startY) / scale;
    const o = d.origin;
    const disable = { disable: e.ctrlKey };
    if (d.part === "body") {
      const x = Math.min(o.x1, o.x2) + dx;
      const y = Math.min(o.y1, o.y2) + dy;
      const s = snap(
        id,
        { x, y, w: Math.abs(o.x2 - o.x1), h: Math.abs(o.y2 - o.y1) },
        disable,
      );
      const ax = s.x - x;
      const ay = s.y - y;
      onChange(id, {
        x1: o.x1 + dx + ax,
        y1: o.y1 + dy + ay,
        x2: o.x2 + dx + ax,
        y2: o.y2 + dy + ay,
      });
    } else if (d.part === "start") {
      const s = snap(id, { x: o.x1 + dx, y: o.y1 + dy, w: 0, h: 0 }, disable);
      onChange(id, { x1: s.x, y1: s.y });
    } else {
      const s = snap(id, { x: o.x2 + dx, y: o.y2 + dy, w: 0, h: 0 }, disable);
      onChange(id, { x2: s.x, y2: s.y });
    }
  };

  const end = () => {
    drag.current = null;
    onSnapEnd();
  };

  const color = selected ? "#3b82f6" : "#18181b";

  return (
    <svg
      className="pointer-events-none absolute top-0 left-0 overflow-visible"
      width={1}
      height={1}
      style={{ zIndex: item.z }}
    >
      <line x1={x1} y1={y1} x2={lineEndX} y2={lineEndY} stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
      <polygon points={head} fill={color} stroke={color} strokeWidth={STROKE} strokeLinejoin="round" />
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="transparent"
        strokeWidth={16}
        strokeLinecap="round"
        className="cursor-move"
        style={{ pointerEvents: "stroke" }}
        onPointerDown={(e) => start(e, "body")}
        onPointerMove={onPointerMove}
        onPointerUp={end}
        onPointerCancel={end}
      />
      {selected && (
        <>
          <circle
            cx={x1}
            cy={y1}
            r={5}
            fill="white"
            stroke="#3b82f6"
            strokeWidth={2}
            className="cursor-crosshair"
            style={{ pointerEvents: "all" }}
            onPointerDown={(e) => start(e, "start")}
            onPointerMove={onPointerMove}
            onPointerUp={end}
            onPointerCancel={end}
          />
          <circle
            cx={x2}
            cy={y2}
            r={5}
            fill="white"
            stroke="#3b82f6"
            strokeWidth={2}
            className="cursor-crosshair"
            style={{ pointerEvents: "all" }}
            onPointerDown={(e) => start(e, "end")}
            onPointerMove={onPointerMove}
            onPointerUp={end}
            onPointerCancel={end}
          />
        </>
      )}
    </svg>
  );
}

export const ArrowNode = memo(ArrowNodeImpl);
