import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const manifest = JSON.parse(await readFile(resolve(root, "content", "photo-licenses.json"), "utf8"));
const destination = resolve(root, "apps", "web", "public", "photos");

await mkdir(destination, { recursive: true });

const pause = (milliseconds) => new Promise((resolvePause) => setTimeout(resolvePause, milliseconds));

async function download(url) {
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const response = await fetch(url, {
      headers: { "User-Agent": "RasoiGuide/2.0 (open-source cooking app; photo attribution in repository)" }
    });
    if (response.ok) return Buffer.from(await response.arrayBuffer());
    if (response.status !== 429 || attempt === 6) {
      throw new Error(`${response.status} ${response.statusText}`);
    }
    await pause(attempt * 1_250);
  }
  throw new Error("Photo download retries exhausted");
}

for (const photo of manifest.photos) {
  let bytes;
  try {
    const fileName = decodeURIComponent(photo.sourceUrl.slice(photo.sourceUrl.lastIndexOf("File:") + 5));
    const width = photo.kind === "dish" ? 1280 : 960;
    const thumbnailUrl = `https://commons.wikimedia.org/w/thumb.php?f=${encodeURIComponent(fileName)}&width=${width}`;
    bytes = await download(thumbnailUrl);
  } catch (error) {
    throw new Error(`${photo.id}: ${error instanceof Error ? error.message : String(error)}`);
  }
  await writeFile(resolve(destination, photo.file), bytes);
  console.log(`${photo.id} -> ${photo.file}`);
  await pause(150);
}
