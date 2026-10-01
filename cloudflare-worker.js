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
const FRESH_SECONDS = 600;   // 10 minutes: serve straight from cache, no revalidation
const STALE_SECONDS = 43200;  // 12 hours: still serve from cache, but refresh in the background

// Change this to your own value - required to use the ?purge=true endpoint below,
// so a stranger who finds the Worker URL can't force extra Apps Script load.
const PURGE_KEY = 'tdr-purge-2026';

// Strips the long-lived Cache-Control before a response goes back to the
// browser, so the browser's own HTTP cache never holds onto it - otherwise
// a visitor's browser would keep serving its own stale copy for up to
// STALE_SECONDS, bypassing both the edge's freshness logic and ?purge=true
// entirely. The long Cache-Control is still what controls how long
// Cloudflare's own edge cache (caches.default) retains the entry.
function forClient(response) {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-store');
  return new Response(response.body, { status: response.status, headers });
}

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
      // This Cache-Control governs how long Cloudflare's edge cache keeps the
      // entry; it's stripped before the response reaches the browser (see
      // forClient above). Freshness within that window is tracked separately
      // via X-Cached-At.
      'Cache-Control': isValidJson ? `public, max-age=${STALE_SECONDS}` : 'no-store',
      'X-Cached-At': String(Date.now()),
    },
  });

  if (isValidJson) {
    await cache.put(cacheKey, response.clone());
  }
  return forClient(response);
}

// Clears the cached entry for one sheet (both the plain data response and
// its &meta=true companion), so the next request fetches fresh immediately
// instead of waiting out FRESH_SECONDS/STALE_SECONDS.
async function purgeSheet(requestUrl, sheet, cache) {
  const dataUrl = new URL(requestUrl);
  dataUrl.search = `?sheet=${sheet}`;
  const metaUrl = new URL(requestUrl);
  metaUrl.search = `?sheet=${sheet}&meta=true`;

  const [deletedData, deletedMeta] = await Promise.all([
    cache.delete(new Request(dataUrl)),
    cache.delete(new Request(metaUrl)),
  ]);

  return { sheet, deletedData, deletedMeta };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const cache = caches.default;

    // Manual purge: /?purge=true&sheet=MenuDay&key=...
    if (url.searchParams.get('purge') === 'true') {
      if (url.searchParams.get('key') !== PURGE_KEY) {
        return new Response(JSON.stringify({ error: 'Invalid or missing purge key' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const sheet = url.searchParams.get('sheet');
      if (!sheet) {
        return new Response(JSON.stringify({ error: 'Missing ?sheet=... to purge' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const result = await purgeSheet(request.url, sheet, cache);
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const target = APPS_SCRIPT_URL + url.search;

    const cached = await cache.match(request);
    if (cached) {
      const cachedAt = Number(cached.headers.get('X-Cached-At')) || 0;
      const ageSeconds = (Date.now() - cachedAt) / 1000;

      if (ageSeconds <= FRESH_SECONDS) {
        return forClient(cached);
      }

      if (ageSeconds <= STALE_SECONDS) {
        // Serve the stale copy now; refresh the cache in the background for next time.
        ctx.waitUntil(fetchAndCache(target, request, cache));
        return forClient(cached);
      }
      // Older than STALE_SECONDS - fall through to a normal blocking fetch.
    }

    return fetchAndCache(target, request, cache);
  },
};
