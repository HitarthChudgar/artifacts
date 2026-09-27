import type { LinkPreview } from "@/app/lib/media";
import { fetchPage, parseTarget } from "@/app/lib/remote";

const MAX_HTML = 512 * 1024;

export async function GET(request: Request) {
  const url = parseTarget(request);
  if (!url) return Response.json({ error: "Invalid URL" }, { status: 400 });

  let res: Response;
  try {
    res = await fetchPage(url);
  } catch {
    return Response.json({ url: url.href, embeddable: false } satisfies LinkPreview);
  }

  const finalUrl = new URL(res.url || url.href);
  const preview: LinkPreview = { url: finalUrl.href, embeddable: isEmbeddable(res.headers) };

  if ((res.headers.get("content-type") ?? "").includes("text/html")) {
    const html = await readLimited(res, MAX_HTML);
    const meta = (key: string) => {
      const re = new RegExp(
        `<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${key}["']`,
        "i",
      );
      const m = html.match(re);
      return m ? decode(m[1] ?? m[2]) : undefined;
    };
    const resolve = (href?: string) => {
      if (!href) return undefined;
      try {
        return new URL(href, finalUrl).href;
      } catch {
        return undefined;
      }
    };
    const titleTag = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1];
    const icon = html.match(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]*href=["']([^"']+)["']/i)?.[1];

    preview.title = meta("og:title") ?? meta("twitter:title") ?? (titleTag ? decode(titleTag.trim()) : undefined);
    preview.description = meta("og:description") ?? meta("description") ?? meta("twitter:description");
    preview.image = resolve(meta("og:image") ?? meta("twitter:image"));
    preview.siteName = meta("og:site_name");
    preview.favicon = resolve(icon) ?? new URL("/favicon.ico", finalUrl).href;
  } else {
    res.body?.cancel();
  }

  return Response.json(preview);
}

function isEmbeddable(headers: Headers) {
  const xfo = headers.get("x-frame-options")?.toLowerCase();
  if (xfo && (xfo.includes("deny") || xfo.includes("sameorigin"))) return false;
  const csp = headers.get("content-security-policy");
  const ancestors = csp?.match(/frame-ancestors([^;]*)/i)?.[1].trim();
  if (ancestors !== undefined) return ancestors.split(/\s+/).includes("*");
  return true;
}

async function readLimited(res: Response, limit: number) {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let html = "";
  while (html.length < limit) {
    const { done, value } = await reader.read();
    if (done) break;
    html += decoder.decode(value, { stream: true });
    // Metadata lives in <head>; stop once it's over.
    if (/<\/head>/i.test(html)) break;
  }
  reader.cancel().catch(() => {});
  return html;
}

function decode(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}
