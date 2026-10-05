<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>History</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true" class="wide-content">
      <Transition name="view-fade" mode="out-in">
        <div v-if="loading" key="loading" class="skel-list">
          <div v-for="n in 5" :key="n" class="skel-row">
            <div class="skel-bone" />
            <div class="skel-bone" />
          </div>
        </div>
        <div v-else-if="error" key="error" class="state-block state-block--error">
          <p>{{ error }}</p>
          <ion-button size="small" fill="outline" @click="fetchHistory">Retry</ion-button>
        </div>
        <div v-else-if="!records.length" key="empty" class="state-block">
          <div class="empty-icon-wrap">
            <ion-icon :icon="timeOutline" class="empty-icon" />
          </div>
          <p>No submitted orders yet. Your order history will appear here.</p>
        </div>

        <div v-else key="results" class="animate-in">
          <div v-for="month in groupedHistory" :key="month.key" class="month-group">
            <div class="month-header">{{ month.label }}</div>

            <div v-for="store in month.stores" :key="store.key" class="store-group">
              <button
                type="button"
                class="store-header"
                :class="{ 'store-header--open': isStoreOpen(month.key, store.key) }"
                :aria-expanded="isStoreOpen(month.key, store.key)"
                @click="toggleStore(month.key, store.key)"
              >
                <ion-icon
                  :icon="isStoreOpen(month.key, store.key) ? removeCircleOutline : addCircleOutline"
                  class="store-toggle-icon"
                />
                <span class="store-name">{{ store.label }}</span>
                <span class="store-meta">
                  {{ store.records.length }} order{{ store.records.length === 1 ? '' : 's' }}
                  <span v-if="store.failedCount" class="store-meta-failed">· {{ store.failedCount }} failed</span>
                </span>
              </button>

              <Transition name="store-collapse">
                <ion-accordion-group v-if="isStoreOpen(month.key, store.key)" class="history-list">
                  <ion-accordion v-for="rec in store.records" :key="rec.id" :value="rec.id">
                    <ion-item slot="header" lines="full">
                      <div class="status-badge" :class="rec.status === 'success' ? 'status-badge--success' : 'status-badge--failed'" slot="start">
                        <ion-icon :icon="rec.status === 'success' ? checkmarkCircleOutline : closeCircleOutline" />
                      </div>
                      <ion-label>
                        <h2>{{ formatShortDate(rec.createdAt) }}</h2>
                        <p>
                          Order {{ rec.orderNumber || '—' }}
                          <span v-if="rec.status === 'success' && rec.salesOrderNumber"> · SO {{ rec.salesOrderNumber }}</span>
                        </p>
                      </ion-label>
                    </ion-item>

                    <div slot="content" class="history-detail">
                      <p class="detail-row">Posting Date: {{ formatDate(rec.postingDate) }}</p>
                      <p v-if="rec.userDisplayName" class="detail-row">Submitted By: {{ rec.userDisplayName }}</p>
                      <template v-if="rec.status === 'failed' && rec.errorMessage">
                        <p class="detail-row detail-row--error">{{ rec.errorMessage }}</p>
                        <ion-button expand="block" fill="clear" color="danger" @click="reportHistoryError(rec)">
                          <ion-icon :icon="bugOutline" slot="start" />
                          Report to IT/MIS
                        </ion-button>
                      </template>
                      <p class="section-label">Order Lines</p>
                      <ion-list class="lines-list" lines="full">
                        <ion-item v-for="(line, i) in rec.lines" :key="i">
                          <ion-label>
                            <h3>{{ line.description || line.itemNumber }}</h3>
                            <p class="line-detail-row">
                              <span class="line-detail-label">Item No.</span>
                              <span>#{{ line.itemNumber }}</span>
                            </p>
                            <p class="line-detail-row">
                              <span class="line-detail-label">Quantity</span>
                              <span>{{ line.quantity }} {{ line.unitOfMeasureCode }}</span>
                            </p>
                            <p v-if="line.expirationDate" class="line-detail-row">
                              <span class="line-detail-label">Expiry Date</span>
                              <span>
                                {{ formatDate(line.expirationDate) }}
                                <span v-if="isExpiringSoon(line.expirationDate)" class="expiry-badge">Expiring soon</span>
                              </span>
                            </p>
                            <p v-if="line.lotNo" class="line-detail-row">
                              <span class="line-detail-label">Lot No.</span>
                              <span>{{ line.lotNo }}</span>
                            </p>
                          </ion-label>
                        </ion-item>
                      </ion-list>
                    </div>
                  </ion-accordion>
                </ion-accordion-group>
              </Transition>
            </div>
          </div>

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
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonIcon,
  IonAccordionGroup, IonAccordion, IonItem, IonLabel, IonList,
} from '@ionic/vue';
import {
  timeOutline, checkmarkCircleOutline, closeCircleOutline, chevronBackOutline, chevronForwardOutline, bugOutline,
  addCircleOutline, removeCircleOutline,
} from 'ionicons/icons';
import { useAuthStore } from '@/stores/auth.store';
import { ApiService, ApiError } from '@/services/api.service';
import { useErrorReporter } from '@/composables/useErrorReporter';
import { formatDate, formatShortDate, isExpiringSoon } from '@/utils/format';
import type { OrderHistoryRecord } from '@/types';

const PAGE_SIZE = 25;

const authStore = useAuthStore();
const { openReport } = useErrorReporter();

const records = ref<OrderHistoryRecord[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const offset = ref(0);
const total = ref(0);

interface StoreGroup {
  key: string;
  label: string;
  records: OrderHistoryRecord[];
  failedCount: number;
}
interface MonthGroup {
  key: string;
  label: string;
  stores: StoreGroup[];
}

// Groups the current page of records by month, then by store (customer) —
// relies on records already arriving sorted newest-first from the backend,
// so Map insertion order alone keeps months and stores in that same order
// without a separate sort pass.
const groupedHistory = computed<MonthGroup[]>(() => {
  const months = new Map<string, { label: string; stores: Map<string, StoreGroup> }>();
  for (const rec of records.value) {
    const created = rec.createdAt ? new Date(rec.createdAt) : null;
    const validDate = created && !Number.isNaN(created.getTime());
    const monthKey = validDate ? `${created!.getFullYear()}-${String(created!.getMonth() + 1).padStart(2, '0')}` : 'unknown';
    const monthLabel = validDate ? created!.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : 'Unknown date';

    if (!months.has(monthKey)) {
      months.set(monthKey, { label: monthLabel, stores: new Map() });
    }
    const month = months.get(monthKey)!;

    const storeKey = rec.customerNumber || rec.customerDisplayName || 'unknown';
    if (!month.stores.has(storeKey)) {
      month.stores.set(storeKey, { key: storeKey, label: rec.customerDisplayName || 'Unknown customer', records: [], failedCount: 0 });
    }
    const store = month.stores.get(storeKey)!;
    store.records.push(rec);
    if (rec.status === 'failed') store.failedCount += 1;
  }

  return Array.from(months.entries()).map(([key, { label, stores }]) => ({
    key,
    label,
    stores: Array.from(stores.values()),
  }));
});

// Store groups default collapsed; months themselves are plain section
// headers, not collapsible — only the store level has a +/- toggle.
const openStores = ref<Set<string>>(new Set());

function storeGroupId(monthKey: string, storeKey: string): string {
  return `${monthKey}::${storeKey}`;
}

function isStoreOpen(monthKey: string, storeKey: string): boolean {
  return openStores.value.has(storeGroupId(monthKey, storeKey));
}

function toggleStore(monthKey: string, storeKey: string): void {
  const id = storeGroupId(monthKey, storeKey);
  const next = new Set(openStores.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  openStores.value = next;
}

const hasNextPage = computed(() => offset.value + PAGE_SIZE < total.value);
const pagerLabel = computed(() => {
  if (!total.value) return '0 orders';
  const from = offset.value + 1;
  const to = Math.min(offset.value + records.value.length, total.value);
  return `${from}–${to} of ${total.value}`;
});

async function fetchHistory(): Promise<void> {
  const username = authStore.user?.username;
  if (!username) {
    error.value = 'No signed-in username to look up history for.';
    return;
  }
  loading.value = true;
  error.value = null;
  try {
    const page = await ApiService.getOrderHistory({ username, limit: PAGE_SIZE, offset: offset.value });
    records.value = page.value;
    total.value = page.total;
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Could not load order history.';
  } finally {
    loading.value = false;
  }
}

function goNextPage(): void {
  offset.value += PAGE_SIZE;
  fetchHistory();
}

function goPrevPage(): void {
  offset.value = Math.max(0, offset.value - PAGE_SIZE);
  fetchHistory();
}

function reportHistoryError(rec: OrderHistoryRecord): void {
  openReport({
    error: rec.errorMessage,
    context: `Failed order history entry: ${rec.orderNumber || rec.id}`,
  });
}

onMounted(fetchHistory);
</script>

<style scoped>
/* TabsPage's unified desktop bar already carries the brand + tabs — this
   page's own header would just be a redundant second bar underneath it. */
@media (min-width: 1024px) {
  ion-header {
    display: none;
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

.state-block--error {
  color: var(--ion-color-danger);
}

.empty-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--app-blue-pale);
  margin-bottom: 4px;
}

.empty-icon {
  font-size: 30px;
  color: var(--app-blue);
}

.month-group + .month-group {
  margin-top: 4px;
}

.month-header {
  position: sticky;
  top: 0;
  z-index: 2;
  padding: 14px 16px 8px;
  font-size: var(--text-sm);
  font-weight: 700;
  letter-spacing: var(--tracking-wider);
  text-transform: uppercase;
  color: var(--app-blue);
  background: var(--ion-background-color, #fff);
}

.store-group + .store-group {
  margin-top: 2px;
}

.store-header {
  display: flex;
  align-items: center;
  gap: 10px;
  width: calc(100% - 24px);
  margin: 0 12px;
  padding: 12px 14px;
  border: none;
  border-radius: var(--app-radius-sm);
  background: var(--app-surface-alt);
  color: inherit;
  font: inherit;
  text-align: start;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background-color 0.15s var(--ease-out-quart);
}

.store-header:active {
  background: var(--app-blue-pale);
}

.store-header--open {
  border-end-start-radius: 0;
  border-end-end-radius: 0;
}

.store-toggle-icon {
  flex-shrink: 0;
  font-size: 22px;
  color: var(--app-blue);
}

.store-name {
  flex: 1;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.store-meta {
  flex-shrink: 0;
  font-size: var(--text-xs);
  color: var(--app-text-muted);
}

.store-meta-failed {
  color: var(--ion-color-danger);
}

.store-collapse-enter-active,
.store-collapse-leave-active {
  transition: opacity 0.15s var(--ease-out-quart);
}

.store-collapse-enter-from,
.store-collapse-leave-to {
  opacity: 0;
}

.history-list {
  margin: 0 12px 12px;
  border-start-start-radius: 0;
  border-start-end-radius: 0;
  border-end-start-radius: var(--app-radius-sm);
  border-end-end-radius: var(--app-radius-sm);
  overflow: hidden;
}

.status-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  font-size: 18px;
  margin-inline-end: 12px;
}

.status-badge--success {
  background: rgba(45, 211, 111, 0.14);
  color: var(--ion-color-success);
}

.status-badge--failed {
  background: rgba(235, 68, 90, 0.12);
  color: var(--ion-color-danger);
}

.history-detail {
  padding: 4px 16px 16px;
  background: var(--app-surface-alt);
}

.detail-row {
  color: var(--app-text-muted);
  margin: 8px 0;
}

.detail-row--error {
  color: var(--ion-color-danger);
}

.lines-list {
  border-radius: var(--app-radius-sm);
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
</style>
