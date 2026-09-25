"use client";

import dynamic from "next/dynamic";

// Canvas reads layout from localStorage on first render, so it only renders on the client.
const Canvas = dynamic(() => import("./Canvas"), { ssr: false });

export default function CanvasLoader() {
  return <Canvas />;
}
