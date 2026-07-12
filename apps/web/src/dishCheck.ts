// On-device dish photo comparison. Nothing ever leaves the phone:
// both images are rasterised to a small canvas and compared as colour
// histograms — a rough "does the colour and texture read the same" score,
// never a food-safety judgement.

const BINS = 4; // per channel → 64 colour buckets

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image failed to load"));
    image.src = src;
  });
}

function histogram(image: HTMLImageElement): number[] {
  const size = 96;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) return [];
  // Centre-crop to reduce the influence of table / background edges.
  const side = Math.min(image.naturalWidth, image.naturalHeight);
  const sx = (image.naturalWidth - side) / 2;
  const sy = (image.naturalHeight - side) / 2;
  context.drawImage(image, sx, sy, side, side, 0, 0, size, size);
  const { data } = context.getImageData(0, 0, size, size);
  const bins = new Array<number>(BINS * BINS * BINS).fill(0);
  for (let index = 0; index < data.length; index += 4) {
    const r = Math.min(BINS - 1, Math.floor((data[index]! / 256) * BINS));
    const g = Math.min(BINS - 1, Math.floor((data[index + 1]! / 256) * BINS));
    const b = Math.min(BINS - 1, Math.floor((data[index + 2]! / 256) * BINS));
    const bucket = (r * BINS + g) * BINS + b;
    bins[bucket] = (bins[bucket] ?? 0) + 1;
  }
  const total = size * size;
  return bins.map((count) => count / total);
}

function bhattacharyya(a: number[], b: number[]): number {
  let coefficient = 0;
  for (let index = 0; index < a.length; index += 1) coefficient += Math.sqrt((a[index] ?? 0) * (b[index] ?? 0));
  return coefficient; // 1 = identical distributions
}

/** 0–100 colour/tone similarity between the cook's photo and the reference. */
export async function compareDishPhotos(userDataUrl: string, referenceUrl: string): Promise<number> {
  const [user, reference] = await Promise.all([loadImage(userDataUrl), loadImage(referenceUrl)]);
  const coefficient = bhattacharyya(histogram(user), histogram(reference));
  // Histograms of unrelated photos still overlap; stretch the useful band.
  const stretched = Math.max(0, Math.min(1, (coefficient - 0.35) / 0.6));
  return Math.round(stretched * 100);
}

/** Downscale the capture so IndexedDB stays light. */
export async function shrinkForStorage(dataUrl: string, maxSide = 900): Promise<string> {
  const image = await loadImage(dataUrl);
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  if (scale === 1) return dataUrl;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);
  canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("file read failed"));
    reader.readAsDataURL(file);
  });
}
