<template>
  <ion-page>
    <ion-tabs>
      <ion-router-outlet />
      <!-- Same tabs, same routing — only the position and shape change per
           viewport. Mobile/tablet keeps the established bottom icon bar,
           each page still carrying its own header. Desktop gets ONE unified
           top bar — brand, tabs, and the profile action all live inside this
           single ion-tab-bar (confirmed safe: ion-tabs only ever looks for
           one ion-tab-bar element via querySelector, and ion-tab-bar's own
           shadow DOM is just a bare <slot> in a flex host — neither cares
           what else is in here) — instead of this tab strip stacked on top
           of each page's own separate title bar, which read as two
           disconnected bars. Each page hides its own <ion-header> at this
           breakpoint to match (see each view's <style>). -->
      <ion-tab-bar
        :slot="isDesktop ? 'top' : 'bottom'"
        :class="{ 'tab-bar-desktop': isDesktop }"
      >
        <div v-if="isDesktop" class="tab-bar-brand">
          <img src="/logo-main.png" alt="" class="tab-bar-logo" />
          <span class="tab-bar-title">SBIC Consignment</span>
        </div>

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

        <ion-button v-if="isDesktop" fill="clear" class="tab-bar-profile-btn" @click="openProfile">
          <ion-icon :icon="personCircleOutline" slot="icon-only" />
        </ion-button>
      </ion-tab-bar>
    </ion-tabs>
  </ion-page>
</template>

<script setup lang="ts">
import { IonPage, IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, IonBadge, IonRouterOutlet, IonButton } from '@ionic/vue';
import { homeOutline, scanOutline, timeOutline, personCircleOutline } from 'ionicons/icons';
import { useSessionStore } from '@/stores/session.store';
import { useViewport } from '@/composables/useViewport';
import { useProfileModal } from '@/composables/useProfileModal';

const sessionStore = useSessionStore();
const { isDesktop } = useViewport();
const { openProfile } = useProfileModal();
</script>

<style scoped>
.tab-bar-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-inline-end: 28px;
  flex-shrink: 0;
  pointer-events: none;
}

.tab-bar-logo {
  width: 30px;
  height: 30px;
  object-fit: contain;
}

.tab-bar-title {
  font-size: var(--text-md);
  font-weight: 700;
  color: #ffffff;
  letter-spacing: 0.2px;
  white-space: nowrap;
}

.tab-bar-profile-btn {
  --color: var(--app-gold-light);
  margin-inline-start: auto;
  margin-inline-end: 0;
}
</style>
