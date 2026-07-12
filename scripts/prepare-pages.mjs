import { copyFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const dist = join(process.cwd(), "apps", "web", "dist");
const routes = ["cook/current", "prep/current", "thali/current"];

await copyFile(join(dist, "index.html"), join(dist, "404.html"));

for (const route of routes) {
  const target = join(dist, ...route.split("/"));
  await mkdir(target, { recursive: true });
  await copyFile(join(dist, "index.html"), join(target, "index.html"));
}

console.log(`Prepared GitHub Pages fallbacks for ${routes.length} direct routes.`);
