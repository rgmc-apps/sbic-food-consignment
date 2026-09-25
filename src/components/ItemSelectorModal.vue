<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ selectedItem ? 'Add Item' : 'Select Item' }}</ion-title>
        <ion-buttons slot="start">
          <ion-button @click="handleClose">
            <ion-icon :icon="selectedItem ? chevronBackOutline : closeOutline" slot="icon-only" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
      <ion-toolbar v-if="!selectedItem">
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
      <template v-if="!selectedItem">
        <div v-if="loadingItems" class="state-block">
          <ion-spinner name="crescent" />
          <p>Searching items…</p>
        </div>
        <div v-else-if="itemsError" class="state-block state-block--error">
          <p>{{ itemsError }}</p>
          <ion-button size="small" fill="outline" @click="fetchItems">Retry</ion-button>
        </div>
        <div v-else-if="!items.length" class="state-block">
          <ion-icon :icon="searchOutline" class="state-icon" />
          <p>{{ searchTerm ? 'No items match your search.' : 'Start typing to search items.' }}</p>
        </div>
        <template v-else>
          <ion-list lines="full">
            <ion-item v-for="it in items" :key="it.id" button @click="pickItem(it)">
              <ion-label>
                <h2>{{ it.description || it.number }}</h2>
                <p>#{{ it.number }} · {{ it.description || '—' }}</p>
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
        </template>
      </template>

      <!-- ── Item detail / add mode ── -->
      <div v-else class="detail">
        <ion-card>
          <ion-card-header>
            <ion-card-subtitle>Item Number</ion-card-subtitle>
            <ion-card-title>{{ selectedItem.number }}</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <p class="detail-desc">{{ selectedItem.description || '—' }}</p>
          </ion-card-content>
        </ion-card>

        <div v-if="loadingDetail" class="state-block">
          <ion-spinner name="crescent" />
          <p>Loading availability…</p>
        </div>
        <template v-else>
          <ion-item lines="none" class="detail-field">
            <ion-label position="stacked">Quantity</ion-label>
            <div class="qty-stepper">
              <ion-button fill="outline" size="small" @click="adjustQty(-1)" :disabled="quantity <= 1">
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
              <ion-button fill="outline" size="small" @click="adjustQty(1)" :disabled="quantity >= availableQuantity">
                <ion-icon :icon="addOutline" slot="icon-only" />
              </ion-button>
            </div>
            <p class="detail-hint">
              {{ availableQuantity }} available{{ oldestLot?.lotNo ? ` (lot ${oldestLot.lotNo})` : '' }}
            </p>
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
            <p class="expiry-value">{{ formatDate(oldestLot?.expirationDate) }}</p>
          </ion-item>

          <p v-if="availableQuantity === 0" class="detail-warning">
            No available stock found for this item in Business Central.
          </p>

          <ion-button
            expand="block"
            class="add-btn"
            :disabled="!canAdd"
            @click="confirmAdd"
          >
            Add to Order
          </ion-button>
        </template>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon, IonSearchbar,
  IonContent, IonList, IonItem, IonLabel, IonSpinner, IonCard, IonCardHeader, IonCardSubtitle,
  IonCardTitle, IonCardContent, IonInput, IonSelect, IonSelectOption, modalController,
} from '@ionic/vue';
import {
  closeOutline, chevronBackOutline, chevronForwardOutline, searchOutline, removeOutline, addOutline,
} from 'ionicons/icons';
import { ApiService } from '@/services/api.service';
import { formatDate } from '@/utils/format';
import type { Item, ItemLot, ItemUnitOfMeasure } from '@/types';

const PAGE_SIZE = 25;
// Lots per item are a small, bounded set in practice (a handful of open batches),
// so one generously-sized page is enough to compute total availability without
// needing a dedicated aggregate endpoint.
const LOTS_FETCH_LIMIT = 100;

const emit = defineEmits<{
  added: [{
    item: Item;
    quantity: number;
    unitOfMeasureCode: string;
    expirationDate?: string;
    lotNo?: string;
    availableQuantity: number;
  }];
}>();

// ── Search / list state ──
const searchTerm = ref('');
const items = ref<Item[]>([]);
const loadingItems = ref(false);
const itemsError = ref<string | null>(null);
const offset = ref(0);
const total = ref(0);

const hasNextPage = computed(() => offset.value + PAGE_SIZE < total.value);
const pagerLabel = computed(() => {
  if (!total.value) return '0 items';
  const from = offset.value + 1;
  const to = Math.min(offset.value + items.value.length, total.value);
  return `${from}–${to} of ${total.value}`;
});

let searchToken = 0;
async function fetchItems(): Promise<void> {
  loadingItems.value = true;
  itemsError.value = null;
  const token = ++searchToken;
  try {
    const page = await ApiService.getItems({ search: searchTerm.value.trim(), limit: PAGE_SIZE, offset: offset.value });
    if (token !== searchToken) return; // a newer search superseded this one
    items.value = page.value;
    total.value = page.total;
  } catch (err) {
    if (token !== searchToken) return;
    itemsError.value = err instanceof Error ? err.message : 'Could not load items.';
  } finally {
    if (token === searchToken) loadingItems.value = false;
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

// ── Detail / add mode state ──
const selectedItem = ref<Item | null>(null);
const loadingDetail = ref(false);
const lots = ref<ItemLot[]>([]);
const uomOptions = ref<ItemUnitOfMeasure[]>([]);
const quantity = ref(1);
const unitOfMeasureCode = ref('');

const availableQuantity = computed(() => lots.value.reduce((sum, l) => sum + (l.remainingQuantity || 0), 0));
const oldestLot = computed(() => lots.value[0] ?? null);
const canAdd = computed(() =>
  !!selectedItem.value && !!unitOfMeasureCode.value && quantity.value >= 1 && quantity.value <= availableQuantity.value,
);

function clampQty(): void {
  if (!Number.isFinite(quantity.value) || quantity.value < 1) quantity.value = 1;
  if (quantity.value > availableQuantity.value) quantity.value = availableQuantity.value;
}

function adjustQty(delta: number): void {
  quantity.value = Math.min(Math.max(1, quantity.value + delta), Math.max(1, availableQuantity.value));
}

async function pickItem(item: Item): Promise<void> {
  selectedItem.value = item;
  loadingDetail.value = true;
  quantity.value = 1;
  try {
    const [lotsPage, uomList] = await Promise.all([
      ApiService.getItemLots(item.number, { limit: LOTS_FETCH_LIMIT }),
      ApiService.getItemUnitsOfMeasure(item.number),
    ]);
    lots.value = lotsPage.value;
    uomOptions.value = uomList;
    unitOfMeasureCode.value = item.baseUnitOfMeasureCode || uomList[0]?.code || '';
  } catch {
    lots.value = [];
    uomOptions.value = [];
  } finally {
    loadingDetail.value = false;
  }
}

watch(availableQuantity, () => clampQty());

function confirmAdd(): void {
  if (!canAdd.value || !selectedItem.value) return;
  emit('added', {
    item: selectedItem.value,
    quantity: quantity.value,
    unitOfMeasureCode: unitOfMeasureCode.value,
    expirationDate: oldestLot.value?.expirationDate,
    lotNo: oldestLot.value?.lotNo,
    availableQuantity: availableQuantity.value,
  });
  modalController.dismiss();
}

function handleClose(): void {
  if (selectedItem.value) {
    selectedItem.value = null;
    return;
  }
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

.expiry-value {
  font-weight: 600;
  color: var(--app-fg);
  margin: 6px 0 0;
}

.detail-warning {
  color: var(--ion-color-danger);
  font-size: var(--text-sm);
  padding: 0 4px;
}

.add-btn {
  margin-top: 16px;
}
</style>
