import { PaddleOcrService } from 'ppu-paddle-ocr/web';

let servicePromise: Promise<PaddleOcrService> | null = null;

/** Lazily creates and initializes a single shared PaddleOcrService instance
 *  (downloads + caches ~6MB of ONNX models via fetch on first call) — kept
 *  at module scope so it's reused across scans and across navigating away
 *  from and back to the submit screen, not re-initialized on every mount. */
export function getOcrService(): Promise<PaddleOcrService> {
  if (!servicePromise) {
    servicePromise = (async () => {
      const service = new PaddleOcrService();
      await service.initialize();
      return service;
    })();
  }
  return servicePromise;
}
