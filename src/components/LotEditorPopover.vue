<template>
  <div class="lep">
    <p class="lep-title">Select Lot / Expiry</p>

    <div v-if="loading" class="lep-state">
      <ion-spinner name="dots" /> Checking live lots…
    </div>
    <div v-else-if="!lots.length" class="lep-state lep-state--error">
      No open lots found for this item at this location.
    </div>
    <div v-else class="lep-list">
      <button
        v-for="(lot, i) in lots"
        :key="lot.lotNo ?? i"
        type="button"
        class="lep-row"
        :class="{ 'lep-row--selected': isSelected(lot) }"
        @click="pick(lot)"
      >
        <span class="lep-row-main">
          <span class="lep-row-date">{{ formatDate(effectiveDate(lot)) }}</span>
          <span v-if="lot.lotNo" class="lep-row-lot">lot {{ lot.lotNo }}</span>
        </span>
        <span class="lep-row-qty" :class="{ 'lep-row-qty--low': lot.remainingQuantity <= LOW_STOCK_THRESHOLD }">
          {{ lot.remainingQuantity }} avail.
        </span>
      </button>
    </div>

    <p v-if="shelfLifeApplied" class="lep-note">
      Dates shown include the customer's {{ customerShelfLifeMonths }} mo. shelf life extension.
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { IonSpinner, popoverController } from '@ionic/vue';
import { ApiService } from '@/services/api.service';
import { useSessionStore } from '@/stores/session.store';
import { useSettingsStore } from '@/stores/settings.store';
import { formatDate, addShelfLifeMonths } from '@/utils/format';
import type { ItemLot } from '@/types';

// Data goes back to the caller via popoverController.dismiss(data, role) — see
// the equivalent comment in ItemSelectorModal.vue for why emit() cannot work here.

const props = defineProps<{
  itemNumber: string;
  locationCode?: string;
  currentLotNo?: string;
}>();

const sessionStore = useSessionStore();
const settingsStore = useSettingsStore();

const LOTS_FETCH_LIMIT = 100;
const LOW_STOCK_THRESHOLD = 10;

const lots = ref<ItemLot[]>([]);
const loading = ref(true);

// Same "Include Item Shelf Life" extension ItemSelectorModal applies when a
// line is first created — kept consistent here so switching lots later
// doesn't silently fall back to the lot's raw BC expiry.
const customerShelfLifeMonths = computed(() => sessionStore.currentSession?.customer?.prodShelfLife ?? 0);
const shelfLifeApplied = computed(() => settingsStore.includeShelfLife && customerShelfLifeMonths.value > 0);

function effectiveDate(lot: ItemLot): string | undefined {
  return shelfLifeApplied.value ? addShelfLifeMonths(lot.expirationDate, customerShelfLifeMonths.value) : lot.expirationDate;
}

function isSelected(lot: ItemLot): boolean {
  return !!props.currentLotNo && lot.lotNo === props.currentLotNo && lot.locationCode === props.locationCode;
}

// Always a live hit against BC, never a cache — same live-first rule as the
// rest of this app's lot lookups (ItemSelectorModal, QuantityEditorPopover).
onMounted(async () => {
  try {
    const page = await ApiService.getItemLots(props.itemNumber, { limit: LOTS_FETCH_LIMIT, locationCode: props.locationCode });
    lots.value = page.value;
  } catch {
    lots.value = [];
  } finally {
    loading.value = false;
  }
});

function pick(lot: ItemLot): void {
  popoverController.dismiss({
    lotNo: lot.lotNo,
    locationCode: lot.locationCode,
    expirationDate: effectiveDate(lot),
    availableQuantity: lot.remainingQuantity,
  }, 'picked');
}
</script>

<style scoped>
.lep {
  width: 300px;
  max-width: calc(100vw - 32px);
  padding: 16px;
  box-sizing: border-box;
}

.lep-title {
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--app-fg);
  margin: 0 0 10px;
}

.lep-state {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--text-xs);
  color: var(--app-text-muted);
  padding: 8px 0;
}

.lep-state--error {
  color: var(--ion-color-danger);
}

.lep-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 280px;
  overflow-y: auto;
}

.lep-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-sm);
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: background-color 0.15s var(--ease-out-quart), border-color 0.15s var(--ease-out-quart);
  -webkit-tap-highlight-color: transparent;
}

.lep-row:active {
  background: var(--app-blue-pale);
}

.lep-row--selected {
  border-color: var(--app-blue);
  background: var(--app-blue-pale);
}

.lep-row-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.lep-row-date {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--app-fg);
}

.lep-row-lot {
  font-size: var(--text-2xs);
  color: var(--app-text-muted);
}

.lep-row-qty {
  font-size: var(--text-xs);
  color: var(--app-text-muted);
  white-space: nowrap;
}

.lep-row-qty--low {
  color: var(--app-low-stock-text);
  font-weight: 700;
}

.lep-note {
  font-size: var(--text-2xs);
  color: var(--app-text-muted);
  margin: 10px 0 0;
}
</style>
