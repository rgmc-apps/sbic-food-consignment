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
          <ion-input
            v-model="orderNumberInput"
            placeholder="Enter the online order number"
            @ion-input="sessionStore.setOrderNumber(orderNumberInput)"
          />
        </ion-item>

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
                    aria-label="Edit expiration date"
                    @click.stop="openExpiryEditor($event, line)"
                  >
                    <ion-icon :icon="createOutline" />
                  </button>
                </p>
                <p v-if="line.lotNo" class="line-detail-row">
                  <span class="line-detail-label">Lot No.</span>
                  <span>{{ line.lotNo }}</span>
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
        <div v-if="result.trackingWarnings?.length" class="tracking-warning">
          <p class="tracking-warning-title">Lot tracking not recorded</p>
          <p v-for="(w, i) in result.trackingWarnings" :key="i">{{ w }}</p>
        </div>
        <ion-button expand="block" @click="finishAndGoHome">Done</ion-button>
      </div>
      </Transition>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonContent, IonCard,
  IonCardHeader, IonCardSubtitle, IonCardTitle, IonCardContent, IonItem, IonLabel, IonInput,
  IonList, IonButton, IonSpinner, IonIcon, popoverController,
} from '@ionic/vue';
import { checkmarkCircleOutline, createOutline, bugOutline } from 'ionicons/icons';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';
import { useSessionStore } from '@/stores/session.store';
import { useSettingsStore } from '@/stores/settings.store';
import { useErrorReporter } from '@/composables/useErrorReporter';
import { ApiService, ApiError } from '@/services/api.service';
import { formatDate, formatCurrency, isExpiringSoon } from '@/utils/format';
import { generateId } from '@/utils/id';
import DatePickerPopover from '@/components/DatePickerPopover.vue';
import type { FoodSalesOrderResult, OrderHistoryLine, OrderLine } from '@/types';

const router = useRouter();
const authStore = useAuthStore();
const sessionStore = useSessionStore();
const settingsStore = useSettingsStore();
const { openReport } = useErrorReporter();
const session = computed(() => sessionStore.currentSession);

const orderNumberInput = ref(session.value?.orderNumber ?? '');
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

const canSubmit = computed(() =>
  !!session.value?.customer && !!session.value.lines.length && !!orderNumberInput.value.trim(),
);

async function openExpiryEditor(ev: Event, line: OrderLine): Promise<void> {
  const popover = await popoverController.create({
    component: DatePickerPopover,
    componentProps: { modelValue: line.expirationDate },
    event: ev,
    side: 'bottom',
    alignment: 'start',
    cssClass: 'date-picker-popover',
  });
  await popover.present();
  const { data, role } = await popover.onDidDismiss<string>();
  if (role === 'picked' && data) {
    sessionStore.updateLineExpirationDate(line.id, data);
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

async function handleSubmit(): Promise<void> {
  if (!session.value?.customer || !canSubmit.value) return;
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
