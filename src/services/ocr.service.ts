export interface OcrBox { x: number; y: number; width: number; height: number }
export interface OcrWord { text: string; box: OcrBox }

type OcrWorkerMessage =
  | { id: number; ok: true; lines: OcrWord[][] }
  | { id: number; ok: false; error: string }
  | { type: 'progress'; loaded: number; total: number };

let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<number, { resolve: (lines: OcrWord[][]) => void; reject: (err: Error) => void }>();
const progressListeners = new Set<(loaded: number, total: number) => void>();

// Lazily creates a single shared worker — kept at module scope so it's
// reused across scans and across navigating away from and back to the
// submit screen, not re-created on every mount. OCR (onnxruntime-web WASM
// inference) runs entirely inside this worker, never on the main thread:
// the model download/init and every recognize() call happen off-thread, so
// the page's own animations (the order-number skeleton, the scan button's
// spinner) never have to compete with it for the main thread.
function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('../workers/ocr.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<OcrWorkerMessage>) => {
      const data = event.data;
      if ('type' in data) {
        progressListeners.forEach((cb) => cb(data.loaded, data.total));
        return;
      }
      const entry = pending.get(data.id);
      if (!entry) return;
      pending.delete(data.id);
      if (data.ok) entry.resolve(data.lines);
      else entry.reject(new Error(data.error));
    };
  }
  return worker;
}

/** Starts the worker (and its model download/init) ahead of the first real
 *  scan — see SubmitPage.vue's onMounted call. */
export function warmOcrService(): void {
  getWorker();
}

/** Subscribes to model download progress (bytes loaded / total, aggregated
 *  across every model resource fetched this session) — lets the UI show
 *  real progress instead of an indefinite spinner while a slow mobile
 *  connection downloads the model for the first time. Returns an
 *  unsubscribe function. */
export function subscribeOcrLoadProgress(cb: (loaded: number, total: number) => void): () => void {
  getWorker(); // ensure the worker (and its progress messages) actually exist
  progressListeners.add(cb);
  return () => progressListeners.delete(cb);
}

/** Runs OCR on a cropped order-number photo (PNG bytes) inside the worker.
 *  Returns results grouped by detected line, each line an array of words in
 *  left-to-right order — same shape selectPrimaryLineText already expects. */
export function recognizeOrderNumber(imageBytes: ArrayBuffer): Promise<OcrWord[][]> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ id, bytes: imageBytes }, [imageBytes]);
  });
}
