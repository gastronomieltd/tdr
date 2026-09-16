// Shared local caching for menu data pulled from the Google Sheet backend.
// Avoids re-fetching the full item list when the sheet hasn't changed, by first
// checking a lightweight `&meta=true` timestamp and comparing it to what's cached.
const MenuCache = (() => {
    const CACHE_PREFIX = 'tdr_menu_cache_';
    // Proxied through a Cloudflare Worker edge cache instead of calling
    // script.google.com directly, so repeat visitors across the whole site
    // share one cached response rather than each hitting Apps Script's
    // slow cold-start latency individually.
    const BASE_URL = 'https://tdr-menu-cache.gastronomie-ltd.workers.dev/';

    const readCache = (sheetName) => {
        try {
            const raw = localStorage.getItem(CACHE_PREFIX + sheetName);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    };

    const writeCache = (sheetName, updatedOn, data) => {
        try {
            localStorage.setItem(CACHE_PREFIX + sheetName, JSON.stringify({ updatedOn, data }));
        } catch (e) {
            // localStorage unavailable (private browsing, quota full, etc) - caching is best-effort
        }
    };

    // Resolves with the sheet's item array, using the cached copy when the
    // sheet's last-updated timestamp (from the &meta=true endpoint) hasn't changed.
    // Falls back to a plain fetch if the meta endpoint isn't available yet.
    const getMenuData = async (sheetName) => {
        const cached = readCache(sheetName);

        let updatedOn = null;
        try {
            const metaResponse = await fetch(`${BASE_URL}?sheet=${sheetName}&meta=true`);
            const meta = await metaResponse.json();
            updatedOn = meta && meta.updatedOn;
        } catch (e) {
            updatedOn = null;
        }

        if (updatedOn && cached && cached.updatedOn === updatedOn) {
            return cached.data;
        }

        const response = await fetch(`${BASE_URL}?sheet=${sheetName}`);
        const data = await response.json();

        if (updatedOn) {
            writeCache(sheetName, updatedOn, data);
        }

        return data;
    };

    return { getMenuData };
})();
