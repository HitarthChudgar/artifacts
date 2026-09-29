"use client";

import { Command } from "cmdk";
import { AnimatePresence, motion } from "motion/react";

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
  const sorted = [...items].sort((a, b) => Number(a.onCanvas) - Number(b.onCanvas));

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
            <Command
              loop
              label="Add a component"
              className="flex flex-col"
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  onClose();
                }
              }}
            >
              <Command.Input
                autoFocus
                placeholder="Add a component…"
                className="h-11 w-full border-b border-white/10 bg-transparent px-3.5 text-[14px] text-white outline-none placeholder:text-white/40"
              />
              <Command.List className="max-h-72 overflow-y-auto p-1.5">
                <Command.Empty className="px-2.5 py-6 text-center text-[14px] text-white/40">
                  {items.length === 0 ? "No components in /artifacts yet" : "No matches"}
                </Command.Empty>
                {sorted.map((item) => (
                  <Command.Item
                    key={item.id}
                    value={`${item.title} ${item.id}`}
                    onSelect={() => {
                      onPick(item.id);
                      onClose();
                    }}
                    className="flex h-9 cursor-pointer items-center gap-3 rounded-lg px-2.5 text-[14px] outline-none data-[selected=true]:bg-white/15 data-[selected=true]:text-white"
                  >
                    <span className="min-w-0 flex-1 truncate">{item.title}</span>
                    <span className="shrink-0 text-[14px] text-white/40">{item.onCanvas ? "Go to" : "Add"}</span>
                  </Command.Item>
                ))}
              </Command.List>
            </Command>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
