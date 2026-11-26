<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/app/scan" text="" />
        </ion-buttons>
        <ion-title>Submit Order</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true" class="wide-content">
      <!-- Product register: motion conveys state, not decoration — this one
           crossfade covers all three states this page can be in (empty,
           form, confirmation), so the payoff moment (order submitted) is a
           deliberate beat rather than an instant snap. -->
      <Transition name="view-fade" mode="out-in">
      <div v-if="!session" key="empty" class="state-block">
        <p>No active session.</p>
        <ion-button router-link="/app/home" fill="outline">Go Home</ion-button>
      </div>

      <!-- Every element below is a flat, direct child of .submit-layout, in
           the exact order a mobile user should encounter it: customer card,
           order number, order lines to review, any error, then the submit
           action. Mobile/tablet (<1024px) gets no grid at all, so this is
           simply that reading order, unchanged from before this pass.
           Desktop (≥1024px) repositions each child with grid-column/order —
           a checkout-style layout (fill-and-submit on the left, a sticky
           line-item review on the right) — without touching DOM order, so
           mobile behavior can never drift from this template again. -->
      <div v-else-if="!result" key="form" class="submit-layout animate-in">
        <ion-card class="submit-card">
          <ion-card-header>
            <ion-card-subtitle>Customer</ion-card-subtitle>
            <ion-card-title>{{ session.customer?.displayName ?? '—' }}</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <p class="detail-row">Posting Date: {{ formatDate(session.postingDate) }}</p>
          </ion-card-content>
        </ion-card>

        <ion-item lines="none" class="order-no-field">
          <ion-label position="stacked">Order Number *</ion-label>
          <ion-skeleton-text
            v-if="ocrBusy"
            class="order-no-skeleton"
          />
          <ion-input
            v-else
            ref="orderNumberInputEl"
            v-model="orderNumberInput"
            placeholder="Enter or scan the online order number"
            @ion-input="handleOrderNumberInput"
          />
          <button
            type="button"
            class="ocr-scan-btn"
            slot="end"
            aria-label="Scan order number with camera"
            :title="cameraAvailable ? 'Scan order number with camera' : 'Camera unavailable — use manual input'"
            :disabled="ocrBusy || !cameraAvailable"
            @click="triggerOcrCapture"
          >
            <ion-spinner v-if="ocrBusy" name="crescent" />
            <ion-icon v-else :icon="cameraOutline" />
          </button>
          <input
            ref="ocrFileInput"
            type="file"
            accept="image/*"
            capture="environment"
            class="ocr-file-input"
            @change="handleOcrCapture"
          />
        </ion-item>
        <div v-if="cameraAvailable" class="ocr-action-row">
          <button
            v-if="ocrAttempted"
            type="button"
            class="ocr-retry-btn"
            :disabled="ocrBusy"
            @click="triggerOcrCapture"
          >
            <ion-icon :icon="refreshOutline" />
            Retry Scan
          </button>
          <button
            v-if="lastCroppedImage"
            type="button"
            class="ocr-retry-btn"
            :disabled="ocrBusy"
            @click="retryCharacterRead"
          >
            <ion-icon :icon="textOutline" />
            Retry Character Read
          </button>
          <button
            type="button"
            class="ocr-retry-btn"
            :disabled="ocrBusy"
            @click="enableManualEntry"
          >
            <ion-icon :icon="createOutline" />
            Enter Manually
          </button>
        </div>
        <p v-if="orderNumberFormatError" class="order-no-error">{{ orderNumberFormatError }}</p>
        <p v-if="ocrLoadProgress" class="ocr-load-progress">
          Preparing OCR engine… {{ Math.round((ocrLoadProgress.loaded / ocrLoadProgress.total) * 100) }}%
        </p>

        <div class="lines-section">
          <p class="section-label">Order Lines</p>
          <ion-list class="lines-list" lines="full">
            <ion-item v-for="line in session.lines" :key="line.id">
              <ion-label>
                <h2>{{ line.description || line.itemNumber }}</h2>
                <p class="line-detail-row">
                  <span class="line-detail-label">Item No.</span>
                  <span>#{{ line.itemNumber }}</span>
                </p>
                <p class="line-detail-row">
                  <span class="line-detail-label">Quantity</span>
                  <span>{{ line.quantity }} {{ line.unitOfMeasureCode }}</span>
                  <button
                    type="button"
                    class="expiry-edit-btn"
                    aria-label="Edit quantity"
                    @click.stop="openQuantityEditor($event, line)"
                  >
                    <ion-icon :icon="createOutline" />
                  </button>
                </p>
                <p class="line-detail-row expiry-row">
                  <span class="line-detail-label">Expiry Date</span>
                  <span>
                    {{ line.expirationDate ? formatDate(line.expirationDate) : '—' }}
                    <span v-if="isExpiringSoon(line.expirationDate)" class="expiry-badge">Expiring soon</span>
                  </span>
                  <button
                    v-if="line.expirationDate"
                    type="button"
                    class="expiry-edit-btn"
                    aria-label="Edit lot and expiry date"
                    @click.stop="openLotEditor($event, line)"
                  >
                    <ion-icon :icon="createOutline" />
                  </button>
                </p>
                <p v-if="line.lotNo" class="line-detail-row">
                  <span class="line-detail-label">Lot No.</span>
                  <span>{{ line.lotNo }}</span>
                  <button
                    type="button"
                    class="expiry-edit-btn"
                    aria-label="Edit lot and expiry date"
                    @click.stop="openLotEditor($event, line)"
                  >
                    <ion-icon :icon="createOutline" />
                  </button>
                </p>
                <p v-if="settingsStore.showItemPrices && priceMap[line.itemNumber] != null" class="line-detail-row">
                  <span class="line-detail-label">Price</span>
                  <span>{{ formatCurrency(priceMap[line.itemNumber]) }}</span>
                </p>
              </ion-label>
            </ion-item>
          </ion-list>
        </div>

        <template v-if="submitError">
          <p class="submit-error">{{ submitError }}</p>
          <ion-button expand="block" fill="clear" color="danger" @click="reportSubmitError">
            <ion-icon :icon="bugOutline" slot="start" />
            Report to IT/MIS
          </ion-button>
        </template>

        <div class="ion-padding action-buttons">
          <ion-button expand="block" :disabled="!canSubmit || submitting" @click="handleSubmit">
            <ion-spinner v-if="submitting" name="dots" />
            <span v-else>Submit to Business Central</span>
          </ion-button>
          <ion-button expand="block" fill="clear" :disabled="submitting" @click="saveDraftAndExit">
            Save as Draft &amp; Go Back
          </ion-button>
        </div>
      </div>

      <!-- ── Confirmation — the one moment this register spends extra motion
           on: completing an order is the payoff, not a form field. Still no
           bounce/elastic, just a slightly more deliberate settle. ── -->
      <div v-else key="confirm" class="confirmation">
        <ion-icon :icon="checkmarkCircleOutline" class="confirm-icon" />
        <h2 class="confirm-heading">Order Submitted</h2>
        <p class="confirm-doc">Business Central Document No.</p>
        <p class="confirm-doc-no">{{ result.documentNumber }}</p>
        <p class="confirm-order-no">Order No.: {{ result.externalDocumentNo }}</p>
        <div v-if="lotTrackingWarnings.length" class="tracking-warning">
          <p class="tracking-warning-title">Lot tracking not recorded</p>
          <p v-for="(w, i) in lotTrackingWarnings" :key="i">{{ w }}</p>
        </div>
        <ion-button expand="block" @click="finishAndGoHome">Done</ion-button>
      </div>
      </Transition>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonContent, IonCard,
  IonCardHeader, IonCardSubtitle, IonCardTitle, IonCardContent, IonItem, IonLabel, IonInput,
  IonList, IonButton, IonSpinner, IonIcon, IonSkeletonText, popoverController, alertController, modalController,
} from '@ionic/vue';
import { checkmarkCircleOutline, createOutline, bugOutline, cameraOutline, refreshOutline, textOutline } from 'ionicons/icons';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';
import { useSessionStore } from '@/stores/session.store';
import { useSettingsStore } from '@/stores/settings.store';
import { useErrorReporter } from '@/composables/useErrorReporter';
import { ApiService, ApiError } from '@/services/api.service';
import { formatDate, formatCurrency, isExpiringSoon } from '@/utils/format';
import { generateId } from '@/utils/id';
import LotEditorPopover from '@/components/LotEditorPopover.vue';
import QuantityEditorPopover from '@/components/QuantityEditorPopover.vue';
import OcrCropModal from '@/components/OcrCropModal.vue';
import OcrCameraCaptureModal from '@/components/OcrCameraCaptureModal.vue';
import { warmOcrService, recognizeOrderNumber, subscribeOcrLoadProgress, type OcrWord } from '@/services/ocr.service';
import { CROP_PAD_RATIO } from '@/utils/ocrCrop';
import { useCameraAvailability, isCameraPermissionDenied, reportCameraError, getCameraDeniedGuidance } from '@/composables/useCameraTroubleshoot';
import type { FoodSalesOrderResult, OrderHistoryLine, OrderLine } from '@/types';

const router = useRouter();
const authStore = useAuthStore();
const sessionStore = useSessionStore();
const settingsStore = useSettingsStore();
const { openReport } = useErrorReporter();
const session = computed(() => sessionStore.currentSession);

const orderNumberInput = ref(session.value?.orderNumber ?? '');
const orderNumberInputEl = ref<InstanceType<typeof IonInput> | null>(null);
const ocrBusy = ref(false);
// Set only while the model is still downloading — null again once it's
// fully loaded (cached resources report loaded===total immediately, so a
// warm cache never shows this at all). Exists so a slow mobile connection
// on first use reads as "downloading, 42%" instead of looking frozen.
const ocrLoadProgress = ref<{ loaded: number; total: number } | null>(null);
const ocrFileInput = ref<HTMLInputElement | null>(null);
// The last cropped photo, kept so "Retry Character Read" can re-run just
// recognition (useful since the model result can vary run to run, and the
// photo/crop usually isn't the problem) without making the user re-take or
// re-crop the picture.
const lastCroppedImage = ref<Blob | null>(null);
const { cameraAvailable } = useCameraAvailability();
// Whether the user has made at least one scan attempt this session — gates
// the "Retry Scan" button (no point offering a retry before a first try). A
// resumed draft that already has an order number counts as already satisfied.
const ocrAttempted = ref(!!session.value?.orderNumber?.trim());
// Tracks how the current order number got into the field — typing (the
// @ion-input handler below, which only fires on real user keystrokes, never
// on a programmatic v-model assignment) vs. a successful OCR scan. Gates the
// confirm-before-submit step: a resumed draft's provenance isn't known, so
// it defaults to "manual" and gets the same one-more-look confirmation.
const orderNumberManuallyEntered = ref(!!session.value?.orderNumber?.trim());
const submitting = ref(false);
const submitError = ref<string | null>(null);
const lastSubmitError = ref<unknown>(null);

// Live-only, never cached — loaded once for whatever lines are already on
// this order, only when the "Display Item Prices" setting is on.
const priceMap = ref<Record<string, number>>({});
if (settingsStore.showItemPrices && session.value?.lines.length) {
  ApiService.getItemPrices(session.value.lines.map((l) => l.itemNumber))
    .then((map) => { priceMap.value = map; })
    .catch(() => { /* ignore — prices just won't show */ });
}
const result = ref<FoodSalesOrderResult | null>(null);

// Start the OCR worker as soon as this screen opens — the medium-tier model
// is a ~139MB one-time download, so starting it now lets it fetch/initialize
// while the user is still framing their photo instead of only starting
// after they've already captured and cropped it.
let unsubscribeOcrProgress: (() => void) | null = null;
onMounted(() => {
  unsubscribeOcrProgress = subscribeOcrLoadProgress((loaded, total) => {
    ocrLoadProgress.value = loaded < total ? { loaded, total } : null;
  });
  warmOcrService();
});
onUnmounted(() => {
  unsubscribeOcrProgress?.();
});

function handleOrderNumberInput(): void {
  orderNumberManuallyEntered.value = true;
  sessionStore.setOrderNumber(orderNumberInput.value);
}

// Quick "clear and type" shortcut — for whenever OCR just isn't going to
// work (damaged label, no signal to download the model, stuck misreading
// the same photo) rather than making the user clear a wrong scan result by
// hand before typing the real number.
async function enableManualEntry(): Promise<void> {
  ocrAttempted.value = true;
  orderNumberInput.value = '';
  sessionStore.setOrderNumber('');
  await nextTick();
  await orderNumberInputEl.value?.$el.setFocus();
}

const getUserMediaSupported = 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices;

async function triggerOcrCapture(): Promise<void> {
  // Known-blocked permission — skip opening a camera UI we already know is
  // dead and show the fix-it message right away, rather than making the
  // user tap through a picker that silently won't show a live camera.
  if (await isCameraPermissionDenied()) {
    const guidance = getCameraDeniedGuidance();
    void reportCameraError('ocr-order-number', new DOMException('Camera permission denied', 'NotAllowedError'), guidance.message);
    // Genuinely can't scan — don't leave manual entry locked behind an SOP
    // this device has no way to satisfy.
    ocrAttempted.value = true;
    const alert = await alertController.create({
      header: 'Camera Unavailable',
      message: guidance.message,
      buttons: [
        ...(guidance.openSettings ? [{ text: guidance.openSettingsLabel ?? 'Open App Settings', handler: guidance.openSettings }] : []),
        'OK',
      ],
    });
    await alert.present();
    return;
  }

  if (getUserMediaSupported) {
    await captureViaCamera();
  } else {
    ocrFileInput.value?.click();
  }
}

// The custom camera path (forced continuous autofocus, torch control,
// burst-capture-pick-sharpest-frame — see OcrCameraCaptureModal) is tried
// first wherever getUserMedia is available; its own error panel offers a
// way back to the classic file-input picker, so a getUserMedia-specific
// failure (e.g. a browser that reports support but the permission prompt
// behaves oddly) never strands the user without a way to scan at all.
async function captureViaCamera(): Promise<void> {
  const modal = await modalController.create({ component: OcrCameraCaptureModal });
  await modal.present();
  const { data, role } = await modal.onDidDismiss<Blob>();
  if (role === 'classic-camera') {
    ocrFileInput.value?.click();
    return;
  }
  if (role === 'confirm' && data) await processCapturedImage(data);
}

function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not load image for OCR preprocessing')); };
    img.src = url;
  });
}

// Upscale small crops only — no grayscale/contrast/sharpen/binarize. PP-OCR
// is a deep-learning recognizer trained on natural camera photos, not the
// classical connected-component pipeline Tesseract used (which benefited
// from manual binarization); ppu-paddle-ocr's own docs report its *defaults*
// reading camera photos at 99.5% accuracy and explicitly warn that a manual
// pixel-level trick (pre-inverting dark-theme text) hurt their own test
// accuracy rather than helping. Our earlier binarization pipeline was
// carried over from the Tesseract setup and was very likely doing the same
// kind of harm here, so it's gone — this now matches the library's own
// recommended "just feed it the photo" usage.
const OCR_MIN_HEIGHT_PX = 120;
async function preprocessForOcr(blob: Blob): Promise<{ bytes: ArrayBuffer; width: number; height: number }> {
  const img = await loadImageFromBlob(blob);
  const scale = img.naturalHeight < OCR_MIN_HEIGHT_PX ? OCR_MIN_HEIGHT_PX / img.naturalHeight : 1;
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable for OCR preprocessing');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);

  // PNG bytes, not the canvas itself — the canvas can't cross into the OCR
  // worker (see ocr.service.ts), only transferable data like an ArrayBuffer.
  const pngBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!pngBlob) throw new Error('Could not encode preprocessed image for OCR');
  const bytes = await pngBlob.arrayBuffer();
  return { bytes, width: w, height: h };
}

// Shared by both a fresh capture and "Retry Character Read" — the latter
// re-runs this exact same recognition step against the same already-cropped
// photo, since the model's read can vary run to run and the photo/crop
// itself usually isn't what's wrong.
async function runOcrOnCrop(croppedBlob: Blob): Promise<void> {
  ocrBusy.value = true;
  try {
    // PP-OCR (deep-learning detector+recognizer) reads real-world photos far
    // more reliably than Tesseract's classical pipeline — this replaced
    // tesseract.js after it kept missing clearly-legible but blurry/skewed
    // phone photos. Unlike Tesseract, it wants the photo close to as-is (see
    // preprocessForOcr) — only upscaled, not binarized. Inference itself
    // runs inside a Web Worker (see ocr.service.ts), never on the main
    // thread, so it can't freeze this field's busy-state animation.
    const { bytes, width, height } = await preprocessForOcr(croppedBlob);
    const lines = await recognizeOrderNumber(bytes);
    // Joining everything the detector found in the crop glues on anything
    // the pad around the drawn box (see OcrCropModal's CROP_PAD_RATIO)
    // catches — a sliver of the row above/below, or a label sitting right
    // next to the digits on the same row. selectPrimaryLineText excludes
    // anything outside the box the user actually drew; normalizeOcrText then
    // trims to the expected length for known formats as a second pass, for
    // the rarer case where detection merges the label and the digits into
    // one box (no separate box left to filter out).
    const text = normalizeOcrText(selectPrimaryLineText(lines, width, height, orderNumberFormatRule.value), orderNumberFormatRule.value);
    if (!text) {
      const alert = await alertController.create({
        header: 'No Text Found',
        message: 'Could not read an order number from that selection. The photo may be too blurry or shaky for OCR even if it looks clear to you — try holding the camera steady without zooming in, with good lighting, or type the order number manually.',
        buttons: ['OK'],
      });
      await alert.present();
      return;
    }
    orderNumberInput.value = text;
    orderNumberManuallyEntered.value = false;
    sessionStore.setOrderNumber(text);
  } catch {
    const alert = await alertController.create({
      header: 'Scan Failed',
      message: 'Something went wrong reading that photo. Try again or type the order number manually.',
      buttons: ['OK'],
    });
    await alert.present();
  } finally {
    ocrBusy.value = false;
  }
}

async function handleOcrCapture(ev: Event): Promise<void> {
  const input = ev.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  await processCapturedImage(file);
}

// Shared by both capture paths (the custom camera modal and the classic
// file-input picker) — lets the user pinpoint just the order number in the
// photo before OCR ever runs on it, so other printed text (or a barcode
// sitting right next to it, as on these labels) doesn't confuse the read.
async function processCapturedImage(source: Blob): Promise<void> {
  ocrAttempted.value = true;

  const imageUrl = URL.createObjectURL(source);
  let croppedBlob: Blob | null = null;
  try {
    const modal = await modalController.create({
      component: OcrCropModal,
      componentProps: { imageSrc: imageUrl },
    });
    await modal.present();
    const { data, role } = await modal.onDidDismiss<Blob>();
    if (role === 'confirm' && data) croppedBlob = data;
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
  if (!croppedBlob) return; // user cancelled the crop step — same as cancelling the scan

  lastCroppedImage.value = croppedBlob;
  await runOcrOnCrop(croppedBlob);
}

// Re-reads the same cropped photo already on file — no new photo, no new
// crop step, just another recognition pass.
async function retryCharacterRead(): Promise<void> {
  if (!lastCroppedImage.value) return;
  await runOcrOnCrop(lastCroppedImage.value);
}

// Matches two known number-series config issues, neither fixed by retrying:
// BC's own "cannot assign new numbers from the number series <code>", and
// the backend's rollback when BC assigns the wrong series ("was assigned
// from No. Series 'X' instead of the required 'Y' ... order rolled back").
// Both mean nothing was posted, so they get the same explicit prompt.
const NUMBER_SERIES_EXHAUSTED_PATTERN = /cannot assign new numbers from the number series|was assigned from no\. series .* instead of the required .* order rolled back/i;

async function presentNumberSeriesExhaustedAlert(): Promise<void> {
  const alert = await alertController.create({
    header: 'Order Numbering Unavailable',
    message: 'Business Central could not assign a new order number right now. Nothing was submitted — your order is safe. Save it as a draft and try again once this is resolved.',
    buttons: [
      { text: 'Keep Editing', role: 'cancel' },
      { text: 'Save to Drafts', handler: () => saveDraftAndExit() },
    ],
  });
  await alert.present();
}

// The backend overloads trackingWarnings with a non-lot-tracking warning
// (wrong No. Series assigned) — strip that out here so "Lot tracking not
// recorded" only appears, and only lists, actual lot-tracking warnings.
const lotTrackingWarnings = computed(() =>
  result.value?.trackingWarnings?.filter((w) => !/no\.\s*series/i.test(w)) ?? [],
);

// Marketplace customers each have their own fixed order-number format on
// their platform — matched by customer display name (BC customer records
// are named after the marketplace, e.g. "Lazada Philippines Inc.").
interface OrderNumberFormatRule { name: string; customerMatch: RegExp; pattern: RegExp; length: number; description: string; digitsOnly: boolean; }
const ORDER_NUMBER_FORMAT_RULES: OrderNumberFormatRule[] = [
  { name: 'Lazada', customerMatch: /lazada/i, pattern: /^\d{16}$/, length: 16, description: '16 digits', digitsOnly: true },
  { name: 'Shopee', customerMatch: /shopee/i, pattern: /^[A-Za-z0-9]{14}$/, length: 14, description: '14 letters/numbers', digitsOnly: false },
  { name: 'TikTok', customerMatch: /tik\s*tok/i, pattern: /^\d{18}$/, length: 18, description: '18 digits', digitsOnly: true },
  { name: 'Zalora', customerMatch: /zalora/i, pattern: /^\d{9}$/, length: 9, description: '9 digits', digitsOnly: true },
  { name: 'Shopify', customerMatch: /shopify/i, pattern: /^[A-Za-z0-9]{6}$/, length: 6, description: '6 letters/numbers', digitsOnly: false },
  { name: 'Edamama', customerMatch: /edamama/i, pattern: /^SH[0-9A-F]{8}$/, length: 10, description: 'SH followed by 8 letters/numbers', digitsOnly: false },
  { name: 'GrabMart', customerMatch: /grabmart/i, pattern: /^[A-Z]{2}\d{3}$/, length: 5, description: '2 letters, 3 digits (e.g. GM-186)', digitsOnly: false },
];

const orderNumberFormatRule = computed(() => {
  const name = session.value?.customer?.displayName ?? '';
  return ORDER_NUMBER_FORMAT_RULES.find((r) => r.customerMatch.test(name)) ?? null;
});

// OCR cleanup: strip anything that isn't a letter/digit (stray punctuation
// the model sometimes injects), then for formats known to be digits-only,
// correct the handful of letter/digit shapes OCR confuses most often —
// cuts out the single biggest source of "almost right" reads for those
// marketplaces without guessing at anything for formats that mix letters
// and numbers, where a "fix" could just as easily turn a correct letter
// into a wrong digit.
const DIGIT_LOOKALIKES: Record<string, string> = { O: '0', I: '1', L: '1', S: '5', B: '8', Z: '2' };

// Shared with normalizeOcrText below — cleans a single detected token the
// same way the final result is cleaned (strip punctuation, uppercase,
// correct digit/letter lookalikes for digits-only formats), so a lone word
// can be tested against the expected pattern on its own.
function cleanOcrToken(raw: string, rule: OrderNumberFormatRule | null): string {
  let text = raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (rule?.digitsOnly) text = text.replace(/[A-Z]/g, (ch) => DIGIT_LOOKALIKES[ch] ?? ch);
  return text;
}

// Excludes anything the detector found only in OcrCropModal's padding
// margin — not just a whole stray line (a sliver of the row above/below
// bleeding in), but also a stray word on the SAME line (e.g. a label like
// "Number:" sitting right next to the digits, close enough that the padding
// reaches it too). The padding is symmetric, so the user's actual selection
// always occupies the crop's central 1 / (1 + 2 * CROP_PAD_RATIO) box on
// both axes — anything whose center falls outside that box only exists
// because of the padding, not because the user boxed it.
function selectPrimaryLineText(lines: OcrWord[][], canvasWidth: number, canvasHeight: number, rule: OrderNumberFormatRule | null): string {
  const marginFrac = CROP_PAD_RATIO / (1 + 2 * CROP_PAD_RATIO);
  const left = canvasWidth * marginFrac;
  const right = canvasWidth * (1 - marginFrac);
  const top = canvasHeight * marginFrac;
  const bottom = canvasHeight * (1 - marginFrac);
  const inZone = (word: OcrWord): boolean => {
    const cx = word.box.x + word.box.width / 2;
    const cy = word.box.y + word.box.height / 2;
    return cx >= left && cx <= right && cy >= top && cy <= bottom;
  };

  // A label ("Order ID:") or a trailing qualifier ("package 1") is almost
  // always printed as its own whitespace-separated word, distinct from the
  // order ID itself — so before joining anything, check each in-zone word on
  // its own: if one already matches the expected format exactly, use it
  // verbatim and never give surrounding words a chance to get concatenated
  // onto it at all. This is what actually "blocks" a neighbor from leaking
  // in, rather than trying to trim it back off after the fact.
  if (rule) {
    for (const line of lines) {
      for (const word of line) {
        if (inZone(word) && rule.pattern.test(cleanOcrToken(word.text, rule))) return word.text;
      }
    }
  }

  let bestZoneWords: OcrWord[] = [];
  let bestZoneLen = 0;
  // Fallback if the zone filter happens to reject everything (e.g. a box
  // drawn so tight the detector's own box extends past it) — the line
  // nearest the crop's vertical center, same as before this filter existed.
  let fallbackLine: OcrWord[] | null = null;
  let fallbackDist = Infinity;
  const centerY = canvasHeight / 2;

  for (const line of lines) {
    if (!line.length) continue;
    const zoneWords = line.filter(inZone);
    const zoneLen = zoneWords.reduce((sum, w) => sum + w.text.length, 0);
    if (zoneLen > bestZoneLen) {
      bestZoneLen = zoneLen;
      bestZoneWords = zoneWords;
    }

    const lineTop = Math.min(...line.map((word) => word.box.y));
    const lineBottom = Math.max(...line.map((word) => word.box.y + word.box.height));
    const dist = Math.abs((lineTop + lineBottom) / 2 - centerY);
    if (dist < fallbackDist) {
      fallbackDist = dist;
      fallbackLine = line;
    }
  }

  if (bestZoneLen > 0) return bestZoneWords.map((w) => w.text).join('');
  return fallbackLine ? fallbackLine.map((w) => w.text).join('') : '';
}

// Some marketplaces print a package-count marker right after the order ID
// on the same line (e.g. Shopee's "package 1", TikTok's "(1)") — close
// enough that it isn't a separate box the zone-filter can drop, and once
// stripped of punctuation it looks just like extra order-ID characters. A
// parenthesized count is especially dangerous for digits-only formats: it
// leaves a bare trailing digit that the length-trim below would "fix" by
// chopping the real leading digit instead, silently producing a wrong but
// still-valid-looking number. Strip both known markers before anything else.
// "pack\w*" (not the full literal word) because a real device capture showed
// the detector merging the ID and marker into ONE box with the marker itself
// OCR'd as a truncated "PACKA" — matching on just the distinctive "pack"
// prefix still catches that, since no real order ID format here ends in it.
const TRAILING_PACKAGE_MARKER = /\s*\(\s*\d+\s*\)\s*$|\s*pack\w*\s*#?\s*\d*\s*$/i;

function normalizeOcrText(raw: string, rule: OrderNumberFormatRule | null): string {
  let text = cleanOcrToken(raw.replace(TRAILING_PACKAGE_MARKER, ''), rule);
  // Every format is an exact fixed length. selectPrimaryLineText already
  // drops whole stray boxes found only in the crop's padding margin, but
  // detection can still merge a label and the digits into a SINGLE box when
  // they sit close enough together on the same line — there's no separate
  // box left to filter out in that case, just one text string with extra
  // characters baked in. Every bleed-through case seen so far has been a
  // PREFIX (the label/adjacent text sits to the left), so if the text is
  // longer than expected, keep just the trailing run — but only commit to
  // it if that right-aligned slice is itself a valid read.
  if (rule && text.length > rule.length) {
    const trimmed = text.slice(-rule.length);
    if (rule.pattern.test(trimmed)) text = trimmed;
  }
  return text;
}

const orderNumberFormatError = computed(() => {
  const rule = orderNumberFormatRule.value;
  const value = orderNumberInput.value.trim();
  if (!rule || !value || rule.pattern.test(value)) return null;
  return `${rule.name} order numbers must be exactly ${rule.description}.`;
});

const canSubmit = computed(() =>
  !!session.value?.customer && !!session.value.lines.length && !!orderNumberInput.value.trim()
  && !orderNumberFormatError.value,
);

async function openLotEditor(ev: Event, line: OrderLine): Promise<void> {
  const popover = await popoverController.create({
    component: LotEditorPopover,
    componentProps: {
      itemNumber: line.itemNumber,
      locationCode: line.locationCode,
      currentLotNo: line.lotNo,
    },
    event: ev,
    side: 'bottom',
    alignment: 'start',
    cssClass: 'lot-editor-popover',
  });
  await popover.present();
  const { data, role } = await popover.onDidDismiss<{
    lotNo?: string; expirationDate?: string; locationCode?: string; availableQuantity: number;
  }>();
  if (role === 'picked' && data) {
    sessionStore.updateLineLot(line.id, data);
  }
}

async function openQuantityEditor(ev: Event, line: OrderLine): Promise<void> {
  const popover = await popoverController.create({
    component: QuantityEditorPopover,
    componentProps: {
      modelValue: line.quantity,
      itemNumber: line.itemNumber,
      lotNo: line.lotNo,
      locationCode: line.locationCode,
      fallbackAvailable: line.availableQuantity,
    },
    event: ev,
    side: 'bottom',
    alignment: 'start',
    cssClass: 'quantity-editor-popover',
  });
  await popover.present();
  const { data, role } = await popover.onDidDismiss<number>();
  if (role === 'saved' && typeof data === 'number') {
    sessionStore.updateLineQuantity(line.id, data);
  }
}

// Third and final live re-check (after item selection and adding to the
// order in ItemSelectorModal) — right before the order is actually created
// in BC, so a second concurrent user's order submitted in the gap since
// this session's lines were added doesn't get silently oversold. Returns
// the first line found short, or null if every lot-tracked line still has
// enough remaining quantity.
async function verifyLotAvailability(lines: OrderLine[], locationCode?: string): Promise<string | null> {
  const lotLines = lines.filter((l) => l.lotNo);
  if (!lotLines.length) return null;
  const results = await Promise.all(lotLines.map(async (line) => {
    try {
      const page = await ApiService.getItemLots(line.itemNumber, { limit: 100, locationCode });
      const fresh = page.value.find((l) => l.lotNo === line.lotNo && l.locationCode === line.locationCode);
      const freshQty = fresh?.remainingQuantity ?? 0;
      if (line.quantity > freshQty) {
        return `${line.description || line.itemNumber}: only ${freshQty} left for lot ${line.lotNo} now — someone else may have just used it. Adjust the quantity and try again.`;
      }
    } catch {
      // Live check failed (network hiccup) — don't block submission on it;
      // BC's own FEFO-capped lot availability is the final authority.
    }
    return null;
  }));
  return results.find((r): r is string => r !== null) ?? null;
}

// One more look at a hand-typed order number before it goes to BC — a
// scanned number already went through the crop + format-validation steps,
// but a typed one only has the format check, which can't catch a wrong
// number that still happens to match the right shape.
async function confirmManualOrderNumber(): Promise<boolean> {
  return new Promise((resolve) => {
    void alertController.create({
      header: 'Confirm Order Number',
      message: 'This order number was typed manually. Please confirm it before submitting.',
      inputs: [{ name: 'orderNumber', type: 'text', value: orderNumberInput.value }],
      buttons: [
        { text: 'Cancel', role: 'cancel', handler: () => resolve(false) },
        {
          text: 'Confirm',
          handler: (data: { orderNumber?: string }) => {
            const value = (data.orderNumber ?? '').trim();
            if (!value) return false; // keep the alert open rather than confirm a blank number
            orderNumberInput.value = value;
            sessionStore.setOrderNumber(value);
            resolve(true);
            return true;
          },
        },
      ],
    }).then((alert) => alert.present());
  });
}

async function handleSubmit(): Promise<void> {
  if (!session.value?.customer || !canSubmit.value) return;
  if (orderNumberManuallyEntered.value && !(await confirmManualOrderNumber())) return;
  submitting.value = true;
  submitError.value = null;

  const availabilityIssue = await verifyLotAvailability(session.value.lines, session.value.customer.locationCode);
  if (availabilityIssue) {
    submitError.value = availabilityIssue;
    lastSubmitError.value = availabilityIssue;
    submitting.value = false;
    return;
  }

  const customer = session.value.customer;
  const postingDate = session.value.postingDate;
  const orderNumber = orderNumberInput.value.trim();
  const submitLines = session.value.lines.map((l) => ({
    itemNumber: l.itemNumber,
    description: l.description,
    quantity: l.quantity,
    unitOfMeasureCode: l.unitOfMeasureCode,
    lotNo: l.lotNo,
    expirationDate: l.expirationDate,
    locationCode: l.locationCode,
    qtyPerUnitOfMeasure: l.qtyPerUnitOfMeasure,
  }));
  const historyLines: OrderHistoryLine[] = submitLines;

  try {
    const res = await ApiService.submitSalesOrder({
      customerNumber: customer.number,
      postingDate,
      orderNumber,
      ...(authStore.user?.displayName ? { submittedBy: authStore.user.displayName } : {}),
      ...(customer.locationCode ? { locationCode: customer.locationCode } : {}),
      lines: submitLines,
    });
    result.value = res;
    sessionStore.markSubmitted(res.documentNumber);
    // Fire-and-forget — a history-write hiccup must never taint a
    // successful, already-confirmed-to-the-user submission.
    ApiService.recordOrderHistory({
      id: generateId(),
      username: authStore.user?.username ?? '',
      userDisplayName: authStore.user?.displayName,
      companyCode: authStore.company?.code,
      customerNumber: customer.number,
      customerDisplayName: customer.displayName,
      orderNumber,
      postingDate,
      status: 'success',
      salesOrderNumber: res.documentNumber,
      lines: historyLines,
      createdAt: new Date().toISOString(),
    }).catch(() => {});
  } catch (err) {
    // Nothing was posted — the draft stays intact in localStorage for retry.
    submitError.value = err instanceof ApiError ? err.message : 'Submission failed. Please try again.';
    lastSubmitError.value = err;
    sessionStore.markFailed(submitError.value);
    ApiService.recordOrderHistory({
      id: generateId(),
      username: authStore.user?.username ?? '',
      userDisplayName: authStore.user?.displayName,
      companyCode: authStore.company?.code,
      customerNumber: customer.number,
      customerDisplayName: customer.displayName,
      orderNumber,
      postingDate,
      status: 'failed',
      errorMessage: submitError.value,
      lines: historyLines,
      createdAt: new Date().toISOString(),
    }).catch(() => {});
    if (NUMBER_SERIES_EXHAUSTED_PATTERN.test(submitError.value)) {
      await presentNumberSeriesExhaustedAlert();
    }
  } finally {
    submitting.value = false;
  }
}

function reportSubmitError(): void {
  openReport({ error: lastSubmitError.value, context: 'Order submission failed on Submit Order page' });
}

function saveDraftAndExit(): void {
  sessionStore.saveAsDraftAndExit();
  router.replace('/app/home');
}

function finishAndGoHome(): void {
  sessionStore.clearCurrentSession();
  router.replace('/app/home');
}
</script>

<style scoped>
/* Desktop (≥1024px): checkout-style layout — the fill-and-submit flow on
   the left (grid-column: 1, in the same reading order as mobile via `order`),
   a sticky line-item review on the right, so Submit never scrolls out of
   view behind a long order. Every rule here is purely visual placement —
   no element moved in the DOM, so mobile's reading order (see template
   comment above) can never silently drift out of sync with this layout. */
@media (min-width: 1024px) {
  .submit-layout {
    display: grid;
    grid-template-columns: 1fr 380px;
    gap: 32px;
    padding: 24px;
    align-items: start;
  }

  .submit-card { grid-column: 1; order: 1; }

  .order-no-field {
    grid-column: 1;
    order: 2;
    margin-left: 0;
    margin-right: 0;
  }

  .ocr-action-row { grid-column: 1; order: 2; }
  .order-no-error { grid-column: 1; order: 2; }
  .ocr-load-progress { grid-column: 1; order: 2; }

  .submit-error { grid-column: 1; order: 3; }

  .action-buttons {
    grid-column: 1;
    order: 4;
    padding-left: 0;
    padding-right: 0;
  }

  .lines-section {
    grid-column: 2;
    grid-row: 1;
    position: sticky;
    top: 24px;
  }

  .lines-section .section-label {
    padding-left: 0;
    padding-right: 0;
  }

  .lines-list {
    margin: 0;
  }
}

.state-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 48px 24px;
  color: var(--app-text-muted);
  text-align: center;
}

.detail-row {
  color: var(--app-text-muted);
  margin: 0;
}

.order-no-field {
  margin: 4px 16px 0;
}

/* ion-skeleton-text's own :animated shimmer animates background-position,
   which forces a main-thread repaint every frame — it visibly freezes
   whenever the main thread is busy, which synchronous WASM OCR inference
   reliably keeps it during (worse on weaker mobile CPUs). opacity is
   compositor-only, so this pulse keeps animating through that same stretch
   instead of relying on :animated at all. */
.order-no-skeleton {
  width: 70%;
  height: 20px;
  margin: 8px 0;
  animation: order-no-skeleton-pulse 1s ease-in-out infinite;
}

@keyframes order-no-skeleton-pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

/* ── OCR scan button — deliberately NOT a bare small icon. Solid,
   high-contrast blue circle with a white glyph, same "primary action"
   language as the barcode scanner's own toggle button, so scanning reads
   as the main way to fill this field, not a hidden option. ── */
.ocr-scan-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  margin-inline-end: 2px;
  border: none;
  border-radius: 50%;
  background: var(--app-blue);
  color: #ffffff;
  font-size: 22px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(36, 97, 168, 0.35);
  transition: transform 0.15s var(--ease-out-quart), box-shadow 0.15s var(--ease-out-quart);
  -webkit-tap-highlight-color: transparent;
}

.ocr-scan-btn:active {
  transform: scale(0.94);
}

.ocr-scan-btn:disabled {
  background: var(--app-border);
  box-shadow: none;
  cursor: not-allowed;
}

.ocr-action-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 20px;
  margin: 8px 16px 0;
}

.ocr-retry-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--app-blue);
  font-size: var(--text-sm);
  font-weight: 600;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.ocr-retry-btn:disabled {
  color: var(--app-text-muted);
  cursor: not-allowed;
}

.ocr-retry-btn ion-icon {
  font-size: 16px;
}

.order-no-error {
  color: var(--ion-color-danger);
  font-size: var(--text-xs);
  margin: 4px 16px 0;
}

.ocr-load-progress {
  color: var(--app-text-muted);
  font-size: var(--text-xs);
  margin: 4px 16px 0;
}

.ocr-file-input {
  display: none;
}

.lines-list {
  margin: 0 12px;
  border-radius: var(--app-radius);
  overflow: hidden;
}

.line-detail-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin: 2px 0 0;
}

.line-detail-label {
  color: var(--app-text-muted);
  font-size: var(--text-xs);
  min-width: 78px;
  flex-shrink: 0;
}

.submit-error {
  color: var(--ion-color-danger);
  text-align: center;
  padding: 8px 16px 0;
}

.confirmation {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 64px 24px;
  gap: 4px;
}

.confirm-icon {
  font-size: 56px;
  color: var(--ion-color-success);
  margin-bottom: 8px;
  animation: confirm-icon-in 0.4s var(--ease-out-quart) both;
}

.confirm-heading,
.confirm-doc,
.confirm-doc-no,
.confirm-order-no {
  animation: fade-slide-up 0.4s var(--ease-out-quart) both;
  animation-delay: 0.08s;
}

.confirm-doc {
  color: var(--app-text-muted);
  font-size: var(--text-sm);
  margin: 12px 0 0;
}

.confirm-doc-no {
  font-size: var(--text-2xl);
  font-weight: 700;
  color: var(--app-blue);
  margin: 0;
  animation-delay: 0.14s;
}

.confirm-order-no {
  color: var(--app-text-muted);
  margin: 4px 0 24px;
  animation-delay: 0.18s;
}

.tracking-warning {
  background: var(--app-surface-alt);
  border-radius: var(--app-radius-sm);
  padding: 10px 14px;
  margin: 0 0 20px;
  text-align: left;
  font-size: var(--text-xs);
  color: var(--app-text-muted);
}

.tracking-warning-title {
  color: var(--app-low-stock-text);
  font-weight: 700;
  margin: 0 0 4px;
}

@keyframes confirm-icon-in {
  from { opacity: 0; transform: scale(0.75); }
  to   { opacity: 1; transform: scale(1);    }
}
</style>
