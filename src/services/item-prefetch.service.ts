/**
 * A narrow, bounded exception to this app's "always live, never cached" rule —
 * not a cache. SplashPage fires this once, for returning users only (the only
 * moment a company code is already known before the user does anything), to
 * warm up the BC access token / connection on the backend and have the very
 * first Add Items page ready the instant the modal opens.
 *
 * It is consumed at most once (`takePrefetchedItems` clears it immediately)
 * and only within a short freshness window — anything older, or any search
 * beyond the first empty-query page, always goes through a normal live fetch.
 * This can only ever make the first paint faster; it never changes what data
 * ends up on screen, since the exact same endpoint/params are used either way.
 */
import { ApiService } from './api.service';
import type { Item, Page } from '@/types';

const FRESHNESS_MS = 30_000;
export const PREFETCH_LIMIT = 25;

let prefetched: { page: Page<Item>; fetchedAt: number } | null = null;
let inFlight: Promise<void> | null = null;

export function prefetchInitialItems(): void {
  if (inFlight || prefetched) return;
  inFlight = ApiService.getItems({ limit: PREFETCH_LIMIT, offset: 0 })
    .then((page) => {
      prefetched = { page, fetchedAt: Date.now() };
    })
    .catch(() => {
      // Best-effort only — ItemSelectorModal always falls back to its own live fetch.
    })
    .finally(() => {
      inFlight = null;
    });
}

export function takePrefetchedItems(): Page<Item> | null {
  if (!prefetched) return null;
  const { page, fetchedAt } = prefetched;
  prefetched = null;
  if (Date.now() - fetchedAt > FRESHNESS_MS) return null;
  return page;
}

export function clearItemPrefetch(): void {
  prefetched = null;
  inFlight = null;
}
