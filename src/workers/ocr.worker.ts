import { PaddleOcrService, V6_MEDIUM_MODEL, UNWARPING_MODEL_URL } from 'ppu-paddle-ocr/web';

const DB_NAME = 'ocr-model-cache';
const STORE_NAME = 'models';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
  });
}

async function readCachedModel(url: string): Promise<ArrayBuffer | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(url);
      req.onsuccess = () => resolve((req.result as ArrayBuffer | undefined) ?? null);
      req.onerror = () => reject(req.error ?? new Error('IndexedDB read failed'));
    });
  } catch {
    return null; // Unavailable (private browsing, quota, etc.) — fall through to fetch.
  }
}

async function writeCachedModel(url: string, bytes: ArrayBuffer): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(bytes, url);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write failed'));
    });
  } catch {
    // Caching is a nice-to-have — a failed write just means next load re-fetches.
  }
}

// Each model file is a one-time ~139MB download from an external CDN (see
// V6_MEDIUM_MODEL's source). The browser's own HTTP cache is the only thing
// that previously saved repeat loads from re-fetching it, and for an asset
// this large and this rarely revisited, mobile Chrome is far more likely to
// evict it under storage pressure than it is for the rest of the app's own
// (much smaller) assets — every eviction meant a multi-second-to-minutes
// re-download silently hiding behind the scan button's busy spinner, which
// is very plausibly what users were reporting as slow "processing". IndexedDB
// isn't subject to that same per-resource eviction heuristic, so caching the
// raw bytes there makes every load after the first truly instant, no network
// involved at all, regardless of what the HTTP cache has done in between.
async function loadModelResource(url: string): Promise<ArrayBuffer> {
  const cached = await readCachedModel(url);
  if (cached) return cached;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch OCR model resource: ${url}`);
  const bytes = await response.arrayBuffer();
  void writeCachedModel(url, bytes);
  return bytes;
}

// Created once when this worker module first loads (i.e. the first time
// ocr.service.ts constructs the Worker) — downloads/initializes the model
// off the main thread, same lazy-singleton intent as the old main-thread
// getOcrService(), just living here instead.
// Unwarping flattens a photo of curled, folded, or tilted paper before
// detection — a real packing slip held up to a phone camera is rarely
// perfectly flat. The model only loads during initialize(), so it has to be
// requested here even though most scans won't need it; the two-pass
// recognize() below keeps that cost off the common (already-flat) case.
const ready: Promise<PaddleOcrService> = (async () => {
  const [detection, recognition, charactersDictionary, unwarping] = await Promise.all([
    loadModelResource(V6_MEDIUM_MODEL.detection),
    loadModelResource(V6_MEDIUM_MODEL.recognition),
    loadModelResource(V6_MEDIUM_MODEL.charactersDictionary),
    loadModelResource(UNWARPING_MODEL_URL),
  ]);
  const service = new PaddleOcrService({
    model: { detection, recognition, charactersDictionary, unwarping },
    unwarping: { enabled: true },
  });
  await service.initialize();
  return service;
})();

type OcrWorkerRequest = { id: number; bytes: ArrayBuffer };

// `self` types as `Window` under this project's DOM-only tsconfig lib (no
// "webworker"), but addEventListener/postMessage are present and behave
// identically on the real DedicatedWorkerGlobalScope this file actually runs
// in — avoids a second tsconfig just for this one file.
self.addEventListener('message', (event: MessageEvent) => {
  const { id, bytes } = event.data as OcrWorkerRequest;
  void (async () => {
    try {
      const service = await ready;
      // Fast path first, unwarped — the library's own guidance is to leave
      // unwarping off for already-flat input, where "it gains nothing and
      // still costs the extra model run" (+~300ms or more on a phone CPU).
      // Only pay that cost on the harder case a curled/tilted photo
      // produces: nothing detected on the first, cheaper pass.
      let result = await service.recognize(bytes, { unwarp: false });
      if (!result.lines.length) {
        result = await service.recognize(bytes, { unwarp: true });
      }
      postMessage({ id, ok: true, lines: result.lines });
    } catch (err) {
      postMessage({ id, ok: false, error: err instanceof Error ? err.message : 'OCR failed' });
    }
  })();
});
