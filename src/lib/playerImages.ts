const MFL_IMAGE_BASE = 'https://www.myfantasyleague.com/player_photos_2014/';

const imageCache = new Map<string, ArrayBuffer>();
const missingImages = new Set<string>();
const inflight = new Map<string, Promise<ArrayBuffer | null>>();

let cacheDate = '';
let cachePending = false;

export function isImageCacheValid(): boolean {
  return cacheDate === new Date().toDateString();
}

export function resetImageCacheIfStale(): void {
  if (!isImageCacheValid()) {
    imageCache.clear();
    missingImages.clear();
    inflight.clear();
    cacheDate = new Date().toDateString();
  }
}

async function fetchImage(id: string): Promise<ArrayBuffer | null> {
  try {
    const response = await fetch(MFL_IMAGE_BASE + id + '_thumb.jpg', {
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) {
      if (response.status === 404) missingImages.add(id);
      return null;
    }
    const bytes = await response.arrayBuffer();
    imageCache.set(id, bytes);
    return bytes;
  } catch {
    return null;
  }
}

export async function getPlayerImage(id: string): Promise<ArrayBuffer | null> {
  resetImageCacheIfStale();

  const cached = imageCache.get(id);
  if (cached) return cached;
  if (missingImages.has(id)) return null;

  const existing = inflight.get(id);
  if (existing) return existing;

  const promise = fetchImage(id).finally(() => {
    inflight.delete(id);
  });
  inflight.set(id, promise);
  return promise;
}

export async function warmPlayerImages(ids: string[], concurrency = 8, delayMs = 150): Promise<void> {
  resetImageCacheIfStale();

  if (cachePending) return;
  cachePending = true;

  try {
    const queue = [...new Set(ids)].filter(id => !imageCache.has(id) && !missingImages.has(id));
    let index = 0;

    async function worker(): Promise<void> {
      while (index < queue.length) {
        const id = queue[index++];
        await getPlayerImage(id);
        if (delayMs > 0) await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    const workers = Array.from({ length: Math.min(concurrency, queue.length) }, worker);
    await Promise.all(workers);
  } finally {
    cachePending = false;
  }
}
