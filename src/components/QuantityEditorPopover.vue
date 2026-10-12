<template>
  <div class="qep">
    <p class="qep-title">Edit Quantity</p>
    <div class="qty-stepper">
      <ion-button color="primary" fill="outline" size="small" @click="adjustQty(-1)" :disabled="quantity <= 1">
        <ion-icon :icon="removeOutline" slot="icon-only" />
      </ion-button>
      <ion-input
        v-model.number="quantity"
        type="number"
        class="qty-input"
        min="1"
        :max="maxQuantity || undefined"
        @ion-blur="clampQty"
      />
      <ion-button color="primary" fill="outline" size="small" @click="adjustQty(1)" :disabled="quantity >= maxQuantity">
        <ion-icon :icon="addOutline" slot="icon-only" />
      </ion-button>
    </div>

    <p v-if="loading" class="qep-hint">
      <ion-spinner name="dots" /> Checking live availability…
    </p>
    <p v-else class="qep-hint" :class="{ 'qep-hint--low': maxQuantity < 1 }">
      {{ maxQuantity }} available{{ lotNo ? ` (lot ${lotNo})` : '' }}
    </p>
    <p v-if="!loading && maxQuantity < 1" class="qep-warning">
      No stock remains for this lot — remove this line instead.
    </p>

    <ion-button expand="block" class="qep-save" :disabled="!canSave" @click="save">Save</ion-button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { IonButton, IonIcon, IonInput, IonSpinner, popoverController } from '@ionic/vue';
import { removeOutline, addOutline } from 'ionicons/icons';
import { ApiService } from '@/services/api.service';

// Data goes back to the caller via popoverController.dismiss(data, role) — see
// the equivalent comment in ItemSelectorModal.vue for why emit() cannot work here.

const props = defineProps<{
  modelValue: number;
  itemNumber: string;
  lotNo?: string;
  locationCode?: string;
  /** The quantity captured when this line was added — used as the cap only
   *  if the live re-check below fails (network hiccup), never as the primary
   *  source of truth. */
  fallbackAvailable: number;
}>();

const quantity = ref(props.modelValue);
const loading = ref(true);
const maxQuantity = ref(props.fallbackAvailable);

// Re-verify against BC the moment the editor opens — the same live-first
// rule as everywhere else in this app (PRODUCT.md: quantity is never
// trusted from an earlier fetch). Falls back to the quantity captured at
// add-time only if this live call itself fails.
onMounted(async () => {
  try {
    const page = await ApiService.getItemLots(props.itemNumber, { limit: 100, locationCode: props.locationCode });
    const fresh = props.lotNo
      ? page.value.find((l) => l.lotNo === props.lotNo && l.locationCode === props.locationCode)
      : undefined;
    if (fresh) maxQuantity.value = fresh.remainingQuantity;
  } catch {
    // live check failed — keep the fallback cap, consistent with the other
    // live-recheck points in this app (ItemSelectorModal, SubmitPage).
  } finally {
    loading.value = false;
    clampQty();
  }
});

function clampQty(): void {
  if (!Number.isFinite(quantity.value) || quantity.value < 1) quantity.value = 1;
  if (quantity.value > maxQuantity.value) quantity.value = Math.max(0, maxQuantity.value);
}

function adjustQty(delta: number): void {
  quantity.value = Math.min(Math.max(1, quantity.value + delta), Math.max(1, maxQuantity.value));
}

const canSave = computed(() =>
  Number.isFinite(quantity.value) && quantity.value >= 1 && quantity.value <= maxQuantity.value,
);

function save(): void {
  if (!canSave.value) return;
  popoverController.dismiss(quantity.value, 'saved');
}
</script>

<style scoped>
.qep {
  width: 100%;
  max-width: calc(100vw - 32px);
  padding: 16px;
  box-sizing: border-box;
}

.qep-title {
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--app-fg);
  margin: 0 0 10px;
}

.qty-stepper {
  display: flex;
  align-items: center;
  gap: 10px;
}

.qty-input {
  --padding-start: 8px;
  --padding-end: 8px;
  text-align: center;
  max-width: 80px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-sm);
}

.qep-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--text-xs);
  color: var(--app-text-muted);
  margin: 8px 0 0;
}

.qep-hint--low {
  color: var(--app-low-stock-text);
  font-weight: 700;
}

.qep-warning {
  color: var(--ion-color-danger);
  font-size: var(--text-xs);
  margin: 4px 0 0;
}

.qep-save {
  margin-top: 14px;
}
</style>
