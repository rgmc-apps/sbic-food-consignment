<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/app/home" text="" />
        </ion-buttons>
        <ion-title>Configuration</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true" class="wide-content">
      <div class="config-layout animate-in">
        <p class="section-label">Order Entry</p>
        <ion-list class="config-list" lines="full">
          <ion-item lines="full">
            <ion-label class="config-label">
              <h2>Include Item Shelf Life</h2>
              <p>
                Extends a picked lot's expiration date by the selected customer's
                Prod Shelf Life (months) on the Scan screen — the customer's own
                required freshness window, added on top of the lot's real BC
                expiry.
              </p>
            </ion-label>
            <ion-toggle
              slot="end"
              :checked="settingsStore.includeShelfLife"
              @ion-change="onToggleShelfLife"
            />
          </ion-item>

          <ion-item lines="full">
            <ion-label class="config-label">
              <h2>Display Item Prices</h2>
              <p>
                Shows each item's unit price on the item selector list and on
                the order summary before submitting.
              </p>
            </ion-label>
            <ion-toggle
              slot="end"
              :checked="settingsStore.showItemPrices"
              @ion-change="onTogglePrices"
            />
          </ion-item>
        </ion-list>

        <p class="config-hint">
          These are per-device display preferences — they change what you see in
          the app, never what gets submitted to Business Central.
        </p>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonContent,
  IonList, IonItem, IonLabel, IonToggle,
} from '@ionic/vue';
import { useSettingsStore } from '@/stores/settings.store';

const settingsStore = useSettingsStore();

function onToggleShelfLife(ev: CustomEvent<{ checked: boolean }>): void {
  settingsStore.setIncludeShelfLife(ev.detail.checked);
}

function onTogglePrices(ev: CustomEvent<{ checked: boolean }>): void {
  settingsStore.setShowItemPrices(ev.detail.checked);
}
</script>

<style scoped>
.config-layout {
  max-width: 640px;
  margin: 0 auto;
  padding-bottom: 24px;
}

.config-list {
  border-radius: var(--app-radius);
  overflow: hidden;
  margin: 0 12px;
}

.config-label h2 {
  font-size: var(--text-base);
  font-weight: 700;
  color: var(--app-fg);
  margin: 0 0 4px;
}

.config-label p {
  font-size: var(--text-xs);
  color: var(--app-text-muted);
  line-height: 1.4;
  margin: 0;
  padding-inline-end: 12px;
}

.config-hint {
  font-size: var(--text-2xs);
  color: var(--app-text-muted);
  padding: 12px 24px 0;
  text-align: center;
}
</style>
