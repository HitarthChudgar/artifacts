"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from "react";

export type Camera = { x: number; y: number; scale: number };

export const MIN_SCALE = 0.1;
export const MAX_SCALE = 4;
const DOT_SPACING = 20;
// Higher = snappier easing toward the target camera.
const SMOOTHING = 16;

export const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

type Anchor = { sx: number; sy: number; wx: number; wy: number };

/**
 * Pan/zoom camera that writes transforms straight to the DOM once per frame,
 * so moving around never re-renders React. Discrete inputs (buttons, mouse
 * wheel notches, fit) ease toward a target; continuous ones (trackpad, drag)
 * apply immediately.
 */
export function useCamera({
  initial,
  viewportRef,
  worldRef,
  labelRef,
  onChange,
}: {
  initial: Camera;
  viewportRef: RefObject<HTMLDivElement | null>;
  worldRef: RefObject<HTMLDivElement | null>;
  labelRef: RefObject<HTMLElement | null>;
  onChange: (camera: Camera) => void;
}) {
  const current = useRef<Camera>({ ...initial });
  const target = useRef<Camera>({ ...initial });
  const anchor = useRef<Anchor | null>(null);
  const frame = useRef(0);
  const pendingApply = useRef(0);
  const settleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const onChangeRef = useRef(onChange);
  useLayoutEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const apply = useCallback(() => {
    const { x, y, scale } = current.current;
    const world = worldRef.current;
    const viewport = viewportRef.current;
    if (world) {
      world.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
      world.style.willChange = "transform";
      world.style.setProperty("--inv-scale", String(1 / scale));
    }
    if (viewport) {
      const dot = DOT_SPACING * scale;
      viewport.style.backgroundSize = `${dot}px ${dot}px`;
      viewport.style.backgroundPosition = `${x}px ${y}px`;
      viewport.style.backgroundImage =
        scale < 0.35 ? "none" : "radial-gradient(circle, #d4d4d8 1px, transparent 1px)";
    }
    if (labelRef.current) labelRef.current.textContent = `${Math.round(scale * 100)}%`;

    // Drop will-change once idle so the browser re-rasterizes text crisply at the new scale.
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      if (world) world.style.willChange = "auto";
      onChangeRef.current({ ...current.current });
    }, 150);
  }, [labelRef, viewportRef, worldRef]);

  const startAnimation = useCallback(() => {
    if (frame.current) return;
    let lastTime = 0;

    const tick = (time: number) => {
      const dt = Math.min(0.05, (time - (lastTime || time)) / 1000) || 1 / 60;
      lastTime = time;
      const c = current.current;
      const t = target.current;
      const k = 1 - Math.exp(-SMOOTHING * dt);

      // Interpolate zoom in log space so it feels even at every zoom level.
      const scale = Math.exp(Math.log(c.scale) + (Math.log(t.scale) - Math.log(c.scale)) * k);
      const a = anchor.current;
      const next = a
        ? { scale, x: a.sx - a.wx * scale, y: a.sy - a.wy * scale }
        : { scale, x: c.x + (t.x - c.x) * k, y: c.y + (t.y - c.y) * k };

      const done =
        Math.abs(Math.log(t.scale / next.scale)) < 0.0005 &&
        Math.abs(t.x - next.x) < 0.25 &&
        Math.abs(t.y - next.y) < 0.25;

      current.current = done ? { ...t } : next;
      apply();
      if (done) {
        frame.current = 0;
        anchor.current = null;
      } else {
        frame.current = requestAnimationFrame(tick);
      }
    };

    frame.current = requestAnimationFrame(tick);
  }, [apply]);

  const jump = useCallback(() => {
    target.current = { ...current.current };
    anchor.current = null;
    if (frame.current) {
      cancelAnimationFrame(frame.current);
      frame.current = 0;
    }
    if (pendingApply.current) return;
    pendingApply.current = requestAnimationFrame(() => {
      pendingApply.current = 0;
      apply();
    });
  }, [apply]);

  /** Pan by a screen-space delta. */
  const panBy = useCallback(
    (dx: number, dy: number, animate = false) => {
      if (animate) {
        anchor.current = null;
        target.current = { ...target.current, x: target.current.x + dx, y: target.current.y + dy };
        startAnimation();
      } else {
        current.current = { ...current.current, x: current.current.x + dx, y: current.current.y + dy };
        jump();
      }
    },
    [jump, startAnimation],
  );

  /** Zoom to `scale`, keeping the screen point (sx, sy) fixed. */
  const zoomTo = useCallback(
    (sx: number, sy: number, scale: number, animate = false) => {
      const c = current.current;
      const wx = (sx - c.x) / c.scale;
      const wy = (sy - c.y) / c.scale;
      const s = clampScale(scale);
      if (animate) {
        anchor.current = { sx, sy, wx, wy };
        target.current = { scale: s, x: sx - wx * s, y: sy - wy * s };
        startAnimation();
      } else {
        current.current = { scale: s, x: sx - wx * s, y: sy - wy * s };
        jump();
      }
    },
    [jump, startAnimation],
  );

  const zoomBy = useCallback(
    (sx: number, sy: number, factor: number, animate = false) => {
      // Stack consecutive animated zooms onto the pending target instead of the in-flight value.
      const base = animate && frame.current ? target.current.scale : current.current.scale;
      zoomTo(sx, sy, base * factor, animate);
    },
    [zoomTo],
  );

  const setCamera = useCallback(
    (camera: Camera, animate = false) => {
      anchor.current = null;
      target.current = { ...camera, scale: clampScale(camera.scale) };
      if (animate) {
        startAnimation();
      } else {
        current.current = { ...target.current };
        jump();
      }
    },
    [jump, startAnimation],
  );

  const getCamera = useCallback(() => current.current, []);

  useLayoutEffect(() => {
    apply();
  }, [apply]);

  useEffect(
    () => () => {
      cancelAnimationFrame(frame.current);
      cancelAnimationFrame(pendingApply.current);
      clearTimeout(settleTimer.current);
    },
    [],
  );

  return { getCamera, panBy, zoomTo, zoomBy, setCamera };
}
