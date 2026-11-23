import { PaddleOcrService, V6_MEDIUM_MODEL } from 'ppu-paddle-ocr/web';

// Created once when this worker module first loads (i.e. the first time
// ocr.service.ts constructs the Worker) — downloads/initializes the model
// off the main thread, same lazy-singleton intent as the old main-thread
// getOcrService(), just living here instead.
const service = new PaddleOcrService({ model: V6_MEDIUM_MODEL });
const ready = service.initialize();

type OcrWorkerRequest = { id: number; bytes: ArrayBuffer };

// `self` types as `Window` under this project's DOM-only tsconfig lib (no
// "webworker"), but addEventListener/postMessage are present and behave
// identically on the real DedicatedWorkerGlobalScope this file actually runs
// in — avoids a second tsconfig just for this one file.
self.addEventListener('message', (event: MessageEvent) => {
  const { id, bytes } = event.data as OcrWorkerRequest;
  void (async () => {
    await ready;
    try {
      const result = await service.recognize(bytes);
      postMessage({ id, ok: true, lines: result.lines });
    } catch (err) {
      postMessage({ id, ok: false, error: err instanceof Error ? err.message : 'OCR failed' });
    }
  })();
});
