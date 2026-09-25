"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { toMotion, useArtifactDial } from "@/app/lib/dial";

export const meta = { title: "invite-card", width: 300, height: 480 };

export default function Invite() {
  const [status, setStatus] = useState<"pending" | "accepted" | "declined">("pending");
  const dial = useArtifactDial("Invite", {
    content: {
      message: "Thx for coming 🎉",
      from: "Christine",
      accept: "Accept",
      decline: "Decline",
    },
    layout: {
      padding: [24, 8, 48],
      titleSize: [24, 14, 44],
      titleWeight: [600, 300, 800, 100],
      buttonHeight: [48, 32, 64],
      buttonRadius: [999, 0, 999],
      buttonGap: [12, 0, 32],
    },
    colors: {
      background: "#09090b",
      text: "#ffffff",
      muted: "#a1a1aa",
      acceptBg: "#ffffff",
      acceptText: "#000000",
      declineBg: "#27272a",
    },
    motion: {
      swap: { type: "spring", visualDuration: 0.3, bounce: 0.25 },
      pressScale: [0.95, 0.8, 1, 0.01],
    },
  });

  const { content, layout, colors } = dial;
  const transition = toMotion(dial.motion.swap);
  const button = {
    height: layout.buttonHeight,
    borderRadius: layout.buttonRadius,
  };

  return (
    <div
      className="flex h-full w-full flex-col justify-between"
      style={{ background: colors.background, color: colors.text, padding: layout.padding }}
    >
      <div>
        <div style={{ fontSize: layout.titleSize, fontWeight: layout.titleWeight, lineHeight: 1.2 }}>
          &ldquo;{content.message}&rdquo;
        </div>
        <div className="mt-2 text-sm" style={{ color: colors.muted }}>
          From {content.from}
        </div>
      </div>

      <AnimatePresence mode="popLayout" initial={false}>
        {status === "pending" ? (
          <motion.div
            key="pending"
            className="flex"
            style={{ gap: layout.buttonGap }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={transition}
          >
            <motion.button
              onClick={() => setStatus("declined")}
              whileTap={{ scale: dial.motion.pressScale }}
              className="flex-1 text-sm font-medium transition-[filter] hover:brightness-125"
              style={{ ...button, background: colors.declineBg, color: colors.text }}
            >
              {content.decline}
            </motion.button>
            <motion.button
              onClick={() => setStatus("accepted")}
              whileTap={{ scale: dial.motion.pressScale }}
              className="flex-1 text-sm font-medium transition-[filter] hover:brightness-90"
              style={{ ...button, background: colors.acceptBg, color: colors.acceptText }}
            >
              {content.accept}
            </motion.button>
          </motion.div>
        ) : (
          <motion.button
            key="resolved"
            onClick={() => setStatus("pending")}
            whileTap={{ scale: dial.motion.pressScale }}
            className="w-full text-sm"
            style={{ ...button, background: colors.declineBg, color: colors.muted }}
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12 }}
            transition={transition}
          >
            {status === "accepted" ? "Accepted ✓" : "Declined"} · undo
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
