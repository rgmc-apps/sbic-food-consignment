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
                <p>#{{ line.itemNumber }} · {{ line.quantity }} {{ line.unitOfMeasureCode }}</p>
                <p v-if="line.expirationDate">
                  Expiry: {{ formatDate(line.expirationDate) }}
                  <span v-if="isExpiringSoon(line.expirationDate)" class="expiry-badge">Expiring soon</span>
                </p>
              </ion-label>
            </ion-item>
          </ion-list>
        </div>

        <p v-if="submitError" class="submit-error">{{ submitError }}</p>

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
  IonList, IonButton, IonSpinner, IonIcon,
} from '@ionic/vue';
import { checkmarkCircleOutline } from 'ionicons/icons';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';
import { useSessionStore } from '@/stores/session.store';
import { ApiService, ApiError } from '@/services/api.service';
import { formatDate, isExpiringSoon } from '@/utils/format';
import { generateId } from '@/utils/id';
import type { FoodSalesOrderResult, OrderHistoryLine } from '@/types';

const router = useRouter();
const authStore = useAuthStore();
const sessionStore = useSessionStore();
const session = computed(() => sessionStore.currentSession);

const orderNumberInput = ref(session.value?.orderNumber ?? '');
const submitting = ref(false);
const submitError = ref<string | null>(null);
const result = ref<FoodSalesOrderResult | null>(null);

const canSubmit = computed(() =>
  !!session.value?.customer && !!session.value.lines.length && !!orderNumberInput.value.trim(),
);

async function handleSubmit(): Promise<void> {
  if (!session.value?.customer || !canSubmit.value) return;
  submitting.value = true;
  submitError.value = null;

  const customer = session.value.customer;
  const postingDate = session.value.postingDate;
  const orderNumber = orderNumberInput.value.trim();
  const submitLines = session.value.lines.map((l) => ({
    itemNumber: l.itemNumber,
    description: l.description,
    quantity: l.quantity,
    unitOfMeasureCode: l.unitOfMeasureCode,
  }));
  const historyLines: OrderHistoryLine[] = submitLines;

  try {
    const res = await ApiService.submitSalesOrder({
      customerNumber: customer.number,
      postingDate,
      orderNumber,
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

@keyframes confirm-icon-in {
  from { opacity: 0; transform: scale(0.75); }
  to   { opacity: 1; transform: scale(1);    }
}
</style>
