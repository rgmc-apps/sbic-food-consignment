<template>
  <ion-app>
    <ion-router-outlet />
  </ion-app>
</template>

<script setup lang="ts">
import { watch } from 'vue';
import { IonApp, IonRouterOutlet, toastController } from '@ionic/vue';
import { useNetworkStatus } from '@/composables/useNetworkStatus';

const { isOnline } = useNetworkStatus();

// This app does no offline catalog work — going offline just means "the next
// network call will fail". The only thing that survives an outage is whatever
// is already in the active draft (autosaved to localStorage as it's edited).
let prevOnline = isOnline.value;
watch(isOnline, async (online) => {
  if (prevOnline && !online) {
    const toast = await toastController.create({
      message: "You're offline. Your current session is saved on this device — submitting requires a connection.",
      duration: 4500,
      position: 'top',
      cssClass: 'offline-toast',
      color: 'dark',
    });
    await toast.present();
  } else if (!prevOnline && online) {
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
