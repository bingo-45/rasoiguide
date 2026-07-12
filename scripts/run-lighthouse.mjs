import { chromium } from "@playwright/test";
import lighthouse from "lighthouse";
import { createServer as createHttpServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dist = resolve(root, "apps", "web", "dist");

const mime = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".wav": "audio/wav",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

const compressible = new Set([".css", ".html", ".js", ".json", ".svg"]);

async function freePort() {
  return new Promise((resolvePort, reject) => {
    const server = createNetServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close((error) => error ? reject(error) : resolvePort(port));
    });
  });
}

function startStaticServer() {
  const server = createHttpServer(async (request, response) => {
    try {
      const rawPath = decodeURIComponent((request.url ?? "/").split("?")[0]);
      const relative = rawPath === "/" ? "index.html" : rawPath.replace(/^\/+/, "");
      let file = resolve(dist, relative);
      if (!file.startsWith(`${dist}${sep}`) && file !== resolve(dist, "index.html")) {
        response.writeHead(403).end();
        return;
      }
      try {
        if (!(await stat(file)).isFile()) file = resolve(dist, "index.html");
      } catch {
        file = resolve(dist, "index.html");
      }
      const extension = extname(file);
      let body = await readFile(file);
      const headers = {
        "Content-Type": mime[extension] ?? "application/octet-stream",
        "Cache-Control": file.endsWith("index.html") ? "no-cache" : "public, max-age=31536000, immutable",
        "Vary": "Accept-Encoding"
      };
      if (compressible.has(extension) && request.headers["accept-encoding"]?.includes("gzip")) {
        body = gzipSync(body, { level: 9 });
        headers["Content-Encoding"] = "gzip";
      }
      response.writeHead(200, headers);
      response.end(body);
    } catch (error) {
      response.writeHead(500, { "Content-Type": "text/plain" });
      response.end(error instanceof Error ? error.message : "Static server error");
    }
  });
  return server;
}

const [webPort, cdpPort] = await Promise.all([freePort(), freePort()]);
const server = startStaticServer();
await new Promise((resolveListen, reject) => {
  server.once("error", reject);
  server.listen(webPort, "127.0.0.1", resolveListen);
});

let browser;
try {
  browser = await chromium.launch({
    headless: true,
    args: [`--remote-debugging-port=${cdpPort}`, "--disable-gpu", "--no-first-run"]
  });
  const result = await lighthouse(`http://127.0.0.1:${webPort}/`, {
    port: cdpPort,
    output: "json",
    logLevel: "error",
    onlyCategories: ["performance", "accessibility", "best-practices", "seo"]
  });
  if (!result) throw new Error("Lighthouse returned no report");

  const scores = Object.fromEntries(Object.entries(result.lhr.categories).map(([key, category]) => [key, Math.round((category.score ?? 0) * 100)]));
  const metrics = {
    fcpMs: result.lhr.audits["first-contentful-paint"]?.numericValue ?? Number.POSITIVE_INFINITY,
    lcpMs: result.lhr.audits["largest-contentful-paint"]?.numericValue ?? Number.POSITIVE_INFINITY,
    ttiMs: result.lhr.audits.interactive?.numericValue ?? Number.POSITIVE_INFINITY,
    tbtMs: result.lhr.audits["total-blocking-time"]?.numericValue ?? Number.POSITIVE_INFINITY,
    cls: result.lhr.audits["cumulative-layout-shift"]?.numericValue ?? Number.POSITIVE_INFINITY,
    totalBytes: result.lhr.audits["total-byte-weight"]?.numericValue ?? Number.POSITIVE_INFINITY
  };

  await mkdir(resolve(root, ".lighthouseci"), { recursive: true });
  await writeFile(resolve(root, ".lighthouseci", "manual-report.json"), result.report, "utf8");

  console.log("RasoiGuide Lighthouse gate");
  console.log(`Performance ${scores.performance} · Accessibility ${scores.accessibility} · Best Practices ${scores["best-practices"]} · SEO ${scores.seo}`);
  console.log(`FCP ${(metrics.fcpMs / 1000).toFixed(2)}s · LCP ${(metrics.lcpMs / 1000).toFixed(2)}s · TTI ${(metrics.ttiMs / 1000).toFixed(2)}s · TBT ${Math.round(metrics.tbtMs)}ms · CLS ${metrics.cls.toFixed(3)}`);
  console.log(`Transferred ${Math.round(metrics.totalBytes / 1024)} KiB`);

  const failures = [];
  if ((scores.performance ?? 0) < 85) failures.push("Performance < 85");
  if ((scores.accessibility ?? 0) < 95) failures.push("Accessibility < 95");
  if ((scores["best-practices"] ?? 0) < 95) failures.push("Best Practices < 95");
  if (metrics.ttiMs >= 3_500) failures.push("TTI >= 3.5s");
  if (failures.length) throw new Error(`Lighthouse gate failed: ${failures.join(", ")}`);
} finally {
  await browser?.close();
  await new Promise((resolveClose) => server.close(() => resolveClose()));
}
