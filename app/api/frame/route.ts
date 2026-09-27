import { fetchPage, parseTarget } from "@/app/lib/remote";

// Serves a page's HTML for sites that refuse to be framed. The page runs in an opaque origin
// (CSP sandbox without allow-same-origin) so its scripts can't reach the canvas's storage.
export async function GET(request: Request) {
  const url = parseTarget(request);
  if (!url) return new Response("Invalid URL", { status: 400 });

  let res: Response;
  try {
    res = await fetchPage(url);
  } catch {
    return page(`<p style="font:13px system-ui;color:#71717a;padding:16px">Couldn't load ${escape(url.href)}</p>`);
  }
  if (!(res.headers.get("content-type") ?? "").includes("text/html")) {
    res.body?.cancel();
    return Response.redirect(res.url || url.href, 302);
  }

  const base = `<base href="${escape(res.url || url.href)}" target="_blank">`;
  const html = await res.text();
  const head = html.match(/<head[^>]*>/i);
  return page(head ? html.replace(head[0], () => head[0] + base) : base + html);
}

function page(html: string) {
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": "sandbox allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox",
      "Cache-Control": "private, max-age=300",
    },
  });
}

function escape(s: string) {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
