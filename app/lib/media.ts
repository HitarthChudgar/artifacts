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
  | { kind: "image"; src: string; name?: string; uploading?: boolean }
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

export function loadImageSize(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth || 400, height: img.naturalHeight || 300 });
    img.onerror = () => resolve({ width: 400, height: 300 });
    img.src = src;
  });
}
