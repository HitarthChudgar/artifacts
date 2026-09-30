"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { artifacts } from "../lib/artifacts";
import { capturePointer } from "../lib/pointer";
import {
  ArtifactBody,
  ArtifactCard,
  HEADER_HEIGHT,
  type CardLayout,
} from "./ArtifactCard";
import {
  fetchPreview,
  isImageUrl,
  isSvgFile,
  isSvgSrc,
  loadImageSize,
  parseUrl,
  svgFileFromClipboard,
  uploadImage,
  type MediaItem,
} from "../lib/media";
import { ArrowNode, type ArrowItem } from "./ArrowNode";
import { CommandMenu } from "./CommandMenu";
import { DialPanel } from "./DialPanel";
import { MediaNode } from "./MediaNode";
import { TextNode, type TextItem } from "./TextNode";
import { clampScale, useCamera, type Camera } from "./useCamera";
import {
  collectSnapRects,
  SNAP_SCREEN,
  snapBox,
  type AlignGuide,
  type SnapMove,
} from "../lib/snap";

type Saved = {
  camera: Camera;
  layouts: Record<string, CardLayout>;
  texts?: Record<string, TextItem>;
  arrows?: Record<string, ArrowItem>;
  media?: Record<string, MediaItem>;
};

type Tool = "select" | "arrow";

const TEXT_PREFIX = "text:";
const ARROW_PREFIX = "arrow:";
const MEDIA_PREFIX = "media:";
// On-screen size new images/links are placed at, independent of zoom.
const MAX_IMAGE_SCREEN = 480;
const LINK_SCREEN = { w: 640, h: 420 };
const MIN_ARROW_LENGTH = 6;
const DEFAULT_TEXT_SIZE = 32;

const STORAGE_KEY = "artifact-canvas:v1";
const GAP = 24;
const WHEEL_ZOOM_STEP = 1.25;
const BUTTON_ZOOM_STEP = 1.2;
const DEFAULT_CAMERA: Camera = { x: 48, y: 72, scale: 1 };

function loadSaved(): Saved {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Saved;
  } catch {}
  return { camera: DEFAULT_CAMERA, layouts: {} };
}

// Trackpads send many small pixel deltas; mouse wheels send few large (or line-based) ones.
const isMouseWheel = (e: WheelEvent) =>
  e.deltaMode !== 0 ||
  (e.deltaX === 0 && Number.isInteger(e.deltaY) && Math.abs(e.deltaY) >= 50);

export default function Canvas() {
  const [initial] = useState(loadSaved);
  const [stored, setStored] = useState<Record<string, CardLayout>>(
    initial.layouts,
  );
  const [texts, setTexts] = useState<Record<string, TextItem>>(
    initial.texts ?? {},
  );
  const [editingText, setEditingText] = useState<string | null>(null);
  const [arrows, setArrows] = useState<Record<string, ArrowItem>>(
    initial.arrows ?? {},
  );
  const [media, setMedia] = useState<Record<string, MediaItem>>(() =>
    // Blob URLs from an unfinished upload don't survive a reload.
    Object.fromEntries(
      Object.entries(initial.media ?? {}).filter(
        ([, m]) => !(m.kind === "image" && m.src.startsWith("blob:")),
      ),
    ),
  );
  const [tool, setTool] = useState<Tool>("select");
  const lastPointer = useRef<{ x: number; y: number } | null>(null);
  const drawing = useRef<{ id: string; x1: number; y1: number } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [panning, setPanning] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [guides, setGuides] = useState<AlignGuide[]>([]);

  const viewportRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const zoomLabelRef = useRef<HTMLSpanElement>(null);
  const spaceDown = useRef(false);
  const pan = useRef<{ lastX: number; lastY: number } | null>(null);
  const savedCamera = useRef(initial.camera);

  // Artifacts without a saved layout are placed in a row to the right of everything else.
  const layouts = useMemo(() => {
    const result: Record<string, CardLayout> = {};
    let right = 0;
    let topZ = 0;
    for (const a of artifacts) {
      const l = stored[a.id];
      if (l) {
        result[a.id] = l;
        right = Math.max(right, l.x + l.w + GAP);
        topZ = Math.max(topZ, l.z);
      }
    }
    for (const a of artifacts) {
      if (result[a.id]) continue;
      result[a.id] = { x: right, y: 0, w: a.width, h: a.height, z: ++topZ };
      right += a.width + GAP;
    }
    return result;
  }, [stored]);

  const layoutsRef = useRef(layouts);
  const textsRef = useRef(texts);
  const arrowsRef = useRef(arrows);
  const mediaRef = useRef(media);
  const selectedRef = useRef(selected);
  useLayoutEffect(() => {
    layoutsRef.current = layouts;
    textsRef.current = texts;
    arrowsRef.current = arrows;
    mediaRef.current = media;
    selectedRef.current = selected;
  }, [layouts, texts, arrows, media, selected]);

  const save = useCallback(() => {
    const data: Saved = {
      camera: savedCamera.current,
      layouts: layoutsRef.current,
      texts: textsRef.current,
      arrows: arrowsRef.current,
      media: mediaRef.current,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, []);

  useEffect(() => {
    const t = setTimeout(save, 250);
    return () => clearTimeout(t);
  }, [layouts, texts, arrows, media, save]);

  // Everything on the canvas shares one stacking order.
  const topZ = useCallback(
    () =>
      Math.max(
        0,
        ...Object.values(layoutsRef.current).map((l) => l.z),
        ...Object.values(textsRef.current).map((t) => t.z),
        ...Object.values(arrowsRef.current).map((a) => a.z),
        ...Object.values(mediaRef.current).map((m) => m.z),
      ),
    [],
  );

  const camera = useCamera({
    initial: initial.camera,
    viewportRef,
    worldRef,
    labelRef: zoomLabelRef,
    onChange: useCallback(
      (c: Camera) => {
        savedCamera.current = c;
        save();
      },
      [save],
    ),
  });
  const { getCamera, panBy, zoomBy, zoomTo, setCamera } = camera;

  const getScale = useCallback(() => getCamera().scale, [getCamera]);

  const snapMove = useCallback<SnapMove>(
    (id, box, opts) => {
      if (opts?.disable) {
        setGuides((g) => (g.length ? [] : g));
        return { x: box.x, y: box.y };
      }
      const viewport = viewportRef.current;
      const world = worldRef.current;
      if (!viewport || !world) return { x: box.x, y: box.y };
      const cam = getCamera();
      const result = snapBox(
        box,
        collectSnapRects(
          id,
          world,
          viewport.getBoundingClientRect(),
          cam,
          arrowsRef.current,
        ),
        SNAP_SCREEN / cam.scale,
      );
      setGuides(result.guides);
      return { x: result.x, y: result.y };
    },
    [getCamera],
  );

  const endSnap = useCallback(() => {
    setGuides((g) => (g.length ? [] : g));
  }, []);

  const updateLayout = useCallback((id: string, patch: Partial<CardLayout>) => {
    setStored((prev) => ({
      ...prev,
      [id]: { ...layoutsRef.current[id], ...prev[id], ...patch },
    }));
  }, []);

  const select = useCallback(
    (id: string) => {
      setSelected(id);
      const top = topZ();
      const card = layoutsRef.current[id];
      const text = textsRef.current[id];
      if (card && card.z < top) {
        setStored((prev) => ({
          ...prev,
          [id]: { ...card, ...prev[id], z: top + 1 },
        }));
      }
      if (text && text.z < top) {
        setTexts((prev) => ({ ...prev, [id]: { ...prev[id], z: top + 1 } }));
      }
      const arrow = arrowsRef.current[id];
      if (arrow && arrow.z < top) {
        setArrows((prev) => ({ ...prev, [id]: { ...prev[id], z: top + 1 } }));
      }
      const m = mediaRef.current[id];
      if (m && m.z < top) {
        setMedia((prev) => ({ ...prev, [id]: { ...prev[id], z: top + 1 } }));
      }
    },
    [topZ],
  );

  const updateMedia = useCallback((id: string, patch: Partial<MediaItem>) => {
    setMedia((prev) =>
      prev[id]
        ? { ...prev, [id]: { ...prev[id], ...patch } as MediaItem }
        : prev,
    );
  }, []);

  const deleteMedia = useCallback((id: string) => {
    setMedia((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setSelected((s) => (s === id ? null : s));
  }, []);

  /** World position for new content: the last pointer position over the canvas, or its center. */
  const dropPoint = useCallback(
    (screen?: { x: number; y: number }) => {
      const el = viewportRef.current;
      const cam = getCamera();
      const p = screen ??
        lastPointer.current ?? {
          x: (el?.clientWidth ?? 0) / 2,
          y: (el?.clientHeight ?? 0) / 2,
        };
      return {
        x: (p.x - cam.x) / cam.scale,
        y: (p.y - cam.y) / cam.scale,
        scale: cam.scale,
      };
    },
    [getCamera],
  );

  const placeImage = useCallback(
    async (
      src: string,
      at: { x: number; y: number; scale: number },
      file?: File,
    ) => {
      const { width, height } = await loadImageSize(src);
      const fit = Math.min(1, MAX_IMAGE_SCREEN / Math.max(width, height));
      const w = (width * fit) / at.scale;
      const h = (height * fit) / at.scale;
      const id = MEDIA_PREFIX + crypto.randomUUID().slice(0, 8);
      setMedia((prev) => ({
        ...prev,
        [id]: {
          kind: "image",
          src,
          name: file?.name,
          uploading: !!file,
          svg: file ? isSvgFile(file) : isSvgSrc(src),
          x: at.x - w / 2,
          y: at.y - h / 2,
          w,
          h,
          z: topZ() + 1,
        },
      }));
      setSelected(id);
      if (!file) return;
      try {
        const url = await uploadImage(file);
        updateMedia(id, { src: url, uploading: false });
      } catch (err) {
        console.error(err);
        deleteMedia(id);
        window.alert(`Couldn't add ${file.name}: ${(err as Error).message}`);
      } finally {
        URL.revokeObjectURL(src);
      }
    },
    [deleteMedia, topZ, updateMedia],
  );

  const placeLink = useCallback(
    async (url: string, at: { x: number; y: number; scale: number }) => {
      const w = LINK_SCREEN.w / at.scale;
      const h = LINK_SCREEN.h / at.scale;
      const id = MEDIA_PREFIX + crypto.randomUUID().slice(0, 8);
      setMedia((prev) => ({
        ...prev,
        [id]: {
          kind: "link",
          url,
          x: at.x - w / 2,
          y: at.y - h / 2,
          w,
          h,
          z: topZ() + 1,
        },
      }));
      setSelected(id);
      updateMedia(id, { preview: await fetchPreview(url) });
    },
    [topZ, updateMedia],
  );

  /** Place pasted/dropped files and URLs, fanning multiple items out so they don't stack. */
  const placeContent = useCallback(
    (files: File[], text: string, screen?: { x: number; y: number }) => {
      const at = dropPoint(screen);
      const images = files.filter(
        (f) => f.type.startsWith("image/") || isSvgFile(f),
      );
      images.forEach((file, i) => {
        const offset = (i * 32) / at.scale;
        placeImage(
          URL.createObjectURL(file),
          { ...at, x: at.x + offset, y: at.y + offset },
          file,
        );
      });
      if (images.length) return true;

      const url = parseUrl(text);
      if (!url) return false;
      if (isImageUrl(url)) placeImage(url.href, at);
      else placeLink(url.href, at);
      return true;
    },
    [dropPoint, placeImage, placeLink],
  );

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const t = e.target;
      if (
        t instanceof HTMLElement &&
        (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))
      )
        return;
      const data = e.clipboardData;
      if (!data) return;
      const files = [...data.files];
      const svg = svgFileFromClipboard(data);
      if (svg && !files.some((f) => f === svg)) files.push(svg);
      if (placeContent(files, data.getData("text/plain"))) e.preventDefault();
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [placeContent]);

  const updateArrow = useCallback((id: string, patch: Partial<ArrowItem>) => {
    setArrows((prev) =>
      prev[id] ? { ...prev, [id]: { ...prev[id], ...patch } } : prev,
    );
  }, []);

  const deleteArrow = useCallback((id: string) => {
    setArrows((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setSelected((s) => (s === id ? null : s));
  }, []);

  const updateText = useCallback((id: string, patch: Partial<TextItem>) => {
    setTexts((prev) =>
      prev[id] ? { ...prev, [id]: { ...prev[id], ...patch } } : prev,
    );
  }, []);

  const deleteText = useCallback((id: string) => {
    setTexts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setSelected((s) => (s === id ? null : s));
  }, []);

  /** Add a text node at a screen point (defaults to the viewport center) and start editing it. */
  const addText = useCallback(
    (sx?: number, sy?: number) => {
      const el = viewportRef.current;
      if (!el) return;
      const cam = getCamera();
      const px = sx ?? el.clientWidth / 2;
      const py = sy ?? el.clientHeight / 2;
      const size = Math.round(DEFAULT_TEXT_SIZE / cam.scale);
      const id = TEXT_PREFIX + crypto.randomUUID().slice(0, 8);
      setTexts((prev) => ({
        ...prev,
        [id]: {
          x: (px - cam.x) / cam.scale,
          y: (py - cam.y) / cam.scale - size * 0.6,
          z: topZ() + 1,
          text: "Text",
          size,
        },
      }));
      setSelected(id);
      setEditingText(id);
    },
    [getCamera, topZ],
  );

  const center = useCallback(() => {
    const el = viewportRef.current;
    return el
      ? { x: el.clientWidth / 2, y: el.clientHeight / 2 }
      : { x: 0, y: 0 };
  }, []);

  const zoomStep = (factor: number) => {
    const c = center();
    zoomBy(c.x, c.y, factor, true);
  };

  const resetZoom = useCallback(() => {
    const c = center();
    zoomTo(c.x, c.y, 1, true);
  }, [center, zoomTo]);

  const removeArtifact = useCallback(
    (id: string) => {
      updateLayout(id, { hidden: true });
      setSelected((s) => (s === id ? null : s));
    },
    [updateLayout],
  );

  /** Put a removed artifact back in the middle of the view, or pan to one that's already on the canvas. */
  const showArtifact = useCallback(
    (id: string) => {
      const el = viewportRef.current;
      const l = layoutsRef.current[id];
      if (!el || !l) return;
      const cam = getCamera();
      const cx = (el.clientWidth / 2 - cam.x) / cam.scale;
      const cy = (el.clientHeight / 2 - cam.y) / cam.scale;
      if (l.hidden) {
        updateLayout(id, {
          hidden: undefined,
          x: cx - l.w / 2,
          y: cy - (l.h + HEADER_HEIGHT) / 2,
          z: topZ() + 1,
        });
        setSelected(id);
        return;
      }
      select(id);
      setCamera(
        {
          scale: cam.scale,
          x: el.clientWidth / 2 - (l.x + l.w / 2) * cam.scale,
          y:
            el.clientHeight / 2 - (l.y + (l.h + HEADER_HEIGHT) / 2) * cam.scale,
        },
        true,
      );
    },
    [getCamera, select, setCamera, topZ, updateLayout],
  );

  const fitAll = useCallback(() => {
    const el = viewportRef.current;
    const all = Object.values(layoutsRef.current).filter((l) => !l.hidden);
    if (!el || all.length === 0) return;
    const minX = Math.min(...all.map((l) => l.x));
    const minY = Math.min(...all.map((l) => l.y));
    const maxX = Math.max(...all.map((l) => l.x + l.w));
    const maxY = Math.max(...all.map((l) => l.y + l.h + HEADER_HEIGHT));
    const pad = 64;
    const scale = clampScale(
      Math.min(
        1,
        (el.clientWidth - pad * 2) / (maxX - minX),
        (el.clientHeight - pad * 2) / (maxY - minY),
      ),
    );
    setCamera(
      {
        scale,
        x: (el.clientWidth - (maxX - minX) * scale) / 2 - minX * scale,
        y: (el.clientHeight - (maxY - minY) * scale) / 2 - minY * scale,
      },
      true,
    );
  }, [setCamera]);

  // Wheel: pan by default, zoom with ctrl/cmd (also what trackpad pinch sends).
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const zooming = e.ctrlKey || e.metaKey;
      if (!zooming && canScroll(e.target, e.deltaX, e.deltaY, el)) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const mouse = isMouseWheel(e);

      if (zooming) {
        if (mouse) {
          zoomBy(
            sx,
            sy,
            e.deltaY > 0 ? 1 / WHEEL_ZOOM_STEP : WHEEL_ZOOM_STEP,
            true,
          );
        } else {
          zoomBy(
            sx,
            sy,
            Math.exp(-Math.max(-30, Math.min(30, e.deltaY)) * 0.01),
          );
        }
      } else {
        const unit = e.deltaMode === 1 ? 16 : 1;
        panBy(-e.deltaX * unit, -e.deltaY * unit, mouse);
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [panBy, zoomBy]);

  useEffect(() => {
    const isTyping = (t: EventTarget | null) =>
      t instanceof HTMLElement &&
      (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setMenuOpen((open) => !open);
        return;
      }
      if (isTyping(e.target)) return;
      if (e.code === "Space") {
        spaceDown.current = true;
        e.preventDefault();
      }
      if (e.key === "Escape") {
        setExpanded(null);
        setSelected(null);
        setTool("select");
      }
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "0") {
        e.preventDefault();
        resetZoom();
      }
      if (e.shiftKey && e.key === "!") fitAll();
      if (!mod && (e.key === "t" || e.key === "T")) addText();
      if (!mod && (e.key === "a" || e.key === "A"))
        setTool((t) => (t === "arrow" ? "select" : "arrow"));
      if (e.key === "Backspace" || e.key === "Delete") {
        const id = selectedRef.current;
        if (id?.startsWith(TEXT_PREFIX)) deleteText(id);
        else if (id?.startsWith(ARROW_PREFIX)) deleteArrow(id);
        else if (id?.startsWith(MEDIA_PREFIX)) deleteMedia(id);
        else if (id && layoutsRef.current[id]) removeArtifact(id);
        else return;
        e.preventDefault();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") spaceDown.current = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [
    addText,
    deleteArrow,
    deleteMedia,
    deleteText,
    fitAll,
    removeArtifact,
    resetZoom,
  ]);

  const toWorld = (clientX: number, clientY: number) => {
    const rect = viewportRef.current!.getBoundingClientRect();
    const cam = getCamera();
    return {
      x: (clientX - rect.left - cam.x) / cam.scale,
      y: (clientY - rect.top - cam.y) / cam.scale,
    };
  };

  const onPointerDownCapture = (e: ReactPointerEvent<HTMLDivElement>) => {
    const focused = document.activeElement;
    if (focused instanceof HTMLElement && focused.closest("[data-toolbar]")) {
      focused.blur();
    }
    if (tool === "arrow" && e.button === 0 && !spaceDown.current) {
      e.preventDefault();
      e.stopPropagation();
      capturePointer(e.currentTarget, e.pointerId);
      const p = toWorld(e.clientX, e.clientY);
      const id = ARROW_PREFIX + crypto.randomUUID().slice(0, 8);
      drawing.current = { id, x1: p.x, y1: p.y };
      setArrows((prev) => ({
        ...prev,
        [id]: { x1: p.x, y1: p.y, x2: p.x, y2: p.y, z: topZ() + 1 },
      }));
      setSelected(id);
      return;
    }
    const onBackground =
      e.target === e.currentTarget || (e.target as HTMLElement).dataset.world;
    const wantsPan =
      e.button === 1 || (e.button === 0 && (spaceDown.current || onBackground));
    if (!wantsPan) return;
    if (onBackground) setSelected(null);
    e.preventDefault();
    e.stopPropagation();
    capturePointer(e.currentTarget, e.pointerId);
    pan.current = { lastX: e.clientX, lastY: e.clientY };
    setPanning(true);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    lastPointer.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const d = drawing.current;
    if (d) {
      let { x, y } = toWorld(e.clientX, e.clientY);
      if (e.shiftKey) {
        // Snap to 45° increments.
        const len = Math.hypot(x - d.x1, y - d.y1);
        const angle =
          Math.round(Math.atan2(y - d.y1, x - d.x1) / (Math.PI / 4)) *
          (Math.PI / 4);
        x = d.x1 + Math.cos(angle) * len;
        y = d.y1 + Math.sin(angle) * len;
      }
      updateArrow(d.id, { x2: x, y2: y });
      return;
    }
    const p = pan.current;
    if (!p) return;
    panBy(e.clientX - p.lastX, e.clientY - p.lastY);
    p.lastX = e.clientX;
    p.lastY = e.clientY;
  };

  const endPan = () => {
    const d = drawing.current;
    if (d) {
      drawing.current = null;
      const a = arrowsRef.current[d.id];
      if (
        a &&
        Math.hypot(a.x2 - a.x1, a.y2 - a.y1) * getCamera().scale <
          MIN_ARROW_LENGTH
      ) {
        deleteArrow(d.id);
      }
      setTool("select");
    }
    pan.current = null;
    setPanning(false);
  };

  const expandedArtifact = artifacts.find((a) => a.id === expanded);
  const dialTarget = expanded ?? selected;
  const dialTargetName = dialTarget
    ? layouts[dialTarget]?.name ||
      artifacts.find((a) => a.id === dialTarget)?.title
    : undefined;

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#f4f4f5] text-zinc-900">
      <div
        ref={viewportRef}
        className={`absolute inset-0 touch-none ${panning ? "cursor-grabbing" : ""} ${
          tool === "arrow" ? "cursor-crosshair [&_*]:!cursor-crosshair" : ""
        }`}
        onPointerDownCapture={onPointerDownCapture}
        onPointerMove={onPointerMove}
        onPointerUp={endPan}
        onPointerCancel={endPan}
        onDoubleClick={(e) => {
          const onBackground =
            e.target === e.currentTarget ||
            (e.target as HTMLElement).dataset.world;
          if (!onBackground) return;
          const rect = e.currentTarget.getBoundingClientRect();
          addText(e.clientX - rect.left, e.clientY - rect.top);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }}
        onDrop={(e) => {
          e.preventDefault();
          const rect = e.currentTarget.getBoundingClientRect();
          placeContent(
            [...e.dataTransfer.files],
            e.dataTransfer.getData("text/uri-list").split("\n")[0] ||
              e.dataTransfer.getData("text/plain"),
            { x: e.clientX - rect.left, y: e.clientY - rect.top },
          );
        }}
      >
        <div
          ref={worldRef}
          data-world
          className="absolute top-0 left-0 origin-top-left"
        >
          {artifacts
            .filter((a) => !layouts[a.id].hidden)
            .map((a) => (
              <ArtifactCard
                key={a.id}
                artifact={a}
                layout={layouts[a.id]}
                selected={selected === a.id}
                getScale={getScale}
                onChange={updateLayout}
                onSelect={select}
                snap={snapMove}
                onSnapEnd={endSnap}
              />
            ))}
          {Object.entries(texts).map(([id, item]) => (
            <TextNode
              key={id}
              id={id}
              item={item}
              selected={selected === id}
              editing={editingText === id}
              getScale={getScale}
              onChange={updateText}
              onSelect={select}
              onEdit={setEditingText}
              onDelete={deleteText}
              snap={snapMove}
              onSnapEnd={endSnap}
            />
          ))}
          {Object.entries(media).map(([id, item]) => (
            <MediaNode
              key={id}
              id={id}
              item={item}
              selected={selected === id}
              getScale={getScale}
              onChange={updateMedia}
              onSelect={select}
              snap={snapMove}
              onSnapEnd={endSnap}
            />
          ))}
          {Object.entries(arrows).map(([id, item]) => (
            <ArrowNode
              key={id}
              id={id}
              item={item}
              selected={selected === id}
              getScale={getScale}
              onChange={updateArrow}
              onSelect={select}
              snap={snapMove}
              onSnapEnd={endSnap}
            />
          ))}
          {guides.length > 0 && (
            <svg
              className="pointer-events-none absolute top-0 left-0 overflow-visible"
              width={1}
              height={1}
              style={{ zIndex: 2147483646 }}
            >
              {guides.map((g) => (
                <line
                  key={`${g.axis}:${g.pos}:${g.start}:${g.end}`}
                  x1={g.axis === "x" ? g.pos : g.start}
                  y1={g.axis === "x" ? g.start : g.pos}
                  x2={g.axis === "x" ? g.pos : g.end}
                  y2={g.axis === "x" ? g.end : g.pos}
                  stroke="#EF4444"
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </svg>
          )}
        </div>

        {artifacts.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="text-center text-sm text-zinc-500">
              <div className="font-medium text-zinc-700">No artifacts yet</div>
              Drop a <code className="font-mono">.tsx</code> file with a default
              export into <code className="font-mono">/artifacts</code>
            </div>
          </div>
        )}
      </div>

      <div
        data-toolbar
        className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-[14px] bg-[#212121] p-1.5 text-[14px] text-white/70 shadow-[0_4px_16px_rgba(0,0,0,0.25)] ring-1 ring-white/10 select-none"
        // Clicked buttons must not keep focus, or Space (pan) / Enter would re-trigger them.
        onMouseDown={(e) => e.preventDefault()}
      >
        <ToolbarButton
          label="Add component (⌘K)"
          active={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="4" y="4" width="6" height="6" rx="1.5" />
            <rect x="14" y="4" width="6" height="6" rx="1.5" />
            <rect x="4" y="14" width="6" height="6" rx="1.5" />
            <path d="M17 14v6M14 17h6" />
          </svg>
        </ToolbarButton>
        <ToolbarButton label="Add text (T)" onClick={() => addText()}>
          <span className="font-serif font-semibold">T</span>
        </ToolbarButton>
        <ToolbarButton
          label="Arrow (A)"
          active={tool === "arrow"}
          onClick={() => setTool((t) => (t === "arrow" ? "select" : "arrow"))}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 19 19 5M9 5h10v10" />
          </svg>
        </ToolbarButton>
        <div className="mx-0.5 h-5 w-px bg-white/10" />
        <ToolbarButton
          label="Zoom out"
          onClick={() => zoomStep(1 / BUTTON_ZOOM_STEP)}
        >
          −
        </ToolbarButton>
        <ToolbarButton
          label="Reset zoom (⌘0)"
          className="w-12 tabular-nums"
          onClick={resetZoom}
        >
          <span ref={zoomLabelRef} />
        </ToolbarButton>
        <ToolbarButton
          label="Zoom in"
          onClick={() => zoomStep(BUTTON_ZOOM_STEP)}
        >
          +
        </ToolbarButton>
        <div className="mx-0.5 h-5 w-px bg-white/10" />
        <ToolbarButton
          label="Fit all (⇧1)"
          className="w-auto px-2.5"
          onClick={fitAll}
        >
          Fit
        </ToolbarButton>
      </div>

      {expandedArtifact && (
        <div
          className="fixed inset-0 z-[100000] flex flex-col bg-black/40 p-6 backdrop-blur-sm"
          onPointerDown={(e) =>
            e.target === e.currentTarget && setExpanded(null)
          }
        >
          <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex h-10 shrink-0 items-center justify-between border-b border-black/5 px-3">
              <span className="font-mono text-xs text-zinc-500">
                {layouts[expandedArtifact.id]?.name || expandedArtifact.title}
              </span>
              <button
                type="button"
                onClick={() => setExpanded(null)}
                className="h-7 rounded-md px-2 text-xs text-zinc-500 hover:bg-black/5 hover:text-zinc-900"
              >
                Close (Esc)
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <ArtifactBody
                id={expandedArtifact.id}
                Component={expandedArtifact.Component}
              />
            </div>
          </div>
        </div>
      )}

      <div className="relative z-[100001]">
        <DialPanel artifactId={dialTarget} title={dialTargetName} />
      </div>

      <CommandMenu
        open={menuOpen}
        items={artifacts.map((a) => ({
          id: a.id,
          title: layouts[a.id]?.name || a.title,
          onCanvas: !layouts[a.id]?.hidden,
        }))}
        onPick={showArtifact}
        onClose={() => setMenuOpen(false)}
      />
    </div>
  );
}

function canScroll(
  target: EventTarget | null,
  dx: number,
  dy: number,
  stop: Element,
) {
  let node = target instanceof Element ? target : null;
  while (node && node !== stop) {
    const style = getComputedStyle(node);
    const scrollY =
      /(auto|scroll)/.test(style.overflowY) &&
      node.scrollHeight > node.clientHeight;
    const scrollX =
      /(auto|scroll)/.test(style.overflowX) &&
      node.scrollWidth > node.clientWidth;
    if (scrollY && dy !== 0) {
      const atEnd =
        dy > 0
          ? node.scrollTop + node.clientHeight >= node.scrollHeight - 1
          : node.scrollTop <= 0;
      if (!atEnd) return true;
    }
    if (scrollX && dx !== 0) {
      const atEnd =
        dx > 0
          ? node.scrollLeft + node.clientWidth >= node.scrollWidth - 1
          : node.scrollLeft <= 0;
      if (!atEnd) return true;
    }
    node = node.parentElement;
  }
  return false;
}

function ToolbarButton({
  label,
  active,
  className = "w-9",
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  className?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      onClick={(e) => {
        onClick();
        e.currentTarget.blur();
      }}
      className={`flex h-9 cursor-pointer items-center justify-center rounded-lg text-[14px] outline-none hover:bg-white/10 hover:text-white ${
        active ? "bg-white/15 text-white" : ""
      } ${className}`}
    >
      {children}
    </button>
  );
}
