"use client";

import { useState } from "react";

export const meta = { title: "collection-pill", width: 360, height: 360 };

export default function Pill() {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex h-full w-full items-center justify-center bg-stone-100">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-14 items-center gap-3 overflow-hidden rounded-full bg-sky-300 px-5 text-lg font-bold text-zinc-900 transition-all duration-500"
        style={{ width: open ? 240 : 56 }}
      >
        <span className="shrink-0">●</span>
        <span className="whitespace-nowrap">Collection</span>
      </button>
    </div>
  );
}
