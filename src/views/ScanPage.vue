<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Scan</ion-title>
        <ion-buttons slot="start" v-if="session?.customer">
          <ion-button @click="saveDraftAndGoHome">
            <ion-icon :icon="homeOutline" slot="icon-only" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <div v-if="!session" class="state-block">
        <p>No active session. Start one from Home.</p>
        <ion-button router-link="/app/home" fill="outline">Go Home</ion-button>
      </div>

      <template v-else>
        <ion-list class="header-fields" lines="full">
          <ion-item button @click="openCustomerPicker">
            <div class="field-badge" slot="start">
              <ion-icon :icon="personOutline" />
            </div>
            <ion-label>
              <p class="field-label">Customer</p>
              <h2 :class="{ 'field-placeholder': !session.customer }">{{ session.customer?.displayName ?? 'Select customer' }}</h2>
            </ion-label>
            <ion-icon :icon="chevronForwardOutline" slot="end" color="medium" />
          </ion-item>

          <ion-item>
            <div class="field-badge" slot="start">
              <ion-icon :icon="calendarOutline" />
            </div>
            <ion-label position="stacked">Posting Date</ion-label>
            <ion-input type="date" :value="session.postingDate" @ion-change="onPostingDateChange" />
          </ion-item>
        </ion-list>

        <div class="ion-padding-horizontal add-item-row">
          <ion-button expand="block" :disabled="!session.customer" @click="openItemSelector">
            <ion-icon :icon="addCircleOutline" slot="start" />
            Add Item
          </ion-button>
          <p v-if="!session.customer" class="add-item-hint">Select a customer first.</p>
        </div>

        <p class="section-label">Order Lines</p>
        <div v-if="!sessionStore.lines.length" class="state-block">
          <ion-icon :icon="cubeOutline" class="state-icon" />
          <p>No items added yet.</p>
        </div>
        <ion-list v-else class="lines-list" lines="full">
          <ion-item-sliding v-for="line in sessionStore.lines" :key="line.id">
            <ion-item>
              <ion-label>
                <h2>{{ line.description || line.itemNumber }}</h2>
                <p>#{{ line.itemNumber }} · {{ line.quantity }} {{ line.unitOfMeasureCode }}</p>
                <p v-if="line.expirationDate">
                  Expiry: {{ formatDate(line.expirationDate) }}
                  <span v-if="isExpiringSoon(line.expirationDate)" class="expiry-badge">Expiring soon</span>
                </p>
              </ion-label>
            </ion-item>
            <ion-item-options side="end">
              <ion-item-option color="danger" @click="sessionStore.removeLine(line.id)">
                <ion-icon :icon="trashOutline" slot="icon-only" />
              </ion-item-option>
            </ion-item-options>
          </ion-item-sliding>
        </ion-list>

        <div class="spacer" />
      </template>
    </ion-content>

    <ion-footer v-if="session && sessionStore.hasLines">
      <ion-toolbar class="submit-bar">
        <div class="submit-bar-inner">
          <span><strong class="text-blue">{{ sessionStore.lines.length }}</strong> item(s) · <strong class="text-blue">{{ sessionStore.lineCount }}</strong> total qty</span>
          <ion-button @click="goToSubmit">
            Review &amp; Submit
            <ion-icon :icon="chevronForwardOutline" slot="end" />
          </ion-button>
        </div>
      </ion-toolbar>
    </ion-footer>
  </ion-page>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon, IonContent,
  IonList, IonItem, IonLabel, IonInput, IonItemSliding, IonItemOptions, IonItemOption,
  IonFooter, modalController,
} from '@ionic/vue';
import { addCircleOutline, chevronForwardOutline, trashOutline, cubeOutline, homeOutline, personOutline, calendarOutline } from 'ionicons/icons';
import { onBeforeRouteLeave, useRouter } from 'vue-router';
import { useSessionStore } from '@/stores/session.store';
import { formatDate, isExpiringSoon } from '@/utils/format';
import ItemSelectorModal from '@/components/ItemSelectorModal.vue';
import CustomerSelectorModal from '@/components/CustomerSelectorModal.vue';
import type { Customer, Item } from '@/types';

const router = useRouter();
const sessionStore = useSessionStore();
const session = computed(() => sessionStore.currentSession);

function onPostingDateChange(ev: CustomEvent): void {
  const value = (ev.detail as { value?: string }).value;
  if (value) sessionStore.setPostingDate(value.slice(0, 10));
}

// Ionic Vue forwards a modal component's `emit`s as native DOM CustomEvents
// on the ion-modal host element (same event name) — this is the documented
// pattern for reacting to component-in-overlay events with modalController.
async function openCustomerPicker(): Promise<void> {
  const modal = await modalController.create({ component: CustomerSelectorModal });
  modal.addEventListener('picked', ((e: CustomEvent<Customer>) => {
    sessionStore.setCustomer(e.detail);
  }) as EventListener);
  await modal.present();
}

async function openItemSelector(): Promise<void> {
  const modal = await modalController.create({ component: ItemSelectorModal });
  modal.addEventListener('added', ((e: CustomEvent<{
    item: Item; quantity: number; unitOfMeasureCode: string; expirationDate?: string; lotNo?: string; availableQuantity: number;
  }>) => {
    const d = e.detail;
    sessionStore.addLine({
      itemNumber: d.item.number,
      description: d.item.description || d.item.number,
      quantity: d.quantity,
      unitOfMeasureCode: d.unitOfMeasureCode,
      expirationDate: d.expirationDate,
      lotNo: d.lotNo,
      availableQuantity: d.availableQuantity,
    });
  }) as EventListener);
  await modal.present();
}

function goToSubmit(): void {
  router.push('/app/submit');
}

function saveDraftAndGoHome(): void {
  sessionStore.autoSaveDraft();
  router.push('/app/home');
}

onBeforeRouteLeave(() => {
  sessionStore.autoSaveDraft();
});
</script>

<style scoped>
.header-fields {
  margin-bottom: 4px;
}

.field-label {
  font-size: var(--text-xs);
  color: var(--app-text-muted);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
}

.field-placeholder {
  color: var(--app-text-muted);
  font-weight: 400;
}

.field-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--app-blue-pale);
  color: var(--app-blue);
  font-size: 16px;
  margin-inline-end: 12px;
}

.add-item-row {
  margin: 12px 0;
}

.add-item-hint {
  text-align: center;
  color: var(--app-text-muted);
  font-size: var(--text-xs);
  margin-top: 6px;
}

.state-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 40px 24px;
  color: var(--app-text-muted);
  text-align: center;
}

.state-icon {
  font-size: 32px;
  color: var(--app-border);
}

.lines-list {
  margin: 0 12px;
  border-radius: var(--app-radius);
  overflow: hidden;
}

.spacer {
  height: 24px;
}

.submit-bar {
  --background: var(--app-surface);
  --border-color: var(--app-border);
}

.submit-bar-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 4px 12px;
  font-size: var(--text-sm);
  color: var(--app-fg);
}
</style>
