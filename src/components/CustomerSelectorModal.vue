<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Select Customer</ion-title>
        <ion-buttons slot="start">
          <ion-button @click="modalController.dismiss()">
            <ion-icon :icon="closeOutline" slot="icon-only" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
      <ion-toolbar>
        <ion-searchbar
          v-model="searchTerm"
          placeholder="Search customers"
          :debounce="250"
          @ion-input="onSearchInput"
        />
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div v-if="loading" class="state-block">
        <ion-spinner name="crescent" />
        <p>Loading customers…</p>
      </div>
      <div v-else-if="error" class="state-block state-block--error">
        <p>{{ error }}</p>
        <ion-button size="small" fill="outline" @click="fetchCustomers">Retry</ion-button>
      </div>
      <div v-else-if="!customers.length" class="state-block">
        <p>No customers found.</p>
      </div>
      <template v-else>
        <ion-list lines="full">
          <ion-item v-for="c in customers" :key="c.id" button @click="pick(c)">
            <ion-label>
              <h2>{{ c.displayName }}</h2>
              <p>#{{ c.number }}{{ c.city ? ` · ${c.city}` : '' }}</p>
            </ion-label>
          </ion-item>
        </ion-list>
        <div class="pager">
          <ion-button fill="clear" size="small" :disabled="offset === 0" @click="goPrevPage">
            <ion-icon :icon="chevronBackOutline" slot="start" /> Prev
          </ion-button>
          <span class="pager-label">{{ pagerLabel }}</span>
          <ion-button fill="clear" size="small" :disabled="!hasNextPage" @click="goNextPage">
            Next <ion-icon :icon="chevronForwardOutline" slot="end" />
          </ion-button>
        </div>
      </template>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon, IonSearchbar,
  IonContent, IonList, IonItem, IonLabel, IonSpinner, modalController,
} from '@ionic/vue';
import { closeOutline, chevronBackOutline, chevronForwardOutline } from 'ionicons/icons';
import { ApiService } from '@/services/api.service';
import type { Customer } from '@/types';

const PAGE_SIZE = 25;

const emit = defineEmits<{ picked: [Customer] }>();

const searchTerm = ref('');
const customers = ref<Customer[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const offset = ref(0);
const total = ref(0);

const hasNextPage = computed(() => offset.value + PAGE_SIZE < total.value);
const pagerLabel = computed(() => {
  if (!total.value) return '0 customers';
  const from = offset.value + 1;
  const to = Math.min(offset.value + customers.value.length, total.value);
  return `${from}–${to} of ${total.value}`;
});

let token = 0;
async function fetchCustomers(): Promise<void> {
  loading.value = true;
  error.value = null;
  const t = ++token;
  try {
    const page = await ApiService.getCustomers({ search: searchTerm.value.trim(), limit: PAGE_SIZE, offset: offset.value });
    if (t !== token) return;
    customers.value = page.value;
    total.value = page.total;
  } catch (err) {
    if (t !== token) return;
    error.value = err instanceof Error ? err.message : 'Could not load customers.';
  } finally {
    if (t === token) loading.value = false;
  }
}

function onSearchInput(): void {
  offset.value = 0;
  fetchCustomers();
}

function goNextPage(): void {
  offset.value += PAGE_SIZE;
  fetchCustomers();
}

function goPrevPage(): void {
  offset.value = Math.max(0, offset.value - PAGE_SIZE);
  fetchCustomers();
}

fetchCustomers();

function pick(c: Customer): void {
  emit('picked', c);
  modalController.dismiss();
}
</script>

<style scoped>
.pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px 20px;
}

.pager-label {
  color: var(--app-text-muted);
  font-size: var(--text-sm);
}

.state-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 48px 24px;
  color: var(--app-text-muted);
  text-align: center;
}

.state-block--error { color: var(--ion-color-danger); }
</style>
