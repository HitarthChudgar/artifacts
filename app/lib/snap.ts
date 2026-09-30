export type SnapRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type AlignGuide = {
  axis: "x" | "y";
  pos: number;
  start: number;
  end: number;
};

/** Screen-pixel distance before an edge or center pulls into alignment. */
export const SNAP_SCREEN = 8;

const MATCH = 0.51;

export type SnapMove = (
  id: string,
  box: SnapRect,
  opts?: { disable?: boolean },
) => { x: number; y: number };

type AxisTarget = { edges: number[]; span: [number, number] };

function xs(r: SnapRect) {
  return [r.x, r.x + r.w / 2, r.x + r.w];
}

function ys(r: SnapRect) {
  return [r.y, r.y + r.h / 2, r.y + r.h];
}

function snapAxis(
  movingEdges: number[],
  movingSpan: [number, number],
  others: AxisTarget[],
  threshold: number,
): { delta: number; guides: { pos: number; start: number; end: number }[] } | null {
  let best = Infinity;
  let delta = 0;
  for (const other of others) {
    for (const m of movingEdges) {
      for (const edge of other.edges) {
        const d = edge - m;
        const a = Math.abs(d);
        if (a < best) {
          best = a;
          delta = d;
        }
      }
    }
  }
  if (best > threshold) return null;

  const byPos = new Map<number, { start: number; end: number }>();
  for (const other of others) {
    for (const m of movingEdges) {
      for (const edge of other.edges) {
        if (Math.abs(edge - (m + delta)) > MATCH) continue;
        const pos = Math.round(edge * 2) / 2;
        const start = Math.min(movingSpan[0], other.span[0]);
        const end = Math.max(movingSpan[1], other.span[1]);
        const prev = byPos.get(pos);
        if (!prev) byPos.set(pos, { start, end });
        else {
          prev.start = Math.min(prev.start, start);
          prev.end = Math.max(prev.end, end);
        }
      }
    }
  }
  return {
    delta,
    guides: [...byPos.entries()].map(([pos, g]) => ({ pos, ...g })),
  };
}

/** Snap a box to other boxes' edges and centers. X and Y are independent. */
export function snapBox(
  moving: SnapRect,
  others: SnapRect[],
  threshold: number,
): { x: number; y: number; guides: AlignGuide[] } {
  if (!others.length) return { x: moving.x, y: moving.y, guides: [] };

  const xHit = snapAxis(
    xs(moving),
    [moving.y, moving.y + moving.h],
    others.map((o) => ({ edges: xs(o), span: [o.y, o.y + o.h] as [number, number] })),
    threshold,
  );
  const yHit = snapAxis(
    ys(moving),
    [moving.x, moving.x + moving.w],
    others.map((o) => ({ edges: ys(o), span: [o.x, o.x + o.w] as [number, number] })),
    threshold,
  );

  const x = moving.x + (xHit?.delta ?? 0);
  const y = moving.y + (yHit?.delta ?? 0);
  const guides: AlignGuide[] = [];

  if (xHit) {
    for (const g of xHit.guides) {
      guides.push({
        axis: "x",
        pos: g.pos,
        start: Math.min(y, g.start),
        end: Math.max(y + moving.h, g.end),
      });
    }
  }
  if (yHit) {
    for (const g of yHit.guides) {
      guides.push({
        axis: "y",
        pos: g.pos,
        start: Math.min(x, g.start),
        end: Math.max(x + moving.w, g.end),
      });
    }
  }

  return { x, y, guides };
}

export function collectSnapRects(
  excludeId: string,
  world: HTMLElement,
  viewport: DOMRect,
  cam: { x: number; y: number; scale: number },
  arrows: Record<string, { x1: number; y1: number; x2: number; y2: number }>,
): SnapRect[] {
  const rects: SnapRect[] = [];
  for (const el of world.querySelectorAll<HTMLElement>("[data-node-id]")) {
    const id = el.dataset.nodeId;
    if (!id || id === excludeId) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 0.5 || r.height < 0.5) continue;
    rects.push({
      x: (r.left - viewport.left - cam.x) / cam.scale,
      y: (r.top - viewport.top - cam.y) / cam.scale,
      w: r.width / cam.scale,
      h: r.height / cam.scale,
    });
  }
  for (const [id, a] of Object.entries(arrows)) {
    if (id === excludeId) continue;
    rects.push({
      x: Math.min(a.x1, a.x2),
      y: Math.min(a.y1, a.y2),
      w: Math.abs(a.x2 - a.x1),
      h: Math.abs(a.y2 - a.y1),
    });
  }
  return rects;
}
