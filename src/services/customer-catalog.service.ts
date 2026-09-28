/**
 * The same deliberate, narrow exception as item-catalog.service.ts (see
 * PRODUCT.md's Design Principles) — added because /food/customers' search
 * has a real structural limitation: it merges up to `skip+top` results per
 * searched field (name, customerNo) from Business Central, since BC's OData
 * doesn't support an OR filter across two fields (see bc_functions.py's
 * rgmc_v2_search_table_live). Against a large, chain=true customer list, a
 * short/common substring can match more rows than that window holds, so the
 * customer you want silently doesn't appear until the search narrows enough
 * to fit inside it — it looks like "needs to complete the word."
 *
 * Caching the full (already chain=true-filtered) customer list and filtering
 * it client-side sidesteps that limitation entirely: every keystroke matches
 * against the complete, real dataset, not a capped per-field window.
 *
 * What IS cached: customer number, display name, address/city, phone/email —
 * static-ish reference data. Nothing here is inventory- or pricing-related,
 * so this doesn't touch the "availability always live" guarantee.
 */
import { ApiService } from './api.service';
import type { Customer } from '@/types';

const STORAGE_KEY = 'sbic_food_customer_catalog_v1';
const PAGE_SIZE = 100; // matches /food/customers' server-side cap (limit<=100)
const MAX_PAGES = 500; // hard ceiling (50,000 customers) — never loop forever on bad data
const FRESHNESS_MS = 6 * 60 * 60 * 1000; // 6 hours — customer rosters change rarely

interface CachedCatalog {
  companyCode: string;
  fetchedAt: number;
  customers: Customer[];
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
  const customers: Customer[] = [];
  let pages = 0;
  while (offset < total && pages < MAX_PAGES) {
    const page = await ApiService.getCustomers({ limit: PAGE_SIZE, offset });
    if (!page.value.length) break; // guard against a total that never resolves to offset>=total
    customers.push(...page.value);
    total = page.total;
    offset += page.value.length;
    pages += 1;
  }
  const catalog: CachedCatalog = { companyCode, fetchedAt: Date.now(), customers };
  _memoryCatalog = catalog;
  writeStorage(catalog);
}

export const CustomerCatalogService = {
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
        // Best-effort only — CustomerSelectorModal always falls back to a
        // live /food/customers search/browse call when no cache is available.
      })
      .finally(() => {
        _inFlight = null;
      });
  },

  /** Cached customers for `companyCode`, or null if nothing usable is cached
   *  yet (still loading, failed, or cached for a different company). */
  getCustomers(companyCode: string): Customer[] | null {
    if (_memoryCatalog?.companyCode === companyCode) return _memoryCatalog.customers;
    const stored = readStorage();
    if (stored?.companyCode === companyCode) {
      _memoryCatalog = stored;
      return stored.customers;
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
