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

// Aggregate download progress across every resource fetched this session,
// reported to the main thread so a slow mobile connection reads as "still
// downloading, N%" instead of looking frozen. Keyed by URL so concurrent
// fetches (Promise.all) each contribute independently to the total.
const progressByUrl = new Map<string, { loaded: number; total: number }>();
let lastReportedPercent = -1;
function reportProgress(): void {
  let loaded = 0;
  let total = 0;
  for (const p of progressByUrl.values()) { loaded += p.loaded; total += p.total; }
  if (total <= 0) return;
  const percent = Math.floor((loaded / total) * 100);
  if (percent === lastReportedPercent) return; // throttle: one message per percentage point
  lastReportedPercent = percent;
  postMessage({ type: 'progress', loaded, total });
}

// Each model file is a one-time ~139MB (medium tier) or ~30MB (unwarping)
// download from an external CDN. The browser's own HTTP cache is the only
// thing that previously saved repeat loads from re-fetching it, and for an
// asset this large and this rarely revisited, mobile Chrome is far more
// likely to evict it under storage pressure than it is for the rest of the
// app's own (much smaller) assets — every eviction meant a multi-second-to-
// minutes re-download silently hiding behind the scan button's busy spinner.
// IndexedDB isn't subject to that same per-resource eviction heuristic, so
// caching the raw bytes there makes every load after the first truly
// instant, no network involved at all, regardless of what the HTTP cache
// has done in between. A streamed read (not a plain response.arrayBuffer())
// is what makes per-chunk progress reporting possible at all.
async function loadModelResource(url: string): Promise<ArrayBuffer> {
  const cached = await readCachedModel(url);
  if (cached) {
    progressByUrl.set(url, { loaded: cached.byteLength, total: cached.byteLength });
    reportProgress();
    return cached;
  }

  const response = await fetch(url);
  if (!response.ok || !response.body) throw new Error(`Failed to fetch OCR model resource: ${url}`);
  const total = Number(response.headers.get('content-length')) || 0;
  progressByUrl.set(url, { loaded: 0, total });

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.byteLength;
    progressByUrl.set(url, { loaded, total });
    reportProgress();
  }

  const bytes = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  void writeCachedModel(url, bytes.buffer);
  return bytes.buffer;
}

// Base model (detection + recognition + dictionary) is always needed —
// fetched once, shared by both the fast and unwarp-fallback services below.
const baseModel: Promise<{ detection: ArrayBuffer; recognition: ArrayBuffer; charactersDictionary: ArrayBuffer }> = (async () => {
  const [detection, recognition, charactersDictionary] = await Promise.all([
    loadModelResource(V6_MEDIUM_MODEL.detection),
    loadModelResource(V6_MEDIUM_MODEL.recognition),
    loadModelResource(V6_MEDIUM_MODEL.charactersDictionary),
  ]);
  return { detection, recognition, charactersDictionary };
})();

// Fast path: no unwarping model, so most scans (an already-flat packing
// slip) never pay for the extra ~30MB download or the extra inference time
// at all. Created once when this worker module first loads — downloads/
// initializes off the main thread, same lazy-singleton intent as the old
// main-thread getOcrService(), just living here instead.
const fastService: Promise<PaddleOcrService> = (async () => {
  const model = await baseModel;
  const service = new PaddleOcrService({ model });
  await service.initialize();
  return service;
})();

// Unwarping flattens a photo of curled, folded, or tilted paper before
// detection — built lazily, only the first time a scan actually needs it
// (the fast pass found nothing), since most scans never do. Memoized so a
// second failure reuses the same already-initialized service rather than
// re-downloading and re-initializing from scratch.
let fallbackServicePromise: Promise<PaddleOcrService> | null = null;
function getFallbackService(): Promise<PaddleOcrService> {
  if (!fallbackServicePromise) {
    fallbackServicePromise = (async () => {
      const [model, unwarping] = await Promise.all([baseModel, loadModelResource(UNWARPING_MODEL_URL)]);
      const service = new PaddleOcrService({
        model: { ...model, unwarping },
        unwarping: { enabled: true },
      });
      await service.initialize();
      return service;
    })();
  }
  return fallbackServicePromise;
}

type OcrWorkerRequest = { id: number; bytes: ArrayBuffer };

// `self` types as `Window` under this project's DOM-only tsconfig lib (no
// "webworker"), but addEventListener/postMessage are present and behave
// identically on the real DedicatedWorkerGlobalScope this file actually runs
// in — avoids a second tsconfig just for this one file.
self.addEventListener('message', (event: MessageEvent) => {
  const { id, bytes } = event.data as OcrWorkerRequest;
  void (async () => {
    try {
      const service = await fastService;
      let result = await service.recognize(bytes);
      if (!result.lines.length) {
        const fallback = await getFallbackService();
        result = await fallback.recognize(bytes, { unwarp: true });
      }
      postMessage({ id, ok: true, lines: result.lines });
    } catch (err) {
      postMessage({ id, ok: false, error: err instanceof Error ? err.message : 'OCR failed' });
    }
  })();
});
