"use client";

import { useEffect, useState } from "react";
import { GridReveal } from "@/app/components/grid-reveal";
import { useArtifactDial } from "@/app/lib/dial";

export const meta = { title: "grid-reveal", width: 360, height: 440 };

const MAX_HEIGHT = 312;
const ASPECTS: Record<string, number> = {
  "1:1": 1,
  "4:3": 4 / 3,
  "3:4": 3 / 4,
  "16:9": 16 / 9,
};

/** A fake image generation: the picture "arrives" after `delay` seconds. */
export default function GridRevealExample() {
  const [run, setRun] = useState(1);
  const [arrived, setArrived] = useState(0);

  const dial = useArtifactDial(
    "Grid Reveal",
    {
      generate: { type: "action", label: "Generate again" },
      delay: [4, 0.5, 15, 0.5],
      aspect: { type: "select", options: Object.keys(ASPECTS), default: "1:1" },
      caption: "Generating image…",
      background: "#ffffff",
    },
    { onAction: (action) => action === "generate" && setRun((r) => r + 1) },
  );

  const delayMs = dial.delay * 1000;
  useEffect(() => {
    const timer = setTimeout(() => setArrived(run), delayMs);
    return () => clearTimeout(timer);
  }, [run, delayMs]);

  const aspect = ASPECTS[dial.aspect] ?? 1;
  const size =
    aspect >= 1
      ? { w: 1200, h: Math.round(1200 / aspect) }
      : { w: Math.round(1200 * aspect), h: 1200 };
  const src =
    arrived === run
      ? `https://picsum.photos/seed/artifact-${run}/${size.w}/${size.h}`
      : null;

  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center gap-4 p-6"
      style={{ background: dial.background }}
    >
      <GridReveal
        key={run}
        src={src}
        alt="Generated image"
        aspect={aspect}
        caption={dial.caption || undefined}
        estimatedDuration={delayMs}
        style={{ maxWidth: MAX_HEIGHT * aspect }}
      />
      <button
        type="button"
        onClick={() => setRun((r) => r + 1)}
        className="h-8 rounded-full bg-zinc-900 px-4 text-xs font-medium text-white transition-[filter] hover:brightness-125"
      >
        Generate again
      </button>
    </div>
  );
}
