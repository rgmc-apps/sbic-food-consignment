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

    <ion-content :fullscreen="true">
      <div v-if="!session" class="state-block">
        <p>No active session.</p>
        <ion-button router-link="/app/home" fill="outline">Go Home</ion-button>
      </div>

      <template v-else-if="!result">
        <ion-card>
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

        <p v-if="submitError" class="submit-error">{{ submitError }}</p>

        <div class="ion-padding">
          <ion-button expand="block" :disabled="!canSubmit || submitting" @click="handleSubmit">
            <ion-spinner v-if="submitting" name="dots" />
            <span v-else>Submit to Business Central</span>
          </ion-button>
          <ion-button expand="block" fill="clear" :disabled="submitting" @click="saveDraftAndExit">
            Save as Draft &amp; Go Back
          </ion-button>
        </div>
      </template>

      <!-- ── Confirmation ── -->
      <div v-else class="confirmation">
        <ion-icon :icon="checkmarkCircleOutline" class="confirm-icon" />
        <h2>Order Submitted</h2>
        <p class="confirm-doc">Business Central Document No.</p>
        <p class="confirm-doc-no">{{ result.documentNumber }}</p>
        <p class="confirm-order-no">Order No.: {{ result.externalDocumentNo }}</p>
        <ion-button expand="block" @click="finishAndGoHome">Done</ion-button>
      </div>
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
import { useSessionStore } from '@/stores/session.store';
import { ApiService, ApiError } from '@/services/api.service';
import { formatDate, isExpiringSoon } from '@/utils/format';
import type { FoodSalesOrderResult } from '@/types';

const router = useRouter();
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
  try {
    const res = await ApiService.submitSalesOrder({
      customerNumber: session.value.customer.number,
      postingDate: session.value.postingDate,
      orderNumber: orderNumberInput.value.trim(),
      lines: session.value.lines.map((l) => ({
        itemNumber: l.itemNumber,
        description: l.description,
        quantity: l.quantity,
        unitOfMeasureCode: l.unitOfMeasureCode,
      })),
    });
    result.value = res;
    sessionStore.markSubmitted(res.documentNumber);
  } catch (err) {
    // Nothing was posted — the draft stays intact in localStorage for retry.
    submitError.value = err instanceof ApiError ? err.message : 'Submission failed. Please try again.';
    sessionStore.markFailed(submitError.value);
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
}

.confirm-order-no {
  color: var(--app-text-muted);
  margin: 4px 0 24px;
}
</style>
