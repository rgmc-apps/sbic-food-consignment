<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Take Order Number Photo</ion-title>
        <ion-buttons slot="start">
          <ion-button @click="cancel">
            <ion-icon :icon="closeOutline" slot="icon-only" />
          </ion-button>
        </ion-buttons>
        <ion-buttons v-if="torchSupported" slot="end">
          <ion-button @click="toggleTorch">
            <ion-icon :icon="torchOn ? flashOutline : flashOffOutline" slot="icon-only" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="capture-content" :scroll-y="false">
      <div class="capture-wrap">
        <video ref="videoEl" autoplay playsinline muted class="capture-video" />

        <div v-if="status !== 'error'" class="capture-ui">
          <div class="capture-frame">
            <div class="corner tl" />
            <div class="corner tr" />
            <div class="corner bl" />
            <div class="corner br" />
          </div>
          <p class="capture-hint">{{ hintText }}</p>
        </div>

        <!-- Camera troubleshooting — same pattern as the barcode scanner's
             own error panel: specific cause + a one-tap retry where that can
             plausibly help, plus a way back to the classic camera picker so
             a getUserMedia-specific failure never strands the user. -->
        <div v-if="status === 'error'" class="camera-error-panel">
          <ion-icon :icon="alertCircleOutline" class="camera-error-icon" />
          <p class="camera-error-msg">{{ errorMessage }}</p>
          <ion-button v-if="errorOpenSettings" expand="block" color="primary" class="camera-error-retry" @click="errorOpenSettings()">
            {{ errorOpenSettingsLabel }}
          </ion-button>
          <ion-button v-if="errorCanRetry" expand="block" fill="outline" class="camera-error-retry" @click="startCamera">
            Try Again
          </ion-button>
          <button type="button" class="use-classic-camera-btn" @click="useClassicCamera">
            Use Classic Camera Instead
          </button>
        </div>
      </div>
    </ion-content>

    <ion-footer v-if="status === 'ready' || status === 'capturing'">
      <ion-toolbar class="shutter-toolbar">
        <button
          type="button"
          class="shutter-btn"
          :disabled="status === 'capturing'"
          aria-label="Take photo"
          @click="captureBurst"
        />
      </ion-toolbar>
    </ion-footer>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon,
  IonContent, IonFooter, modalController,
} from '@ionic/vue';
import { closeOutline, alertCircleOutline, flashOutline, flashOffOutline } from 'ionicons/icons';
import { describeCameraError, watchCameraPermission, reportCameraError } from '@/composables/useCameraTroubleshoot';

// Data goes back to the caller via modalController.dismiss(data, role) —
// same convention as OcrCropModal/ItemSelectorModal. role 'confirm' carries
// the captured Blob; role 'classic-camera' asks the caller to fall back to
// the <input type="file" capture="environment"> picker instead.
type Status = 'starting' | 'ready' | 'capturing' | 'error';
const status = ref<Status>('starting');
const videoEl = ref<HTMLVideoElement | null>(null);
let stream: MediaStream | null = null;
let track: MediaStreamTrack | null = null;
let unwatchPermission: (() => void) | null = null;

const errorMessage = ref('');
const errorCanRetry = ref(true);
const errorOpenSettings = ref<(() => void) | null>(null);
const errorOpenSettingsLabel = ref('');

const torchSupported = ref(false);
const torchOn = ref(false);

const hintText = computed(() => {
  if (status.value === 'starting') return 'Starting camera…';
  if (status.value === 'capturing') return 'Hold still…';
  return 'Fill the frame with the order number, then tap the shutter';
});

async function startCamera(): Promise<void> {
  status.value = 'starting';
  unwatchPermission?.();
  unwatchPermission = null;

  try {
    let s: MediaStream;
    try {
      // Highest resolution the device will offer (an `ideal` constraint
      // degrades to the closest match rather than failing), rear camera,
      // and a best-effort continuous-autofocus/exposure hint. Advanced
      // constraints are skipped silently wherever unsupported (iOS Safari
      // included) rather than rejecting the whole request, unlike a bare
      // top-level constraint — safe to request everywhere.
      s = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 3840 },
          height: { ideal: 2160 },
          advanced: [{ focusMode: 'continuous', exposureMode: 'continuous' } as unknown as MediaTrackConstraintSet],
        },
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'OverconstrainedError') {
        s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
      } else {
        throw err;
      }
    }
    stream = s;
    track = s.getVideoTracks()[0] ?? null;
    const caps = track?.getCapabilities?.() as (MediaTrackCapabilities & { torch?: boolean }) | undefined;
    torchSupported.value = !!caps?.torch;

    if (videoEl.value) {
      videoEl.value.srcObject = s;
      await videoEl.value.play();
    }
    status.value = 'ready';
  } catch (err) {
    const info = describeCameraError(err);
    errorMessage.value = info.message;
    errorCanRetry.value = info.canRetry;
    errorOpenSettings.value = info.openSettings ?? null;
    errorOpenSettingsLabel.value = info.openSettingsLabel ?? '';
    status.value = 'error';
    void reportCameraError('ocr-order-number', err, info.message);
    unwatchPermission = watchCameraPermission(() => {
      if (status.value === 'error') void startCamera();
    });
  }
}

async function toggleTorch(): Promise<void> {
  if (!track) return;
  try {
    const next = !torchOn.value;
    await track.applyConstraints({ advanced: [{ torch: next } as unknown as MediaTrackConstraintSet] });
    torchOn.value = next;
  } catch {
    // Some devices advertise torch support but reject applyConstraints —
    // nothing useful to do but leave the toggle as it was.
  }
}

function stopCamera(): void {
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  track = null;
  unwatchPermission?.();
  unwatchPermission = null;
}

// Cheap gradient-energy sharpness proxy (sum of squared differences between
// horizontally and vertically adjacent pixels on a small grayscale buffer) —
// the same family of technique real autofocus systems use. Motion blur
// smooths out exactly this high-frequency edge energy, so the frame with
// the highest score is the least motion-blurred one.
const SHARPNESS_SAMPLE_WIDTH = 240;
function sharpnessScore(video: HTMLVideoElement): number {
  const scale = SHARPNESS_SAMPLE_WIDTH / video.videoWidth;
  const w = SHARPNESS_SAMPLE_WIDTH;
  const h = Math.max(1, Math.round(video.videoHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return 0;
  ctx.drawImage(video, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  const gray = new Float32Array(w * h);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  let sum = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (x < w - 1) { const d = gray[idx] - gray[idx + 1]; sum += d * d; }
      if (y < h - 1) { const d = gray[idx] - gray[idx + w]; sum += d * d; }
    }
  }
  return sum / (w * h);
}

// A single shutter tap is still just one point in time for hand-shake to
// land badly on — capturing a short burst and keeping the sharpest frame
// fights exactly the motion-blur failure mode a native camera app's single
// shot can't recover from once it's already blurry.
const BURST_FRAME_COUNT = 5;
const BURST_FRAME_INTERVAL_MS = 60;
async function captureBurst(): Promise<void> {
  const video = videoEl.value;
  if (!video || !video.videoWidth) return;
  status.value = 'capturing';

  let best: { score: number; canvas: HTMLCanvasElement } | null = null;
  for (let i = 0; i < BURST_FRAME_COUNT; i++) {
    const score = sharpnessScore(video);
    if (!best || score > best.score) {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d')!.drawImage(video, 0, 0);
      best = { score, canvas };
    }
    if (i < BURST_FRAME_COUNT - 1) await new Promise((r) => setTimeout(r, BURST_FRAME_INTERVAL_MS));
  }
  if (!best) { status.value = 'ready'; return; }

  best.canvas.toBlob((blob) => {
    if (!blob) { status.value = 'ready'; return; }
    stopCamera();
    modalController.dismiss(blob, 'confirm');
  }, 'image/jpeg', 0.92);
}

function cancel(): void {
  stopCamera();
  modalController.dismiss(null, 'cancel');
}

function useClassicCamera(): void {
  stopCamera();
  modalController.dismiss(null, 'classic-camera');
}

onMounted(() => { void startCamera(); });
onUnmounted(() => { stopCamera(); });
</script>

<style scoped>
.capture-content {
  --background: #000;
}

.capture-wrap {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #000;
}

.capture-video {
  width: 100%;
  flex: 1;
  object-fit: cover;
  min-height: 260px;
}

.capture-ui {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.capture-frame {
  width: 280px;
  height: 120px;
  position: relative;
}

.corner {
  position: absolute;
  width: 24px;
  height: 24px;
  border-color: var(--app-blue);
  border-style: solid;
}
.tl { top: 0; left: 0; border-width: 3px 0 0 3px; }
.tr { top: 0; right: 0; border-width: 3px 3px 0 0; }
.bl { bottom: 0; left: 0; border-width: 0 0 3px 3px; }
.br { bottom: 0; right: 0; border-width: 0 3px 3px 0; }

.capture-hint {
  margin-top: 16px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.3px;
  color: rgba(255, 255, 255, 0.85);
  text-align: center;
  padding: 0 24px;
}

.shutter-toolbar {
  --background: #000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px 0;
}

.shutter-btn {
  width: 68px;
  height: 68px;
  border-radius: 50%;
  background: #fff;
  border: 4px solid rgba(255, 255, 255, 0.4);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.shutter-btn:active {
  background: #ddd;
}

.shutter-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ── Camera troubleshooting — matches ItemSelectorModal's barcode scanner
   error panel styling for visual consistency across the app's two
   camera UIs. ── */
.camera-error-panel {
  position: absolute;
  left: 16px;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 20px 16px;
  background: rgba(10, 10, 10, 0.96);
  border: 1px solid #2a2a2a;
  border-radius: 12px;
  pointer-events: all;
  text-align: center;
}

.camera-error-icon {
  font-size: 28px;
  color: var(--ion-color-danger);
}

.camera-error-msg {
  margin: 0;
  color: #ddd;
  font-size: 13px;
  line-height: 1.5;
}

.camera-error-retry {
  margin-top: 4px;
  width: 100%;
}

.use-classic-camera-btn {
  margin-top: 4px;
  background: transparent;
  border: none;
  color: var(--app-blue);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
</style>
