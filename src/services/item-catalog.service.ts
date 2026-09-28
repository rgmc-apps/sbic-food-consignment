/**
 * A deliberate, narrow exception to this app's "always live, never cached"
 * rule (see PRODUCT.md's Design Principles) — added specifically to avoid a
 * heavy `/food/items` scan every time the Add Items modal is searched.
 *
 * What IS cached: item number, description, and base unit of measure — the
 * static catalog fields that rarely change. What is NEVER cached: quantity,
 * lot/expiration, or anything availability-related — those are always
 * fetched live per item (see ItemSelectorModal.pickItem/ApiService.getItemLots),
 * exactly as before. The "quantity never oversold because availability is
 * always live" guarantee is untouched by this cache.
 *
 * Loaded once on login (and once per app boot for a returning, already
 * authenticated session), by looping /food/items with limit/offset until
 * every page has been fetched — never one unbounded request. Persisted to
 * localStorage (sbic_food_item_catalog_v1) so a page reload doesn't require
 * re-walking the whole catalog, and refreshed again once it goes stale.
 */
import { ApiService } from './api.service';
import type { Item } from '@/types';

const STORAGE_KEY = 'sbic_food_item_catalog_v1';
const PAGE_SIZE = 100; // matches /food/items' server-side cap (limit<=100)
const MAX_PAGES = 500; // hard ceiling (50,000 items) — never loop forever on bad data
const FRESHNESS_MS = 6 * 60 * 60 * 1000; // 6 hours — item catalogs change rarely

interface CachedCatalog {
  companyCode: string;
  fetchedAt: number;
  items: Item[];
}

let _memoryCatalog: CachedCatalog | null = null;
let _inFlight: Promise<void> | null = null;

function readStorage(): CachedCatalog | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CachedCatalog) : null;
  } catch {
    return null;
  }
}

function writeStorage(catalog: CachedCatalog): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(catalog));
  } catch {
    // Quota exceeded / storage disabled (private mode) — the in-memory copy
    // still serves the rest of this tab's session, it just won't survive a reload.
  }
}

function isFresh(catalog: CachedCatalog, companyCode: string): boolean {
  return catalog.companyCode === companyCode && Date.now() - catalog.fetchedAt < FRESHNESS_MS;
}

async function loadAllPages(companyCode: string): Promise<void> {
  let offset = 0;
  let total = Infinity;
  const items: Item[] = [];
  let pages = 0;
  while (offset < total && pages < MAX_PAGES) {
    const page = await ApiService.getItems({ limit: PAGE_SIZE, offset });
    if (!page.value.length) break; // guard against a total that never resolves to offset>=total
    items.push(...page.value);
    total = page.total;
    offset += page.value.length;
    pages += 1;
  }
  const catalog: CachedCatalog = { companyCode, fetchedAt: Date.now(), items };
  _memoryCatalog = catalog;
  writeStorage(catalog);
}

export const ItemCatalogService = {
  /** Fire-and-forget — call right after login, or at boot for a restored
   *  session. Skips the network walk entirely if a fresh cache for this
   *  company is already in memory or localStorage. */
  preload(companyCode: string): void {
    if (!companyCode || _inFlight) return;
    if (_memoryCatalog && isFresh(_memoryCatalog, companyCode)) return;
    const stored = readStorage();
    if (stored && isFresh(stored, companyCode)) {
      _memoryCatalog = stored;
      return;
    }
    _inFlight = loadAllPages(companyCode)
      .catch(() => {
        // Best-effort only — ItemSelectorModal always falls back to a live
        // /food/items search/browse call when no cache is available.
      })
      .finally(() => {
        _inFlight = null;
      });
  },

  /** Cached items for `companyCode`, or null if nothing usable is cached yet
   *  (still loading, failed, or cached for a different company). */
  getItems(companyCode: string): Item[] | null {
    if (_memoryCatalog?.companyCode === companyCode) return _memoryCatalog.items;
    const stored = readStorage();
    if (stored?.companyCode === companyCode) {
      _memoryCatalog = stored;
      return stored.items;
    }
    return null;
  },

  clear(): void {
    _memoryCatalog = null;
    _inFlight = null;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  },
};
