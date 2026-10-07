<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ selectedItem ? 'Add Item' : viewMode === 'scanner' ? 'Scan Barcode' : 'Select Item' }}</ion-title>
        <ion-buttons slot="start">
          <ion-button @click="handleClose">
            <ion-icon :icon="selectedItem ? chevronBackOutline : closeOutline" slot="icon-only" />
          </ion-button>
        </ion-buttons>
        <ion-buttons v-if="!selectedItem" slot="end">
          <!-- Prominent by design: a solid, high-contrast circular button (not
               a bare toolbar icon) so scanning reads as a primary action, not
               a hidden option. -->
          <button
            v-if="viewMode === 'list'"
            type="button"
            class="scan-toggle-btn"
            :disabled="!cameraAvailable"
            :title="cameraAvailable ? 'Scan a barcode' : 'Camera unavailable'"
            @click="openScanner"
          >
            <ion-icon :icon="barcodeOutline" />
          </button>
          <ion-button v-else fill="clear" @click="closeScanner">
            <ion-icon :icon="listOutline" slot="icon-only" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
      <ion-toolbar v-if="!selectedItem && viewMode === 'list'">
        <ion-searchbar
          v-model="searchTerm"
          placeholder="Search by item number, ID, or code"
          :debounce="250"
          @ion-input="onSearchInput"
        />
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <!-- ── List / search mode ── -->
      <template v-if="!selectedItem && viewMode === 'list'">
        <div v-if="barcodeNotFound" class="barcode-miss">
          <ion-icon :icon="alertCircleOutline" />
          <span>No item found for barcode <strong>{{ lastScannedBarcode }}</strong>. Showing search results.</span>
        </div>
        <Transition name="view-fade" mode="out-in">
          <div v-if="loadingItems" key="loading" class="skel-list">
            <div v-for="n in 6" :key="n" class="skel-row">
              <div class="skel-bone" />
              <div class="skel-bone" />
            </div>
          </div>
          <div v-else-if="itemsError" key="error" class="state-block state-block--error">
            <p>{{ itemsError }}</p>
            <ion-button size="small" fill="outline" @click="fetchItems">Retry</ion-button>
          </div>
          <div v-else-if="!items.length" key="empty" class="state-block">
            <ion-icon :icon="searchOutline" class="state-icon" />
            <p>{{ searchTerm ? 'No items match your search.' : 'Start typing to search items.' }}</p>
          </div>
          <div v-else key="results" class="items-results">
            <ion-list lines="full">
              <ion-item v-for="it in items" :key="it.id" button @click="pickItem(it)">
                <ion-label>
                  <h2>{{ it.description || it.number }}</h2>
                  <p>
                    #{{ it.number }} · {{ it.description || '—' }}
                    <span v-if="settingsStore.showItemPrices && priceMap[it.number] != null" class="item-price">
                      · {{ formatCurrency(priceMap[it.number]) }}
                    </span>
                  </p>
                </ion-label>
                <ion-icon :icon="chevronForwardOutline" slot="end" color="medium" />
              </ion-item>
            </ion-list>
            <div class="pager">
              <ion-button fill="clear" size="small" :disabled="offset === 0" @click="goPrevPage">
                <ion-icon :icon="chevronBackOutline" slot="start" /> Prev
              </ion-button>
              <span class="pager-label">{{ pagerLabel }}</span>
              <ion-button fill="clear" size="small" :disabled="!hasNextPage" @click="goNextPage">
                Next <ion-icon :icon="chevronForwardOutline" slot="end" />
              </ion-button>
            </div>
          </div>
        </Transition>
      </template>

      <!-- ── Scanner mode ── -->
      <template v-else-if="!selectedItem && viewMode === 'scanner'">
        <div class="scanner-wrap">
          <video ref="videoEl" autoplay playsinline muted class="scanner-video" />

          <div class="scanner-ui">
            <div class="scanner-frame">
              <div class="corner tl" />
              <div class="corner tr" />
              <div class="corner bl" />
              <div class="corner br" />
              <div v-if="scanStatus === 'scanning'" class="scan-line" />
            </div>
            <p class="scan-hint" :class="`scan-hint--${scanStatus}`">{{ scanHintText }}</p>
          </div>

          <!-- Single barcode confirmation -->
          <div v-if="scanStatus === 'confirm'" class="single-confirm">
            <div class="single-confirm-header">
              <ion-icon :icon="checkmarkCircleOutline" class="single-confirm-icon" />
              <p class="single-confirm-title">Barcode detected</p>
            </div>
            <p class="single-confirm-value">{{ confirmedBarcode }}</p>
            <ion-button expand="block" color="primary" class="single-confirm-btn" @click="acceptBarcode">
              Use This Barcode
            </ion-button>
            <button class="rescan-btn" @click="resumeScanning">
              <ion-icon :icon="refreshOutline" />
              Scan Again
            </button>
          </div>

          <!-- Multi-barcode picker -->
          <div v-if="scanStatus === 'multiple'" class="multi-picker">
            <p class="multi-picker-title">Multiple barcodes detected</p>
            <p class="multi-picker-sub">Code 128 listed first — tap one to use it:</p>
            <button
              v-for="(b, idx) in detectedBarcodes"
              :key="idx"
              class="multi-bc-btn"
              :class="{ 'multi-bc-btn--priority': b.format === 'code_128' }"
              @click="pickBarcode(b.rawValue)"
            >
              <span class="multi-bc-format">{{ formatLabel(b.format) }}</span>
              <span class="multi-bc-value">{{ b.rawValue }}</span>
            </button>
            <button class="rescan-btn" @click="resumeScanning">
              <ion-icon :icon="refreshOutline" />
              Scan Again
            </button>
          </div>

          <!-- Manual input fallback -->
          <div class="manual-wrap">
            <p class="manual-label">Or enter barcode manually:</p>
            <div class="manual-row">
              <ion-input
                v-model="manualBarcode"
                placeholder="Item number / barcode"
                class="manual-input"
                @keyup.enter="submitManual"
              />
              <ion-button size="default" @click="submitManual">
                <ion-icon :icon="searchOutline" slot="icon-only" />
              </ion-button>
            </div>
          </div>
        </div>
      </template>

      <!-- ── Item detail / add mode ── -->
      <div v-else-if="selectedItem" class="detail animate-in">
        <ion-card>
          <ion-card-header>
            <ion-card-subtitle>Item Number</ion-card-subtitle>
            <ion-card-title>{{ selectedItem.number }}</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <p class="detail-desc">{{ selectedItem.description || '—' }}</p>
          </ion-card-content>
        </ion-card>

        <Transition name="view-fade" mode="out-in">
          <div v-if="loadingDetail" key="loading" class="state-block">
            <ion-spinner name="crescent" />
            <p>Loading availability…</p>
          </div>
          <div v-else key="form">
            <ion-item lines="none" class="detail-field">
              <ion-label position="stacked">Quantity</ion-label>
              <div class="qty-stepper">
                <ion-button color="primary" fill="outline" size="small" @click="adjustQty(-1)" :disabled="quantity <= 1">
                  <ion-icon :icon="removeOutline" slot="icon-only" />
                </ion-button>
                <ion-input
                  v-model.number="quantity"
                  type="number"
                  class="qty-input"
                  min="1"
                  :max="availableQuantity || undefined"
                  @ion-blur="clampQty"
                />
                <ion-button color="primary" fill="outline" size="small" @click="adjustQty(1)" :disabled="quantity >= availableQuantity">
                  <ion-icon :icon="addOutline" slot="icon-only" />
                </ion-button>
              </div>
              <p class="detail-hint" :class="{ 'detail-hint--low': isLowStock }">
                {{ availableQuantity }} available{{ selectedLot?.lotNo ? ` (lot ${selectedLot.lotNo})` : '' }}
                <span v-if="quantity > 0" class="remaining-preview">· {{ remainingAfterQty }} will remain</span>
              </p>
              <p v-if="availabilityError" class="detail-warning">{{ availabilityError }}</p>
            </ion-item>

            <ion-item lines="none" class="detail-field">
              <ion-label position="stacked">Unit of Measure</ion-label>
              <ion-select v-model="unitOfMeasureCode" interface="action-sheet" placeholder="Select UOM">
                <ion-select-option v-for="u in uomOptions" :key="u.code" :value="u.code">
                  {{ u.code }}{{ u.description ? ` — ${u.description}` : '' }}
                </ion-select-option>
              </ion-select>
            </ion-item>

            <ion-item lines="none" class="detail-field">
              <ion-label position="stacked">Expiry Date</ion-label>
              <!-- Multiple open lots: let the user pick, defaulted to the
                   earliest expiration (lots arrive oldest-first from the
                   backend, FEFO). Single lot: no choice to make, plain text. -->
              <ion-select
                v-if="lots.length > 1"
                v-model="selectedLotIndex"
                interface="action-sheet"
                placeholder="Select expiration date"
              >
                <ion-select-option v-for="(lot, i) in lots" :key="lot.lotNo ?? i" :value="i">
                  {{ formatDate(lot.expirationDate) }}{{ lot.lotNo ? ` — lot ${lot.lotNo}` : '' }} ({{ lot.remainingQuantity }} avail.)
                </ion-select-option>
              </ion-select>
              <p v-else class="expiry-value">
                {{ formatDate(effectiveExpirationDate) }}
              </p>
              <p v-if="shelfLifeApplied" class="shelf-life-note">
                Entered expiry: <strong>{{ formatDate(effectiveExpirationDate) }}</strong>
                (lot expiry {{ formatDate(selectedLot?.expirationDate) }} + {{ customerShelfLifeMonths }} mo. customer shelf life)
              </p>
              <span v-if="isExpiringSoon(effectiveExpirationDate)" class="expiry-badge">Expiring soon</span>
            </ion-item>

            <p v-if="availableQuantity === 0" class="detail-warning">
              No available stock found for this item in Business Central.
            </p>

            <ion-button
              expand="block"
              class="add-btn"
              :disabled="!canAdd || verifyingAvailability"
              @click="confirmAdd"
            >
              <ion-spinner v-if="verifyingAvailability" name="dots" />
              <span v-else>Add to Order</span>
            </ion-button>
          </div>
        </Transition>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon, IonSearchbar,
  IonContent, IonList, IonItem, IonLabel, IonSpinner, IonCard, IonCardHeader, IonCardSubtitle,
  IonCardTitle, IonCardContent, IonInput, IonSelect, IonSelectOption, modalController,
} from '@ionic/vue';
import {
  closeOutline, chevronBackOutline, chevronForwardOutline, searchOutline, removeOutline, addOutline,
  barcodeOutline, listOutline, checkmarkCircleOutline, refreshOutline, alertCircleOutline,
} from 'ionicons/icons';
import { ApiService } from '@/services/api.service';
import { ItemCatalogService } from '@/services/item-catalog.service';
import { useAuthStore } from '@/stores/auth.store';
import { useSessionStore } from '@/stores/session.store';
import { useSettingsStore } from '@/stores/settings.store';
import { formatDate, formatCurrency, isExpiringSoon, addShelfLifeMonths } from '@/utils/format';
import type { Item, ItemLot, ItemUnitOfMeasure, Page } from '@/types';

const props = defineProps<{ startInScanner?: boolean }>();

const authStore = useAuthStore();
const sessionStore = useSessionStore();
const settingsStore = useSettingsStore();

const PAGE_SIZE = 25;
// Lots per item are a small, bounded set in practice (a handful of open batches),
// so one generously-sized page is enough to compute total availability without
// needing a dedicated aggregate endpoint.
const LOTS_FETCH_LIMIT = 100;
// Below this, flag the picker as "getting low" (amber) rather than waiting for
// zero (which is already a hard-stop, shown separately as a danger message).
const LOW_STOCK_THRESHOLD = 10;

// Data goes back to the caller via modalController.dismiss(data, role) +
// the caller's `await modal.onDidDismiss()` — NOT via emit(). Ionic Vue's
// modalController mounts this component with `h(component, componentProps)`
// and no listener wiring for its emits, so a Vue `emit()` call here has no
// parent listener and never surfaces as anything the caller can observe
// (confirmed against @ionic/vue's actual VueDelegate/attachViewToDom source —
// this is not a framework detail worth re-deriving by trial and error).

// ── Search / list state ──
const searchTerm = ref('');
const items = ref<Item[]>([]);
const loadingItems = ref(false);
const itemsError = ref<string | null>(null);
const offset = ref(0);
const total = ref(0);

// Live-only, never part of the item catalog cache (see PRODUCT.md — pricing
// is always fetched fresh) — populated for whichever page of items is
// currently on screen, only when the "Display Item Prices" setting is on.
const priceMap = ref<Record<string, number>>({});

const hasNextPage = computed(() => offset.value + PAGE_SIZE < total.value);
const pagerLabel = computed(() => {
  if (!total.value) return '0 items';
  const from = offset.value + 1;
  const to = Math.min(offset.value + items.value.length, total.value);
  return `${from}–${to} of ${total.value}`;
});

// Filters/paginates the cached catalog client-side — number/description
// substring match, same semantics as the live /food/items search. Instant:
// no network round trip once the catalog is loaded.
function filterCatalog(catalog: Item[], search: string, limit: number, off: number): Page<Item> {
  const term = search.trim().toLowerCase();
  const filtered = term
    ? catalog.filter((it) => it.number.toLowerCase().includes(term) || (it.description ?? '').toLowerCase().includes(term))
    : catalog;
  return { value: filtered.slice(off, off + limit), total: filtered.length, limit, offset: off };
}

let searchToken = 0;
async function fetchItems(): Promise<void> {
  loadingItems.value = true;
  itemsError.value = null;
  const token = ++searchToken;
  try {
    // Cache-first: the item catalog (number/description/base UOM) preloaded
    // on login. Quantity/lot/expiry are never part of this cache — those are
    // still always fetched live once an item is picked (see pickItem below).
    const cached = ItemCatalogService.getItems(authStore.company?.code ?? '');
    const page = cached
      ? filterCatalog(cached, searchTerm.value, PAGE_SIZE, offset.value)
      : await ApiService.getItems({ search: searchTerm.value.trim(), limit: PAGE_SIZE, offset: offset.value });
    if (token !== searchToken) return; // a newer search superseded this one
    items.value = page.value;
    total.value = page.total;
    if (settingsStore.showItemPrices) void loadPricesFor(page.value);
  } catch (err) {
    if (token !== searchToken) return;
    itemsError.value = err instanceof Error ? err.message : 'Could not load items.';
  } finally {
    if (token === searchToken) loadingItems.value = false;
  }
}

// Fire-and-forget, on top of the item list rendering immediately — prices
// are a nice-to-have overlay, never something worth blocking or re-erroring
// the whole list over.
async function loadPricesFor(pageItems: Item[]): Promise<void> {
  try {
    const map = await ApiService.getItemPrices(pageItems.map((i) => i.number));
    priceMap.value = { ...priceMap.value, ...map };
  } catch {
    // ignore — prices just won't show for this page
  }
}

function onSearchInput(): void {
  offset.value = 0;
  fetchItems();
}

function goNextPage(): void {
  offset.value += PAGE_SIZE;
  fetchItems();
}

function goPrevPage(): void {
  offset.value = Math.max(0, offset.value - PAGE_SIZE);
  fetchItems();
}

fetchItems();

// ── Barcode scanner — ported from rgmc-consignment-webapp's ItemSelectorModal:
// same BarcodeDetector-based auto-detect flow (a web-platform API, no native
// plugin, so it works in this web-only PWA), same confirm/multi-barcode/manual-
// entry behavior. Adapted for resolution: instead of matching against a props-
// supplied offline item list, it checks the item catalog cache first, falling
// back to a live /food/items search — mirroring how the rest of this modal
// already resolves items, cache-first with a live fallback. ──
type ViewMode = 'list' | 'scanner';
type ScanStatus = 'starting' | 'scanning' | 'detected' | 'error' | 'multiple' | 'confirm';

interface DetectedBarcode { rawValue: string; format: string; }

const FORMAT_PRIORITY: Record<string, number> = {
  code_128: 0, code_39: 1, ean_13: 2, ean_8: 3, upc_a: 4, upc_e: 5, qr_code: 6,
};
const FORMAT_LABELS: Record<string, string> = {
  code_128: 'Code 128', code_39: 'Code 39', ean_13: 'EAN-13',
  ean_8: 'EAN-8', upc_a: 'UPC-A', upc_e: 'UPC-E', qr_code: 'QR Code',
};
function formatLabel(fmt: string): string {
  return FORMAT_LABELS[fmt] ?? fmt;
}

const viewMode = ref<ViewMode>('list');
const videoEl = ref<HTMLVideoElement | null>(null);
const videoStream = ref<MediaStream | null>(null);
const scanStatus = ref<ScanStatus>('starting');
const manualBarcode = ref('');
const detectedBarcodes = ref<DetectedBarcode[]>([]);
const confirmedBarcode = ref('');
const barcodeNotFound = ref(false);
const lastScannedBarcode = ref('');
const cameraAvailable = ref('mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices);
let detectionInterval: ReturnType<typeof setInterval> | null = null;
let audioCtx: AudioContext | null = null;

const scanHintText = computed(() => {
  switch (scanStatus.value) {
    case 'starting': return 'Starting camera…';
    case 'scanning': return 'Point camera at barcode';
    case 'detected': return 'Barcode detected!';
    case 'confirm':  return 'Barcode detected — confirm to use it';
    case 'multiple': return 'Multiple barcodes found — select one below';
    case 'error':    return 'Camera unavailable — use manual input';
    default: return '';
  }
});

async function openScanner(): Promise<void> {
  viewMode.value = 'scanner';
  barcodeNotFound.value = false;
  manualBarcode.value = '';
  scanStatus.value = 'starting';

  // Unlock AudioContext while still in the tap gesture — required by iOS Safari.
  try {
    audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') void audioCtx.resume();
  } catch {
    audioCtx = null;
  }

  await new Promise((r) => setTimeout(r, 80)); // let DOM render the video element

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
    });
    videoStream.value = stream;
    if (videoEl.value) {
      videoEl.value.srcObject = stream;
      await videoEl.value.play();
    }
    scanStatus.value = 'scanning';
    if ('BarcodeDetector' in window) {
      startAutoDetection();
    }
  } catch {
    scanStatus.value = 'error';
  }
}

function beepAndHaptic(): void {
  navigator.vibrate?.(60);
  if (!audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(1800, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.08);
  } catch {
    // ignore — audio feedback is a nicety, never a requirement
  }
}

function startAutoDetection(): void {
  type RawDetector = { detect: (el: HTMLVideoElement) => Promise<DetectedBarcode[]> };
  const detector = new (window as unknown as { BarcodeDetector: new (opts: object) => RawDetector }).BarcodeDetector({
    formats: ['code_128', 'ean_13', 'ean_8', 'code_39', 'upc_a', 'upc_e', 'qr_code'],
  });

  detectionInterval = setInterval(async () => {
    if (!videoEl.value || scanStatus.value === 'detected' || scanStatus.value === 'multiple' || scanStatus.value === 'confirm') return;
    try {
      const raw = await detector.detect(videoEl.value);
      if (raw.length === 0) return;

      beepAndHaptic();

      if (raw.length === 1) {
        stopDetectionOnly();
        confirmedBarcode.value = raw[0].rawValue;
        scanStatus.value = 'confirm';
        return;
      }

      const sorted = [...raw].sort((a, b) => (FORMAT_PRIORITY[a.format] ?? 99) - (FORMAT_PRIORITY[b.format] ?? 99));
      stopDetectionOnly();
      detectedBarcodes.value = sorted;
      scanStatus.value = 'multiple';
    } catch {
      // per-frame errors are normal while the video is still buffering
    }
  }, 250);
}

function stopDetectionOnly(): void {
  if (detectionInterval) {
    clearInterval(detectionInterval);
    detectionInterval = null;
  }
}

function acceptBarcode(): void {
  const code = confirmedBarcode.value;
  confirmedBarcode.value = '';
  scanStatus.value = 'detected';
  stopCamera();
  setTimeout(() => resolveBarcode(code), 150);
}

function pickBarcode(code: string): void {
  detectedBarcodes.value = [];
  scanStatus.value = 'detected';
  stopCamera();
  setTimeout(() => resolveBarcode(code), 200);
}

function resumeScanning(): void {
  detectedBarcodes.value = [];
  confirmedBarcode.value = '';
  if (!videoStream.value) {
    void openScanner();
    return;
  }
  scanStatus.value = 'scanning';
  if ('BarcodeDetector' in window) startAutoDetection();
}

function closeScanner(): void {
  stopCamera();
  viewMode.value = 'list';
}

function stopCamera(): void {
  stopDetectionOnly();
  videoStream.value?.getTracks().forEach((t) => t.stop());
  videoStream.value = null;
  audioCtx?.close();
  audioCtx = null;
}

function submitManual(): void {
  const code = manualBarcode.value.trim();
  if (!code) return;
  stopCamera();
  resolveBarcode(code);
}

async function resolveBarcode(code: string): Promise<void> {
  const term = code.trim();
  if (!term) return;

  const cached = ItemCatalogService.getItems(authStore.company?.code ?? '');
  let match = cached?.find((i) => i.number.toUpperCase() === term.toUpperCase())
    ?? cached?.find((i) => i.number.toUpperCase().includes(term.toUpperCase()));
  // The specific Unit of Measure a scanned barcode was assigned to on BC's
  // Item Reference table (5777) — e.g. a case-pack barcode resolves to a
  // box/case UOM, not the item's base UOM. Only set when the barcode was
  // actually found there.
  let referencedUom: string | undefined;

  if (!match) {
    // A real barcode (GTIN/EAN/vendor code) is almost never the BC Item No.
    // itself — look it up against BC's Item Reference table before falling
    // back to a plain number/description search.
    try {
      const refs = await ApiService.getItemReferences(term);
      const ref = refs.find((r) => r.referenceType === 'Bar Code') ?? refs[0];
      if (ref?.itemNo) {
        referencedUom = ref.unitOfMeasure || undefined;
        match = cached?.find((i) => i.number.toUpperCase() === ref.itemNo.toUpperCase());
        if (!match) {
          const page = await ApiService.getItems({ search: ref.itemNo, limit: 5 });
          match = page.value.find((i) => i.number.toUpperCase() === ref.itemNo!.toUpperCase());
        }
      }
    } catch {
      // ignore — falls through to the plain item search below
    }
  }

  if (!match) {
    // Cache miss and no Item Reference match — try one live number/description
    // lookup before giving up, same cache-first-then-live pattern the rest of
    // this modal uses.
    try {
      const page = await ApiService.getItems({ search: term, limit: 5 });
      match = page.value.find((i) => i.number.toUpperCase() === term.toUpperCase()) ?? page.value[0];
    } catch {
      // ignore — falls through to the not-found path below
    }
  }

  if (match) {
    viewMode.value = 'list';
    await pickItem(match, referencedUom);
    return;
  }

  // No match anywhere — drop back to search with the scanned code prefilled,
  // same fallback rgmc-consignment-webapp uses when nothing matches.
  lastScannedBarcode.value = term;
  barcodeNotFound.value = true;
  searchTerm.value = term;
  offset.value = 0;
  viewMode.value = 'list';
  fetchItems();
}

if (props.startInScanner) {
  void openScanner();
}

onUnmounted(() => {
  stopCamera();
});

// ── Detail / add mode state ──
const selectedItem = ref<Item | null>(null);
const loadingDetail = ref(false);
const lots = ref<ItemLot[]>([]);
const uomOptions = ref<ItemUnitOfMeasure[]>([]);
const quantity = ref(1);
const unitOfMeasureCode = ref('');
// Index into `lots` (already oldest-expiration-first from the backend) — the
// lot the line will actually be drawn from. Defaults to 0 (earliest expiry,
// FEFO) and only exposed as a picker when more than one lot is open.
const selectedLotIndex = ref(0);

const selectedLot = computed(() => lots.value[selectedLotIndex.value] ?? lots.value[0] ?? null);
// Quantity is capped by the SELECTED lot's own remaining stock, not the sum
// across all lots — a sales line is drawn from one physical batch.
const availableQuantity = computed(() => selectedLot.value?.remainingQuantity || 0);
const isLowStock = computed(() => availableQuantity.value > 0 && availableQuantity.value <= LOW_STOCK_THRESHOLD);

// "Include Item Shelf Life" setting — extends the SELECTED lot's real BC
// expiration date by the current session's customer's Prod Shelf Life
// (months). This becomes the effective expiry used everywhere for this
// line: displayed here, and carried into the order line / BC Item Tracking
// Line on submission — not just a cosmetic label. The lot picker options
// (when more than one lot is open) still show each lot's own real date, so
// FEFO selection stays based on true expiry.
const customerShelfLifeMonths = computed(() => sessionStore.currentSession?.customer?.prodShelfLife ?? 0);
const effectiveExpirationDate = computed(() => {
  if (!settingsStore.includeShelfLife) return selectedLot.value?.expirationDate;
  return addShelfLifeMonths(selectedLot.value?.expirationDate, customerShelfLifeMonths.value);
});
const shelfLifeApplied = computed(() =>
  settingsStore.includeShelfLife && customerShelfLifeMonths.value > 0 && !!selectedLot.value?.expirationDate,
);
const canAdd = computed(() =>
  !!selectedItem.value && !!unitOfMeasureCode.value && quantity.value >= 1 && quantity.value <= availableQuantity.value,
);
// Temporary, client-only preview — not persisted or sent anywhere — so the
// user sees what the lot's stock would look like after this exact order
// line, updating live as they adjust the quantity stepper.
const remainingAfterQty = computed(() => Math.max(availableQuantity.value - (quantity.value || 0), 0));

const verifyingAvailability = ref(false);
const availabilityError = ref<string | null>(null);

function clampQty(): void {
  if (!Number.isFinite(quantity.value) || quantity.value < 1) quantity.value = 1;
  if (quantity.value > availableQuantity.value) quantity.value = availableQuantity.value;
}

function adjustQty(delta: number): void {
  quantity.value = Math.min(Math.max(1, quantity.value + delta), Math.max(1, availableQuantity.value));
}

async function pickItem(item: Item, preferredUomCode?: string): Promise<void> {
  selectedItem.value = item;
  loadingDetail.value = true;
  quantity.value = 1;
  selectedLotIndex.value = 0;
  availabilityError.value = null;
  try {
    // Always a live hit, never the item catalog cache — this is the first
    // of the three points (item selection, adding to the order, submitting
    // the order) where lot availability is re-verified against BC, so a
    // second concurrent user's already-committed order is reflected here.
    const [lotsPage, uomList] = await Promise.all([
      ApiService.getItemLots(item.number, { limit: LOTS_FETCH_LIMIT, locationCode: sessionStore.currentSession?.customer?.locationCode }),
      ApiService.getItemUnitsOfMeasure(item.number),
    ]);
    lots.value = lotsPage.value;
    uomOptions.value = uomList;
    // A barcode scanned via the Item Reference table (5777) may be tied to a
    // specific non-base UOM (e.g. a case/box barcode) — honor that over the
    // item's base UOM default, but only if it's actually a valid UOM for
    // this item.
    const preferred = preferredUomCode && uomList.some((u) => u.code === preferredUomCode) ? preferredUomCode : undefined;
    unitOfMeasureCode.value = preferred || item.baseUnitOfMeasureCode || uomList[0]?.code || '';
  } catch {
    lots.value = [];
    uomOptions.value = [];
  } finally {
    loadingDetail.value = false;
  }
}

watch(availableQuantity, () => clampQty());

async function confirmAdd(): Promise<void> {
  if (!canAdd.value || !selectedItem.value) return;
  const item = selectedItem.value;
  const lot = selectedLot.value;
  availabilityError.value = null;

  // Live re-check right before committing to the order — another user of
  // this app could have added the same lot to their own order in the time
  // between selecting this item and tapping "Add to Order", so the number
  // shown on screen may already be stale. This, not the initial load in
  // pickItem, is what actually prevents two concurrent users from both
  // over-committing the same physical batch.
  if (lot?.lotNo) {
    verifyingAvailability.value = true;
    try {
      const freshPage = await ApiService.getItemLots(item.number, { limit: LOTS_FETCH_LIMIT, locationCode: sessionStore.currentSession?.customer?.locationCode });
      const freshLot = freshPage.value.find((l) => l.lotNo === lot.lotNo && l.locationCode === lot.locationCode);
      const freshQty = freshLot?.remainingQuantity ?? 0;
      if (quantity.value > freshQty) {
        lots.value = freshPage.value;
        const newIndex = freshPage.value.findIndex((l) => l.lotNo === lot.lotNo && l.locationCode === lot.locationCode);
        selectedLotIndex.value = newIndex >= 0 ? newIndex : 0;
        clampQty();
        availabilityError.value = freshQty > 0
          ? `Only ${freshQty} left for lot ${lot.lotNo} now — someone else may have just used some. Quantity adjusted — review and try again.`
          : `Lot ${lot.lotNo} is no longer available — someone else may have just used it on another order.`;
        return;
      }
    } catch {
      // Live check failed (network hiccup) — don't block on it; BC's own
      // FEFO-capped lot availability at submission is the final authority.
    } finally {
      verifyingAvailability.value = false;
    }
  }

  const selectedUom = uomOptions.value.find((u) => u.code === unitOfMeasureCode.value);
  // Uses the captured `lot`, not the (possibly reassigned) selectedLot/
  // effectiveExpirationDate computed chain — the live re-check above only
  // reassigns lots.value on the early-return failure path, but computing
  // directly from `lot` here avoids any dependency on that staying in sync.
  const expirationDate = settingsStore.includeShelfLife
    ? addShelfLifeMonths(lot?.expirationDate, customerShelfLifeMonths.value)
    : lot?.expirationDate;
  modalController.dismiss({
    item,
    quantity: quantity.value,
    unitOfMeasureCode: unitOfMeasureCode.value,
    expirationDate,
    lotNo: lot?.lotNo,
    locationCode: lot?.locationCode,
    availableQuantity: availableQuantity.value,
    qtyPerUnitOfMeasure: selectedUom?.qtyPerUnitOfMeasure ?? 1,
  }, 'added');
}

function handleClose(): void {
  if (selectedItem.value) {
    selectedItem.value = null;
    return;
  }
  stopCamera();
  modalController.dismiss();
}
</script>

<style scoped>
.pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px 20px;
}

.pager-label {
  color: var(--app-text-muted);
  font-size: var(--text-sm);
}

.state-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 48px 24px;
  color: var(--app-text-muted);
  text-align: center;
}

.state-block--error { color: var(--ion-color-danger); }
.state-icon { font-size: 36px; color: var(--app-border); }

.detail {
  padding: 12px 16px;
}

.detail-desc {
  color: var(--app-text-muted);
  margin: 0;
}

.detail-field {
  --background: transparent;
  margin-bottom: 8px;
}

.qty-stepper {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 6px;
}

.qty-input {
  --padding-start: 8px;
  --padding-end: 8px;
  text-align: center;
  max-width: 80px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-sm);
}

.detail-hint {
  font-size: var(--text-xs);
  color: var(--app-text-muted);
  margin: 6px 0 0;
}

.detail-hint--low {
  color: var(--app-low-stock-text);
  font-weight: 700;
}

.remaining-preview {
  opacity: 0.8;
}

.expiry-value {
  font-weight: 600;
  color: var(--app-fg);
  margin: 6px 0 0;
}

.shelf-life-note {
  font-size: var(--text-2xs);
  color: var(--app-text-muted);
  margin: 4px 0 0;
}

.item-price {
  color: var(--app-blue);
  font-weight: 600;
}

.detail-warning {
  color: var(--ion-color-danger);
  font-size: var(--text-sm);
  padding: 0 4px;
}

.add-btn {
  margin-top: 16px;
}

/* ── Scan toggle button — deliberately NOT a bare toolbar icon. Solid,
   high-contrast blue circle with a white glyph so scanning reads as a
   primary action at a glance, not a hidden option a user has to notice. ── */
.scan-toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  margin-inline-end: 4px;
  border: none;
  border-radius: 50%;
  background: var(--app-blue);
  color: #ffffff;
  font-size: 20px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(36, 97, 168, 0.35);
  transition: transform 0.15s var(--ease-out-quart), box-shadow 0.15s var(--ease-out-quart);
  -webkit-tap-highlight-color: transparent;
}

.scan-toggle-btn:active {
  transform: scale(0.94);
}

.scan-toggle-btn:disabled {
  background: var(--app-border);
  box-shadow: none;
  cursor: not-allowed;
}

/* ── Barcode miss banner ── */
.barcode-miss {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  color: var(--app-low-stock-text);
  background: rgba(196, 148, 43, 0.1);
  font-size: var(--text-sm);
}

.barcode-miss ion-icon {
  font-size: 18px;
  flex-shrink: 0;
}

/* ── Scanner ── */
.scanner-wrap {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #000;
}

.scanner-video {
  width: 100%;
  flex: 1;
  object-fit: cover;
  min-height: 260px;
}

.scanner-ui {
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

.scanner-frame {
  width: 280px;
  height: 160px;
  position: relative;
  overflow: hidden;
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

.scan-line {
  position: absolute;
  left: 0;
  right: 0;
  height: 2px;
  background: rgba(36, 97, 168, 0.85);
  animation: scan-sweep 1.8s ease-in-out infinite;
}

@keyframes scan-sweep {
  0%   { top: 0; }
  50%  { top: calc(100% - 2px); }
  100% { top: 0; }
}

.scan-hint {
  margin-top: 16px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.3px;
  pointer-events: none;
}
.scan-hint--scanning { color: rgba(255, 255, 255, 0.85); }
.scan-hint--starting { color: rgba(255, 255, 255, 0.6); }
.scan-hint--detected { color: var(--ion-color-success); }
.scan-hint--error    { color: var(--ion-color-danger); }
.scan-hint--multiple { color: var(--app-blue); }
.scan-hint--confirm  { color: var(--ion-color-success); }

/* ── Manual input ── */
.manual-wrap {
  background: #111;
  padding: 16px;
  flex-shrink: 0;
}
.manual-label {
  font-size: 12px;
  color: #888;
  margin: 0 0 8px;
}
.manual-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.manual-input {
  flex: 1;
  --background: #222;
  --color: #fff;
  --placeholder-color: #666;
  --border-radius: 8px;
  border: 1px solid #333;
  border-radius: 8px;
}

/* ── Multi-barcode picker ── */
.multi-picker {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10;
  background: rgba(10, 10, 10, 0.96);
  border-top: 1px solid #2a2a2a;
  padding: 16px 16px 8px;
  max-height: 62%;
  overflow-y: auto;
  pointer-events: all;
}

.multi-picker-title {
  font-size: 14px;
  font-weight: 700;
  color: #fff;
  margin: 0 0 2px;
}

.multi-picker-sub {
  font-size: 11px;
  color: #666;
  margin: 0 0 12px;
}

.multi-bc-btn {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 11px 14px;
  margin-bottom: 8px;
  background: #1a1a1a;
  border: 1px solid #2e2e2e;
  border-radius: 10px;
  cursor: pointer;
  gap: 12px;
  text-align: left;
  -webkit-tap-highlight-color: transparent;
}

.multi-bc-btn:active {
  background: #252525;
}

.multi-bc-btn--priority {
  border-color: var(--app-blue);
  background: rgba(36, 97, 168, 0.12);
}

.multi-bc-format {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  color: #555;
  flex-shrink: 0;
  min-width: 64px;
}

.multi-bc-btn--priority .multi-bc-format {
  color: var(--app-blue);
}

.multi-bc-value {
  font-size: 15px;
  font-weight: 600;
  color: #fff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  text-align: right;
  font-family: monospace;
}

.rescan-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 10px;
  margin-top: 2px;
  background: transparent;
  border: 1px solid #333;
  border-radius: 8px;
  color: #777;
  font-size: 13px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

/* ── Single barcode confirm panel ── */
.single-confirm {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10;
  background: rgba(10, 10, 10, 0.96);
  border-top: 1px solid #1e3a2a;
  padding: 16px 16px 8px;
  pointer-events: all;
}

.single-confirm-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.single-confirm-icon {
  font-size: 20px;
  color: var(--ion-color-success);
}

.single-confirm-title {
  font-size: 14px;
  font-weight: 700;
  color: #fff;
  margin: 0;
}

.single-confirm-value {
  font-size: 20px;
  font-weight: 800;
  color: #fff;
  font-family: monospace;
  letter-spacing: 2px;
  text-align: center;
  padding: 14px 12px;
  margin: 0 0 14px;
  background: #111;
  border: 1px solid #1e3a2a;
  border-radius: 10px;
  word-break: break-all;
}

.single-confirm-btn {
  margin-bottom: 8px;
}
</style>
