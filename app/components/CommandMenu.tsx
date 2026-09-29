"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRef, useState } from "react";

export type CommandItem = {
  id: string;
  title: string;
  onCanvas: boolean;
};

type Props = {
  open: boolean;
  items: CommandItem[];
  onPick: (id: string) => void;
  onClose: () => void;
};

const spring = { type: "spring", visualDuration: 0.15, bounce: 0 } as const;

export function CommandMenu({ open, items, onPick, onClose }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100002] flex items-start justify-center pt-[18vh]">
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={spring}
            onPointerDown={onClose}
          />
          <motion.div
            role="dialog"
            aria-label="Add a component"
            className="relative w-[420px] max-w-[calc(100vw-32px)] origin-center overflow-hidden rounded-[14px] bg-[#212121] text-[14px] text-white/70 shadow-[0_4px_16px_rgba(0,0,0,0.25)] ring-1 ring-white/10"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={spring}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <MenuBody items={items} onPick={onPick} onClose={onClose} />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function MenuBody({ items, onPick, onClose }: Omit<Props, "open">) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const q = query.trim().toLowerCase();
  const results = items
    .filter((i) => !q || i.title.toLowerCase().includes(q) || i.id.toLowerCase().includes(q))
    // Things you can add come first; the rest jump to the card.
    .sort((a, b) => Number(a.onCanvas) - Number(b.onCanvas));
  const index = Math.min(active, results.length - 1);

  const pick = (item: CommandItem | undefined) => {
    if (!item) return;
    onPick(item.id);
    onClose();
  };

  const move = (next: number, scroll = false) => {
    setActive(next);
    if (scroll) {
      listRef.current?.children[next]?.scrollIntoView({ block: "nearest" });
    }
  };

  return (
    <>
      <input
        autoFocus
        value={query}
        placeholder="Add a component…"
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            const step = e.key === "ArrowDown" ? 1 : -1;
            move((index + step + results.length) % Math.max(1, results.length), true);
          } else if (e.key === "Enter") {
            e.preventDefault();
            pick(results[index]);
          } else if (e.key === "Escape") {
            e.preventDefault();
            onClose();
          }
        }}
        className="h-11 w-full border-b border-white/10 bg-transparent px-3.5 text-[14px] text-white outline-none placeholder:text-white/40"
      />
      <div ref={listRef} className="max-h-72 overflow-y-auto p-1.5">
        {results.map((item, i) => (
          <button
            key={item.id}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onPointerEnter={() => i !== index && move(i)}
            onClick={() => pick(item)}
            className="flex h-9 w-full cursor-pointer items-center px-0 text-left"
          >
            <span
              className={`flex h-full w-full items-center gap-3 rounded-lg px-2.5 text-[14px] ${
                i === index ? "bg-white/15 text-white" : ""
              }`}
            >
              <span className="min-w-0 flex-1 truncate">{item.title}</span>
              <span className="shrink-0 text-[14px] text-white/40">{item.onCanvas ? "Go to" : "Add"}</span>
            </span>
          </button>
        ))}
        {results.length === 0 && (
          <div className="px-2.5 py-6 text-center text-[14px] text-white/40">
            {items.length === 0 ? "No components in /artifacts yet" : "No matches"}
          </div>
        )}
      </div>
    </>
  );
}
