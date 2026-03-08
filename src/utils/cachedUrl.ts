/**
 * cachedUrl.ts
 * 
 * Resolves a resource URL to a cached blob URL if the asset has been
 * downloaded to the Cache API by AssetPreloader, otherwise returns the
 * original URL so the app works seamlessly before / during preloading.
 */

const ASSET_CACHE = "babai-assets-v2";

// In-memory map: original url → blob URL (to avoid repeated cache lookups)
const blobUrlMap = new Map<string, string>();

/**
 * Returns a blob: URL pointing to the cached copy of `url`, or the
 * original `url` if the asset is not yet cached.
 *
 * This is synchronous-first: we keep an in-memory map so hot paths
 * (e.g., CSS background-image) don't stall on every repaint.
 */
export async function resolveUrl(url: string): Promise<string> {
  if (!url) return url;
  // Already resolved in this session
  if (blobUrlMap.has(url)) return blobUrlMap.get(url)!;

  if (!("caches" in window)) return url;

  try {
    const cache = await caches.open(ASSET_CACHE);
    const response = await cache.match(url);
    if (!response) return url;

    const blob = await response.blob();
    if (!blob.size) return url;

    const blobUrl = URL.createObjectURL(blob);
    blobUrlMap.set(url, blobUrl);
    return blobUrl;
  } catch {
    return url;
  }
}

/**
 * Sync version: returns cached blob URL if already resolved in this session,
 * otherwise returns the original URL and kicks off an async resolution
 * that will update the caller via the provided setter.
 */
export function resolveUrlSync(
  url: string,
  onResolved: (resolved: string) => void,
): string {
  if (!url) return url;
  if (blobUrlMap.has(url)) return blobUrlMap.get(url)!;

  // Kick off async resolution
  resolveUrl(url).then(resolved => {
    if (resolved !== url) onResolved(resolved);
  });

  return url;
}
