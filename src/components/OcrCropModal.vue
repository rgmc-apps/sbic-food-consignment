<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Select Order Number</ion-title>
        <ion-buttons slot="start">
          <ion-button @click="cancel">
            <ion-icon :icon="closeOutline" slot="icon-only" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="crop-content" :scroll-y="false">
      <p class="crop-hint">
        {{ hasBox ? 'Drag the box or its corners, then tap "Use This Area".' : 'Tap and drag over the order number to select it.' }}
      </p>
      <div class="crop-stage" @pointerdown="onStagePointerDown">
        <img ref="imgEl" :src="imageSrc" class="crop-image" />
        <div v-if="hasBox" class="crop-box" :style="boxStyle" @pointerdown.stop="startDrag($event, 'move')">
          <div class="crop-handle crop-handle--tl" @pointerdown.stop="startDrag($event, 'tl')" />
          <div class="crop-handle crop-handle--tr" @pointerdown.stop="startDrag($event, 'tr')" />
          <div class="crop-handle crop-handle--bl" @pointerdown.stop="startDrag($event, 'bl')" />
          <div class="crop-handle crop-handle--br" @pointerdown.stop="startDrag($event, 'br')" />
        </div>
      </div>
    </ion-content>

    <ion-footer>
      <ion-toolbar>
        <ion-button expand="block" :disabled="!hasBox" @click="confirm">Use This Area</ion-button>
      </ion-toolbar>
    </ion-footer>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onUnmounted } from 'vue';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon,
  IonContent, IonFooter, modalController,
} from '@ionic/vue';
import { closeOutline } from 'ionicons/icons';
import { CROP_PAD_RATIO } from '@/utils/ocrCrop';

// Data goes back to the caller via modalController.dismiss(data, role) +
// the caller's `await modal.onDidDismiss()` — same convention as every
// other modal in this app (see ItemSelectorModal/CustomerSelectorModal).
defineProps<{ imageSrc: string }>();

const imgEl = ref<HTMLImageElement | null>(null);
const hasBox = ref(false);

// Selection box, in on-screen CSS pixels relative to the rendered <img>'s
// own top-left corner — converted to the image's natural (full-resolution)
// pixels only once, at crop time.
const box = reactive({ x: 0, y: 0, w: 0, h: 0 });

const boxStyle = computed(() => ({
  left: `${box.x}px`,
  top: `${box.y}px`,
  width: `${box.w}px`,
  height: `${box.h}px`,
}));

// No auto-placed default box — a box computed from the image's layout
// right after the photo loads could land using stale/mid-transition
// dimensions (the modal is still animating in, or layout hasn't settled
// yet) and end up positioned outside the visible image entirely. Letting
// the user draw the box themselves, live against whatever they're actually
// touching, makes that class of bug impossible: the coordinates are always
// read at the moment of interaction, never guessed ahead of it.
type DragMode = 'draw' | 'move' | 'tl' | 'tr' | 'bl' | 'br';
const MIN_SIZE = 24;
let dragMode: DragMode | null = null;
let dragStartPointer = { x: 0, y: 0 };
let dragStartBox = { x: 0, y: 0, w: 0, h: 0 };

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), Math.max(min, max));
}

// Starting a drag directly on the stage (not on the existing box or a
// handle, both of which stop this from firing) begins drawing a brand-new
// box from scratch, replacing any box already there.
function onStagePointerDown(ev: PointerEvent): void {
  if (!imgEl.value) return;
  const rect = imgEl.value.getBoundingClientRect();
  const x = clamp(ev.clientX - rect.left, 0, rect.width);
  const y = clamp(ev.clientY - rect.top, 0, rect.height);
  box.x = x;
  box.y = y;
  box.w = 0;
  box.h = 0;
  hasBox.value = true;
  startDrag(ev, 'draw');
}

function startDrag(ev: PointerEvent, mode: DragMode): void {
  dragMode = mode;
  dragStartPointer = { x: ev.clientX, y: ev.clientY };
  dragStartBox = { ...box };
  window.addEventListener('pointermove', onDrag);
  window.addEventListener('pointerup', endDrag, { once: true });
}

function onDrag(ev: PointerEvent): void {
  if (!dragMode || !imgEl.value) return;
  const rect = imgEl.value.getBoundingClientRect();
  const dx = ev.clientX - dragStartPointer.x;
  const dy = ev.clientY - dragStartPointer.y;

  if (dragMode === 'move') {
    box.x = clamp(dragStartBox.x + dx, 0, rect.width - box.w);
    box.y = clamp(dragStartBox.y + dy, 0, rect.height - box.h);
    return;
  }

  if (dragMode === 'draw') {
    // Rubber-band select: the box spans from the fixed start corner to
    // wherever the pointer is now, in any direction, clamped to the image.
    const curX = clamp(ev.clientX - rect.left, 0, rect.width);
    const curY = clamp(ev.clientY - rect.top, 0, rect.height);
    box.x = Math.min(dragStartBox.x, curX);
    box.y = Math.min(dragStartBox.y, curY);
    box.w = Math.abs(curX - dragStartBox.x);
    box.h = Math.abs(curY - dragStartBox.y);
    return;
  }

  let { x, y, w, h } = dragStartBox;
  if (dragMode.includes('l')) { x = dragStartBox.x + dx; w = dragStartBox.w - dx; }
  if (dragMode.includes('r')) { w = dragStartBox.w + dx; }
  if (dragMode.includes('t')) { y = dragStartBox.y + dy; h = dragStartBox.h - dy; }
  if (dragMode.includes('b')) { h = dragStartBox.h + dy; }

  if (w < MIN_SIZE) { if (dragMode.includes('l')) x = dragStartBox.x + dragStartBox.w - MIN_SIZE; w = MIN_SIZE; }
  if (h < MIN_SIZE) { if (dragMode.includes('t')) y = dragStartBox.y + dragStartBox.h - MIN_SIZE; h = MIN_SIZE; }

  box.x = clamp(x, 0, rect.width - w);
  box.y = clamp(y, 0, rect.height - h);
  box.w = Math.min(w, rect.width - box.x);
  box.h = Math.min(h, rect.height - box.y);
}

function endDrag(): void {
  // A tap (or a drag too small to be deliberate) draws nothing — require an
  // actual deliberate selection before "Use This Area" lights up.
  if (dragMode === 'draw' && (box.w < MIN_SIZE || box.h < MIN_SIZE)) {
    hasBox.value = false;
  }
  dragMode = null;
  window.removeEventListener('pointermove', onDrag);
}

onUnmounted(() => {
  window.removeEventListener('pointermove', onDrag);
});

function cancel(): void {
  modalController.dismiss(null, 'cancel');
}

function confirm(): void {
  const img = imgEl.value!;
  const rect = img.getBoundingClientRect();
  const scaleX = img.naturalWidth / rect.width;
  const scaleY = img.naturalHeight / rect.height;

  // A pixel-tight crop can clip the very strokes at its own edge, which
  // reads to the OCR detector as "nothing here" and truncates or drops
  // characters right at the border — padding the selection a bit past
  // exactly what was drawn gives the detector breathing room around the
  // text instead. SubmitPage.vue uses this same ratio (see its import of
  // CROP_PAD_RATIO) to know which margin of the final crop is just padding,
  // so it can exclude anything the detector finds only in that margin.
  const padX = box.w * CROP_PAD_RATIO;
  const padY = box.h * CROP_PAD_RATIO;
  const x0 = clamp(box.x - padX, 0, rect.width);
  const y0 = clamp(box.y - padY, 0, rect.height);
  const x1 = clamp(box.x + box.w + padX, 0, rect.width);
  const y1 = clamp(box.y + box.h + padY, 0, rect.height);

  const sx = x0 * scaleX;
  const sy = y0 * scaleY;
  const sw = (x1 - x0) * scaleX;
  const sh = (y1 - y0) * scaleY;

  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  canvas.getContext('2d')!.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

  canvas.toBlob((blob) => {
    modalController.dismiss(blob, blob ? 'confirm' : 'cancel');
  }, 'image/png');
}
</script>

<style scoped>
.crop-content {
  --background: #000;
}

.crop-hint {
  margin: 0;
  padding: 10px 16px;
  color: #ddd;
  font-size: 13px;
  text-align: center;
}

.crop-stage {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: calc(100% - 40px);
  touch-action: none;
}

.crop-image {
  max-width: 100%;
  max-height: 100%;
  -webkit-user-select: none;
  user-select: none;
  pointer-events: none;
}

.crop-box {
  position: absolute;
  border: 2px solid var(--app-blue);
  background: rgba(36, 97, 168, 0.15);
  box-shadow: 0 0 0 2000px rgba(0, 0, 0, 0.55);
  cursor: move;
  touch-action: none;
}

.crop-handle {
  position: absolute;
  width: 22px;
  height: 22px;
  margin: -11px;
  border-radius: 50%;
  background: var(--app-blue);
  border: 2px solid #fff;
  touch-action: none;
}

.crop-handle--tl { top: 0; left: 0; cursor: nwse-resize; }
.crop-handle--tr { top: 0; right: 0; left: auto; margin-right: -11px; margin-left: 0; cursor: nesw-resize; }
.crop-handle--bl { bottom: 0; left: 0; margin-bottom: -11px; margin-top: 0; cursor: nesw-resize; }
.crop-handle--br { bottom: 0; right: 0; left: auto; margin: -11px; cursor: nwse-resize; }
</style>
