<template>
  <ion-page>
    <ion-content :fullscreen="true" class="login-content">
      <div class="login-body">
        <img src="/logo-main.png" alt="SBIC Consignment - Food And Beverages" class="login-logo" />
        <h1 class="login-title">SBIC Consignment</h1>
        <p class="login-sub">Food And Beverages</p>

        <form class="login-form" @submit.prevent="handleLogin">
          <ion-item class="login-field" lines="none">
            <ion-label position="stacked">Company</ion-label>
            <ion-select
              v-model="selectedCompanyId"
              placeholder="Select company"
              interface="action-sheet"
              :disabled="loadingCompanies"
            >
              <ion-select-option v-for="c in companies" :key="c.id" :value="c.id">
                {{ c.displayName || c.code }}
              </ion-select-option>
            </ion-select>
          </ion-item>
          <p v-if="loadingCompanies" class="login-hint"><ion-spinner name="dots" /> Loading companies…</p>
          <p v-else-if="companiesError" class="login-hint login-hint--error">
            {{ companiesError }}
            <ion-button size="small" fill="clear" @click="loadCompanies">Retry</ion-button>
          </p>
          <p v-else-if="!companies.length" class="login-hint">No food-consignment companies are configured yet.</p>

          <ion-item class="login-field" lines="none">
            <ion-label position="stacked">Username</ion-label>
            <ion-input v-model="username" type="text" autocapitalize="off" autocomplete="username" />
          </ion-item>

          <ion-item class="login-field" lines="none">
            <ion-label position="stacked">Password</ion-label>
            <ion-input
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="current-password"
            >
              <ion-button slot="end" fill="clear" size="small" @click="showPassword = !showPassword">
                <ion-icon :icon="showPassword ? eyeOffOutline : eyeOutline" />
              </ion-button>
            </ion-input>
          </ion-item>

          <p v-if="authStore.error" class="login-error">{{ authStore.error }}</p>

          <ion-button
            expand="block"
            type="submit"
            class="login-submit"
            :disabled="!canSubmit || authStore.isLoading"
          >
            <ion-spinner v-if="authStore.isLoading" name="dots" />
            <span v-else>Sign In</span>
          </ion-button>
        </form>

        <p class="login-footer">SBIC — Online Merch Team © {{ year }}</p>
      </div>
    </ion-content>

    <ion-modal :is-open="authStore.forcePasswordSetup" @did-dismiss="authStore.clearPasswordSetup">
      <ion-header>
        <ion-toolbar>
          <ion-title>Set Your Password</ion-title>
        </ion-toolbar>
      </ion-header>
      <ion-content class="ion-padding">
        <p>This is your first sign-in (or your password needs to be reset). Choose a new password to continue.</p>
        <ion-item lines="none">
          <ion-label position="stacked">New Password</ion-label>
          <ion-input v-model="newPassword" type="password" />
        </ion-item>
        <ion-item lines="none">
          <ion-label position="stacked">Confirm Password</ion-label>
          <ion-input v-model="confirmPassword" type="password" />
        </ion-item>
        <p v-if="setupError" class="login-error">{{ setupError }}</p>
        <ion-button expand="block" :disabled="settingPassword" @click="handleSetPassword">
          <ion-spinner v-if="settingPassword" name="dots" />
          <span v-else>Save Password</span>
        </ion-button>
      </ion-content>
    </ion-modal>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import {
  IonPage, IonContent, IonItem, IonLabel, IonInput, IonSelect, IonSelectOption,
  IonButton, IonIcon, IonSpinner, IonModal, IonHeader, IonToolbar, IonTitle,
} from '@ionic/vue';
import { eyeOutline, eyeOffOutline } from 'ionicons/icons';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';
import { ApiService } from '@/services/api.service';
import type { Company } from '@/types';

const router = useRouter();
const authStore = useAuthStore();
const year = new Date().getFullYear();

const companies = ref<Company[]>([]);
const loadingCompanies = ref(false);
const companiesError = ref<string | null>(null);
const selectedCompanyId = ref<string | null>(null);
const username = ref('');
const password = ref('');
const showPassword = ref(false);

const canSubmit = computed(() => !!selectedCompanyId.value && !!username.value.trim() && !!password.value);

async function loadCompanies(): Promise<void> {
  loadingCompanies.value = true;
  companiesError.value = null;
  try {
    companies.value = await ApiService.getCompanies();
    if (companies.value.length === 1) selectedCompanyId.value = companies.value[0].id;
  } catch (err) {
    companiesError.value = err instanceof Error ? err.message : 'Could not load companies.';
  } finally {
    loadingCompanies.value = false;
  }
}

onMounted(loadCompanies);

async function handleLogin(): Promise<void> {
  if (!canSubmit.value) return;
  const company = companies.value.find((c) => c.id === selectedCompanyId.value);
  if (!company) return;
  authStore.clearError();
  const ok = await authStore.login(company, username.value, password.value);
  if (ok) {
    // No sync function — go straight to Home.
    router.replace('/app/home');
  }
}

const newPassword = ref('');
const confirmPassword = ref('');
const settingPassword = ref(false);
const setupError = ref<string | null>(null);

async function handleSetPassword(): Promise<void> {
  setupError.value = null;
  if (newPassword.value.length < 6) {
    setupError.value = 'Password must be at least 6 characters.';
    return;
  }
  if (newPassword.value !== confirmPassword.value) {
    setupError.value = 'Passwords do not match.';
    return;
  }
  settingPassword.value = true;
  try {
    await authStore.completePasswordSetup(newPassword.value);
    newPassword.value = '';
    confirmPassword.value = '';
    password.value = '';
  } finally {
    settingPassword.value = false;
  }
}
</script>

<style scoped>
.login-content {
  --background: var(--app-dark);
}

.login-body {
  max-width: 380px;
  margin: 0 auto;
  padding: 56px 24px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.login-logo {
  width: 96px;
  height: 96px;
  object-fit: contain;
  margin-bottom: 8px;
}

.login-title {
  color: #ffffff;
  font-size: var(--text-xl);
  font-weight: 700;
  margin: 0;
}

.login-sub {
  color: var(--app-gold-light);
  font-size: var(--text-sm);
  letter-spacing: var(--tracking-wide);
  text-transform: uppercase;
  margin: 0 0 28px;
}

.login-form {
  width: 100%;
}

.login-field {
  --background: var(--app-login-field-bg);
  --color: #ffffff;
  border-radius: var(--app-radius);
  margin-bottom: 12px;
}

.login-hint {
  color: rgba(255, 255, 255, 0.6);
  font-size: var(--text-sm);
  display: flex;
  align-items: center;
  gap: 6px;
  margin: -4px 0 12px 4px;
}

.login-hint--error {
  color: var(--ion-color-danger);
}

.login-error {
  color: var(--ion-color-danger);
  font-size: var(--text-sm);
  margin: 4px 0 12px;
}

.login-submit {
  margin-top: 8px;
}

.login-footer {
  margin-top: 32px;
  color: rgba(255, 255, 255, 0.4);
  font-size: var(--text-xs);
}
</style>
