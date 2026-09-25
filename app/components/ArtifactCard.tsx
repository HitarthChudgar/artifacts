"use client";

import {
  Component as ReactComponent,
  memo,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import type { Artifact } from "../lib/artifacts";
import { ArtifactContext } from "../lib/dial";

export type CardLayout = {
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  name?: string;
};

export const HEADER_HEIGHT = 28;
const MIN_W = 120;
const MIN_H = 80;

type Props = {
  artifact: Artifact;
  layout: CardLayout;
  selected: boolean;
  getScale: () => number;
  onChange: (id: string, patch: Partial<CardLayout>) => void;
  onSelect: (id: string) => void;
  onExpand: (id: string) => void;
};

function ArtifactCardImpl({
  artifact,
  layout,
  selected,
  getScale,
  onChange,
  onSelect,
  onExpand,
}: Props) {
  const [editing, setEditing] = useState(false);
  const drag = useRef<{
    mode: "move" | "resize";
    startX: number;
    startY: number;
    origin: CardLayout;
  } | null>(null);

  const name = layout.name || artifact.title;

  const startDrag = (e: ReactPointerEvent<HTMLElement>, mode: "move" | "resize") => {
    if (e.button !== 0 || editing) return;
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { mode, startX: e.clientX, startY: e.clientY, origin: layout };
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d) return;
    const scale = getScale();
    const dx = (e.clientX - d.startX) / scale;
    const dy = (e.clientY - d.startY) / scale;
    if (d.mode === "move") {
      onChange(artifact.id, { x: d.origin.x + dx, y: d.origin.y + dy });
    } else {
      onChange(artifact.id, {
        w: Math.max(MIN_W, d.origin.w + dx),
        h: Math.max(MIN_H, d.origin.h + dy),
      });
    }
  };

  const endDrag = () => {
    drag.current = null;
  };

  return (
    <div
      className="group absolute"
      style={{
        transform: `translate(${layout.x}px, ${layout.y}px)`,
        width: layout.w,
        zIndex: layout.z,
      }}
      onPointerDownCapture={() => onSelect(artifact.id)}
    >
      <div
        className="flex cursor-grab items-center gap-2 select-none active:cursor-grabbing"
        style={{ height: HEADER_HEIGHT }}
        onPointerDown={(e) => startDrag(e, "move")}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {editing ? (
          <RenameInput
            initial={name}
            onDone={(value) => {
              setEditing(false);
              if (value !== null) {
                const trimmed = value.trim();
                onChange(artifact.id, {
                  name: trimmed && trimmed !== artifact.title ? trimmed : undefined,
                });
              }
            }}
          />
        ) : (
          <span
            className="min-w-0 flex-1 truncate px-1 font-mono text-[11px] text-zinc-500"
            onDoubleClick={() => setEditing(true)}
            title="Double-click to rename"
          >
            {name}
          </span>
        )}
        <div
          className={`flex shrink-0 items-center gap-0.5 text-zinc-500 transition-opacity ${
            selected || editing ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        >
          <IconButton label="Rename" onClick={() => setEditing(true)}>
            <path d="M4 20h4L19 9l-4-4L4 16v4Z" />
          </IconButton>
          <IconButton label="Expand" onClick={() => onExpand(artifact.id)}>
            <path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" />
          </IconButton>
          <span className="flex h-6 w-5 items-center justify-center" aria-hidden>
            <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
              {[2, 7, 12].flatMap((cy) =>
                [2, 8].map((cx) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.3" />),
              )}
            </svg>
          </span>
        </div>
      </div>

      <div
        className={`relative overflow-hidden bg-white transition-shadow ${
          selected ? "ring-2 ring-blue-500/70" : "ring-1 ring-black/5"
        }`}
        style={{ height: layout.h }}
      >
        <ArtifactBody id={artifact.id} Component={artifact.Component} />
        <div
          className="absolute right-0 bottom-0 h-4 w-4 cursor-nwse-resize"
          onPointerDown={(e) => startDrag(e, "resize")}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        />
      </div>
    </div>
  );
}

export const ArtifactCard = memo(ArtifactCardImpl);

// Memoized so dragging/panning never re-renders the artifact itself.
export const ArtifactBody = memo(function ArtifactBody({
  id,
  Component,
}: {
  id: string;
  Component: ComponentType;
}) {
  return (
    <ArtifactContext.Provider value={id}>
      <ErrorBoundary>
        <div className="h-full w-full overflow-auto">
          <Component />
        </div>
      </ErrorBoundary>
    </ArtifactContext.Provider>
  );
});

function RenameInput({
  initial,
  onDone,
}: {
  initial: string;
  onDone: (value: string | null) => void;
}) {
  const [value, setValue] = useState(initial);
  const done = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);
  const finish = (v: string | null) => {
    if (done.current) return;
    done.current = true;
    onDone(v);
  };

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onPointerDown={(e) => e.stopPropagation()}
      onBlur={() => finish(value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") finish(value);
        if (e.key === "Escape") finish(null);
      }}
      className="h-6 min-w-0 flex-1 rounded-md border border-blue-500 bg-white px-1.5 font-mono text-[11px] text-zinc-800 outline-none"
    />
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-black/5 hover:text-zinc-900"
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </svg>
    </button>
  );
}

class ErrorBoundary extends ReactComponent<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="p-4 font-mono text-xs text-red-600">
          <div className="mb-1 font-semibold">This artifact crashed</div>
          <div className="break-words text-red-500">{this.state.error.message}</div>
        </div>
      );
    }
    return this.props.children;
  }
}
