<template>
  <ion-page class="splash">
    <ion-content :fullscreen="true" class="splash-content">
      <div class="splash-body">
        <img src="/logo-main.png" alt="SBIC Consignment - Food And Beverages" class="logo-img" />
        <h1 class="splash-title">SBIC Consignment</h1>
        <p class="splash-sub">Food And Beverages</p>
        <ion-spinner name="crescent" class="splash-spinner" />
      </div>
      <p class="splash-footer">SBIC © {{ year }}</p>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { IonPage, IonContent, IonSpinner } from '@ionic/vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';
import { prefetchInitialItems } from '@/services/item-prefetch.service';

const router = useRouter();
const authStore = useAuthStore();
const year = new Date().getFullYear();

onMounted(() => {
  // Splash is the only point where a returning user's company is already known
  // (restored from localStorage) before they've touched anything — the one safe
  // moment to warm up the item list ahead of the Add Items modal. Fire-and-forget:
  // this must never delay the redirect below.
  if (authStore.isAuthenticated) {
    prefetchInitialItems();
  }

  setTimeout(() => {
    router.replace(authStore.isAuthenticated ? '/app/home' : '/login');
  }, 500);
});
</script>

<style scoped>
.splash-content {
  --background: var(--app-dark);
}

.splash-body {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  text-align: center;
}

.logo-img {
  width: 120px;
  height: 120px;
  object-fit: contain;
  margin-bottom: 8px;
}

.splash-title {
  color: #ffffff;
  font-size: var(--text-xl);
  font-weight: 700;
  margin: 0;
}

.splash-sub {
  color: var(--app-gold-light);
  font-size: var(--text-sm);
  letter-spacing: var(--tracking-wide);
  text-transform: uppercase;
  margin: 0 0 18px;
}

.splash-spinner {
  color: var(--app-gold-light);
}

.splash-footer {
  position: absolute;
  bottom: 24px;
  left: 0;
  right: 0;
  text-align: center;
  color: rgba(255, 255, 255, 0.4);
  font-size: var(--text-xs);
}
</style>
