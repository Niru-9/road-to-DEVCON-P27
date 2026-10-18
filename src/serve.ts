#!/usr/bin/env node
/**
 * Zero-dependency static server for the review pages.
 *
 * The generated `out/*.review.html` files are plain static HTML, but a browser
 * needs an http:// URL (file:// is blocked by many browsers). This serves the
 * output directory so you can open the review lane in a browser.
 *
 *   npm run serve              # serves ./out on http://localhost:4173
 *   npm run serve -- --dir out --port 4173
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";

const args = process.argv.slice(2);
const opt = (name: string, fallback: string): string => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const dir = resolve(opt("dir", "out"));
const port = Number(opt("port", "4173"));
const host = opt("host", "127.0.0.1");

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === "/") pathname = "/index.html";

    // keep the request inside `dir` (no ../ escape)
    const filePath = normalize(join(dir, pathname));
    if (!filePath.startsWith(dir)) {
      res.writeHead(403).end("forbidden");
      return;
    }

    const info = await stat(filePath).catch(() => null);
    if (!info || !info.isFile()) {
      const listing = await readFile(join(dir, "index.html"), "utf8").catch(() => null);
      res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
      res.end(
        listing ??
          `<h1>404</h1><p>No file at <code>${pathname}</code>.</p>` +
            `<p>Available pages are the <code>*.review.html</code> files in <code>${dir}</code>.</p>`,
      );
      return;
    }

    const body = await readFile(filePath);
    res.writeHead(200, {
      "content-type": TYPES[extname(filePath).toLowerCase()] ?? "application/octet-stream",
      "content-length": body.byteLength,
    });
    res.end(body);
  } catch (err) {
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end(`server error: ${(err as Error).message}`);
  }
});

server.listen(port, host, () => {
  console.log(`Bhasha review pages:  http://${host}:${port}/`);
  console.log(`  serving ./${opt("dir", "out")}  (Ctrl+C to stop)`);
  console.log(`  open:  http://${host}:${port}/prize-pool.review.html`);
});
