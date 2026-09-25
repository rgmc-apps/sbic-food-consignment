<template>
  <ion-app>
    <ion-router-outlet />
  </ion-app>
</template>

<script setup lang="ts">
import { watch } from 'vue';
import { IonApp, IonRouterOutlet, toastController } from '@ionic/vue';
import { closeOutline } from 'ionicons/icons';
import { useNetworkStatus } from '@/composables/useNetworkStatus';
import { useSessionStore } from '@/stores/session.store';

const { isOnline } = useNetworkStatus();
const sessionStore = useSessionStore();

// This app does no offline catalog work — going offline just means "the next
// network call will fail". The only thing that survives an outage is whatever
// is already in the active draft. Every field change already autosaves it
// (see session.store.ts), but the instant connectivity actually drops is a
// natural moment to force one more save as a guarantee, not just a hope.
//
// The offline notice itself uses Ionic's own toastController with duration: 0
// (persists until dismissed) rather than a custom-positioned overlay — a
// hand-rolled fixed/absolute element fights ion-router-outlet's own
// position:absolute navigation architecture in ways that are easy to get
// wrong (confirmed: it broke page rendering entirely on the first attempt,
// then rendered behind the header on the second). Ionic's overlay stacking
// is already correct and battle-tested; this is the low-risk way to get a
// persistent "impossible to miss" notice.
let offlineToast: HTMLIonToastElement | null = null;
let prevOnline = isOnline.value;

watch(isOnline, async (online) => {
  if (prevOnline && !online) {
    sessionStore.autoSaveDraft();
    offlineToast = await toastController.create({
      message: "You're offline. Your session is saved on this device — reconnect to add items or submit.",
      duration: 0,
      position: 'top',
      cssClass: 'offline-toast',
      color: 'dark',
      buttons: [{ icon: closeOutline, role: 'cancel' }],
    });
    offlineToast.addEventListener('didDismiss', () => { offlineToast = null; }, { once: true });
    await offlineToast.present();
  } else if (!prevOnline && online) {
    if (offlineToast) {
      await offlineToast.dismiss();
      offlineToast = null;
    }
    const toast = await toastController.create({
      message: 'Back online — connection restored.',
      duration: 3000,
      position: 'top',
      color: 'success',
    });
    await toast.present();
  }
  prevOnline = online;
});
</script>
