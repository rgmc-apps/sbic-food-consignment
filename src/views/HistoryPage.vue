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
          <ion-accordion-group class="history-list">
            <ion-accordion v-for="rec in records" :key="rec.id" :value="rec.id">
              <ion-item slot="header" lines="full">
                <div class="status-badge" :class="rec.status === 'success' ? 'status-badge--success' : 'status-badge--failed'" slot="start">
                  <ion-icon :icon="rec.status === 'success' ? checkmarkCircleOutline : closeCircleOutline" />
                </div>
                <ion-label>
                  <h2>{{ rec.customerDisplayName ?? 'Unknown customer' }}</h2>
                  <p>
                    Order {{ rec.orderNumber || '—' }} · {{ formatDate(rec.createdAt) }}
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
} from 'ionicons/icons';
import { useAuthStore } from '@/stores/auth.store';
import { ApiService, ApiError } from '@/services/api.service';
import { useErrorReporter } from '@/composables/useErrorReporter';
import { formatDate, isExpiringSoon } from '@/utils/format';
import type { OrderHistoryRecord } from '@/types';

const PAGE_SIZE = 25;

const authStore = useAuthStore();
const { openReport } = useErrorReporter();

const records = ref<OrderHistoryRecord[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const offset = ref(0);
const total = ref(0);

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

.history-list {
  margin: 12px;
  border-radius: var(--app-radius);
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
