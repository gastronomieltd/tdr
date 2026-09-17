// Cloudflare Worker: edge cache in front of the Apps Script menu backend.
// Deploy this via the Cloudflare dashboard (Workers & Pages -> Create -> paste this in).
//
// Uses a stale-while-revalidate strategy:
//  - For the first FRESH_SECONDS after a successful fetch, the cached copy is
//    served as-is (no upstream call at all).
//  - After that, up until STALE_SECONDS, the (now "stale") cached copy is
//    still served immediately, but a background refresh is kicked off so the
//    *next* visitor gets fresh data. Visitors never block on Apps Script's
//    latency once anything has been cached at all.
//  - Only past STALE_SECONDS (or on a true cache miss) does a request
//    actually wait on the upstream fetch.

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzjiCsO-ZF72QTLWEP-k18L2glWtF3sWE3giy9cyvIURwOqbpI7D1owwiYLLwLYfqzmLQ/exec';
const FRESH_SECONDS = 300;   // 5 minutes: serve straight from cache, no revalidation
const STALE_SECONDS = 3600;  // 1 hour: still serve from cache, but refresh in the background

// Fetches from Apps Script, validates it's real JSON (Apps Script/Drive can
// transiently fail and still return HTTP 200 with an HTML error page), and
// caches it on success. Returns the Response either way; never caches errors.
async function fetchAndCache(target, cacheKey, cache) {
  const upstream = await fetch(target, { redirect: 'follow' });
  const body = await upstream.text();

  let isValidJson = true;
  try {
    JSON.parse(body);
  } catch (e) {
    isValidJson = false;
  }

  const response = new Response(body, {
    status: isValidJson ? upstream.status : 502,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      // Cache-Control here governs how long Cloudflare keeps the entry at all;
      // freshness within that window is tracked separately via X-Cached-At.
      'Cache-Control': isValidJson ? `public, max-age=${STALE_SECONDS}` : 'no-store',
      'X-Cached-At': String(Date.now()),
    },
  });

  if (isValidJson) {
    await cache.put(cacheKey, response.clone());
  }
  return response;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const target = APPS_SCRIPT_URL + url.search;
    const cache = caches.default;

    const cached = await cache.match(request);
    if (cached) {
      const cachedAt = Number(cached.headers.get('X-Cached-At')) || 0;
      const ageSeconds = (Date.now() - cachedAt) / 1000;

      if (ageSeconds <= FRESH_SECONDS) {
        return cached;
      }

      if (ageSeconds <= STALE_SECONDS) {
        // Serve the stale copy now; refresh the cache in the background for next time.
        ctx.waitUntil(fetchAndCache(target, request, cache));
        return cached;
      }
      // Older than STALE_SECONDS - fall through to a normal blocking fetch.
    }

    return fetchAndCache(target, request, cache);
  },
};
