<template>
  <ion-page>
    <ion-tabs>
      <ion-router-outlet />
      <!-- Same tabs, same routing — only the position and shape change per
           viewport. Mobile/tablet keeps the established bottom icon bar;
           desktop gets a left-aligned top tab strip, the native pattern for
           mouse-and-keyboard navigation instead of a stretched bottom bar. -->
      <ion-tab-bar
        :slot="isDesktop ? 'top' : 'bottom'"
        :class="{ 'tab-bar-desktop': isDesktop }"
      >
        <ion-tab-button tab="home" href="/app/home" :layout="isDesktop ? 'icon-start' : 'icon-top'">
          <ion-icon :icon="homeOutline" />
          <ion-label>Home</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="scan" href="/app/scan" :layout="isDesktop ? 'icon-start' : 'icon-top'">
          <ion-icon :icon="scanOutline" />
          <ion-label>Scan</ion-label>
          <ion-badge v-if="sessionStore.hasLines" color="primary">
            {{ sessionStore.lines.length }}
          </ion-badge>
        </ion-tab-button>

        <ion-tab-button tab="history" href="/app/history" :layout="isDesktop ? 'icon-start' : 'icon-top'">
          <ion-icon :icon="timeOutline" />
          <ion-label>History</ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  </ion-page>
</template>

<script setup lang="ts">
import { IonPage, IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, IonBadge, IonRouterOutlet } from '@ionic/vue';
import { homeOutline, scanOutline, timeOutline } from 'ionicons/icons';
import { useSessionStore } from '@/stores/session.store';
import { useViewport } from '@/composables/useViewport';

const sessionStore = useSessionStore();
const { isDesktop } = useViewport();
</script>
