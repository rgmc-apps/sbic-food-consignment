<template>
  <ion-page>
    <ion-tabs>
      <ion-router-outlet />
      <ion-tab-bar slot="bottom">
        <ion-tab-button tab="home" href="/app/home">
          <ion-icon :icon="homeOutline" />
          <ion-label>Home</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="scan" href="/app/scan">
          <ion-icon :icon="scanOutline" />
          <ion-label>Scan</ion-label>
          <ion-badge v-if="sessionStore.hasLines" color="primary">
            {{ sessionStore.lines.length }}
          </ion-badge>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  </ion-page>
</template>

<script setup lang="ts">
import { IonPage, IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, IonBadge, IonRouterOutlet } from '@ionic/vue';
import { homeOutline, scanOutline } from 'ionicons/icons';
import { useSessionStore } from '@/stores/session.store';

const sessionStore = useSessionStore();
</script>
