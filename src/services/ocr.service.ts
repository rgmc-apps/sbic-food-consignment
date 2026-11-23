export interface OcrBox { x: number; y: number; width: number; height: number }
export interface OcrWord { text: string; box: OcrBox }

type OcrWorkerResponse =
  | { id: number; ok: true; lines: OcrWord[][] }
  | { id: number; ok: false; error: string };

let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<number, { resolve: (lines: OcrWord[][]) => void; reject: (err: Error) => void }>();

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
    worker.onmessage = (event: MessageEvent<OcrWorkerResponse>) => {
      const entry = pending.get(event.data.id);
      if (!entry) return;
      pending.delete(event.data.id);
      if (event.data.ok) entry.resolve(event.data.lines);
      else entry.reject(new Error(event.data.error));
    };
  }
  return worker;
}

/** Starts the worker (and its ~139MB model download/init) ahead of the first
 *  real scan — see SubmitPage.vue's onMounted call. */
export function warmOcrService(): void {
  getWorker();
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
