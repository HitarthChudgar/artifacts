export type LinkPreview = {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  favicon?: string;
  siteName?: string;
  /** Whether the page allows being shown in an iframe on another origin. */
  embeddable: boolean;
};

export type MediaItem = {
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
} & (
  | { kind: "image"; src: string; name?: string; uploading?: boolean; svg?: boolean }
  | { kind: "link"; url: string; preview?: LinkPreview }
);

const IMAGE_EXT = /\.(png|gif|jpe?g|webp|avif|svg)(\?.*)?$/i;

export function parseUrl(text: string): URL | null {
  const t = text.trim();
  if (/\s/.test(t)) return null;
  try {
    const url = new URL(/^[a-z]+:\/\//i.test(t) ? t : `https://${t}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    // Bare words like "hello" become https://hello/ — require a dotted host.
    if (!url.hostname.includes(".") && url.hostname !== "localhost") return null;
    return url;
  } catch {
    return null;
  }
}

export const isImageUrl = (url: URL) => IMAGE_EXT.test(url.pathname);

export const isSvgFile = (file: File) =>
  file.type === "image/svg+xml" || /\.svg$/i.test(file.name);

export const isSvgSrc = (src: string, name?: string) =>
  /\.svg(\?|#|$)/i.test(src) ||
  src.startsWith("data:image/svg+xml") ||
  !!name?.toLowerCase().endsWith(".svg");

/** Clipboard often carries SVG as markup, not a file. */
export function svgFileFromClipboard(data: DataTransfer): File | null {
  const fromFiles = [...data.files].find(isSvgFile);
  if (fromFiles) return fromFiles;

  const typed = data.getData("image/svg+xml");
  if (looksLikeSvg(typed)) return svgFileFromMarkup(typed);

  const text = data.getData("text/plain");
  if (looksLikeSvg(text)) return svgFileFromMarkup(text);

  const html = data.getData("text/html");
  const embedded = html.match(/<svg[\s\S]*<\/svg>/i)?.[0];
  if (embedded && looksLikeSvg(embedded)) return svgFileFromMarkup(embedded);

  return null;
}

function looksLikeSvg(s: string) {
  const t = s.trim();
  return /^<svg[\s>]/i.test(t) || (t.startsWith("<?xml") && /<svg[\s>]/i.test(t));
}

function svgFileFromMarkup(markup: string) {
  return new File([markup.trim()], "pasted.svg", { type: "image/svg+xml" });
}

export async function uploadImage(file: File): Promise<string> {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch("/api/uploads", { method: "POST", body });
  const data = (await res.json()) as { url?: string; error?: string };
  if (!res.ok || !data.url) throw new Error(data.error ?? "Upload failed");
  return data.url;
}

export async function fetchPreview(url: string): Promise<LinkPreview> {
  try {
    const res = await fetch(`/api/preview?url=${encodeURIComponent(url)}`);
    if (res.ok) return (await res.json()) as LinkPreview;
  } catch {}
  return { url, embeddable: false };
}

export async function loadImageSize(src: string): Promise<{ width: number; height: number }> {
  const fromImg = await new Promise<{ width: number; height: number }>((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = src;
  });
  if (fromImg.width && fromImg.height) return fromImg;
  if (isSvgSrc(src)) return (await readSvgSize(src)) ?? { width: 400, height: 300 };
  return { width: 400, height: 300 };
}

async function readSvgSize(src: string) {
  try {
    const text = await (await fetch(src)).text();
    const vb = text.match(/viewBox=["']([\d.\s,-]+)["']/i)?.[1].trim().split(/[\s,]+/).map(Number);
    if (vb?.length === 4 && vb[2] > 0 && vb[3] > 0) return { width: vb[2], height: vb[3] };
    const w = Number(text.match(/\bwidth=["']([\d.]+)/i)?.[1]);
    const h = Number(text.match(/\bheight=["']([\d.]+)/i)?.[1]);
    if (w && h) return { width: w, height: h };
  } catch {}
  return null;
}
