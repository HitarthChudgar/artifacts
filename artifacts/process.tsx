"use client";

import { useLayoutEffect, useRef, useState, type ComponentProps } from "react";
import { flushSync } from "react-dom";
import { cn } from "@/app/lib/utils";

export const meta = { title: "process", width: 360, height: 160 };

type Phase = "idle" | "processing" | "processed";

const LABEL: Record<Phase, string> = {
  idle: "Process",
  processing: "Processing",
  processed: "Processed",
};

const SWAP_MS = 150;

const SWAP_STYLES = `
:root {
  --text-swap-dur: 150ms;
  --text-swap-translate-y: 4px;
  --text-swap-blur: 2px;
  --text-swap-ease: ease-in-out;
}
.t-text-swap {
  display: flex;
  transform: translateY(0);
  filter: blur(0);
  opacity: 1;
  transition:
    transform var(--text-swap-dur) var(--text-swap-ease),
    filter var(--text-swap-dur) var(--text-swap-ease),
    opacity var(--text-swap-dur) var(--text-swap-ease);
  will-change: transform, filter, opacity;
}
.t-text-swap.is-exit {
  transform: translateY(calc(var(--text-swap-translate-y) * -1));
  filter: blur(var(--text-swap-blur));
  opacity: 0;
}
.t-text-swap.is-enter-start {
  transform: translateY(var(--text-swap-translate-y));
  filter: blur(var(--text-swap-blur));
  opacity: 0;
  transition: none;
}
.t-process-btn {
  transition: width 220ms ease-in-out;
}
@media (prefers-reduced-motion: reduce) {
  .t-text-swap,
  .t-process-btn { transition: none !important; }
}
`;

if (typeof document !== "undefined") {
  let style = document.getElementById("process-text-swap");
  if (!style) {
    style = document.createElement("style");
    style.id = "process-text-swap";
    document.head.appendChild(style);
  }
  style.textContent = SWAP_STYLES;
}

export default function ProcessButton() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [width, setWidth] = useState(0);
  const rowRef = useRef<HTMLSpanElement>(null);
  const sizerRef = useRef<HTMLSpanElement>(null);
  const busy = useRef(false);
  const showIcon = phase !== "idle";

  useLayoutEffect(() => {
    const next = sizerRef.current?.offsetWidth ?? 0;
    if (next) setWidth(next);
  }, [phase]);

  const swapTo = (next: Phase) => {
    const el = rowRef.current;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!el || reduced) {
      setPhase(next);
      return;
    }
    if (busy.current) return;
    busy.current = true;
    el.classList.add("is-exit");
    window.setTimeout(() => {
      flushSync(() => setPhase(next));
      el.classList.remove("is-exit");
      el.classList.add("is-enter-start");
      void el.offsetWidth;
      el.classList.remove("is-enter-start");
      busy.current = false;
    }, SWAP_MS);
  };

  return (
    <div className="flex w-full items-center justify-center py-10">
      <button
        type="button"
        disabled={phase !== "idle"}
        aria-label={LABEL[phase]}
        onClick={() => {
          swapTo("processing");
          window.setTimeout(() => {
            swapTo("processed");
            window.setTimeout(() => swapTo("idle"), 1400);
          }, 1100);
        }}
        className="t-process-btn relative inline-flex max-w-full items-center overflow-hidden rounded-md text-[16px] font-medium text-white disabled:opacity-100 h-16"
        style={{
          background: "#FF7FD4",
          height: 36,
          fontWeight: 500,
          width: width || undefined,
        }}
      >
        <span
          ref={sizerRef}
          className="pointer-events-none invisible absolute top-0 left-0 flex w-max items-center gap-1.5 px-4 whitespace-nowrap"
          aria-hidden
        >
          {showIcon && <span className="h-[18px] w-[18px] shrink-0" />}
          {LABEL[phase]}
        </span>
        <span
          ref={rowRef}
          className="t-text-swap absolute inset-0 items-center justify-center gap-1.5 px-4 whitespace-nowrap"
        >
          {phase === "processing" && <DashRing className="h-[18px] w-[18px]" />}
          {phase === "processed" && <Check />}
          {LABEL[phase]}
        </span>
      </button>
    </div>
  );
}

function DashRing({ className, ...props }: ComponentProps<"svg">) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      role="status"
      className={cn(className)}
      {...props}
    >
      <circle
        cx="12"
        cy="12"
        r="9.5"
        opacity="0.18"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="9.25" strokeWidth="3.5" strokeLinecap="round">
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 12 12"
          to="360 12 12"
          dur="2s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="stroke-dasharray"
          values="0 150;42 150;42 150"
          keyTimes="0;0.5;1"
          dur="1.5s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="stroke-dashoffset"
          values="0;-16;-59"
          keyTimes="0;0.5;1"
          dur="1.5s"
          repeatCount="indefinite"
        />
      </circle>
    </svg>
  );
}

function Check() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M3.5 8.2 6.4 11.2 12.5 4.8"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
