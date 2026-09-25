<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Profile</ion-title>
        <ion-buttons slot="start">
          <ion-button @click="modalController.dismiss()">
            <ion-icon :icon="closeOutline" slot="icon-only" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <div class="profile-identity animate-in">
        <div class="avatar-circle">{{ initials }}</div>
        <h2 class="identity-name">{{ authStore.user?.displayName }}</h2>
        <p class="identity-number">#{{ authStore.user?.number ?? '—' }}</p>
      </div>

      <p class="section-label">Contact Information</p>
      <ion-item lines="none" class="profile-field">
        <ion-label position="stacked">Display Name</ion-label>
        <ion-input v-model="displayName" />
      </ion-item>
      <ion-item lines="none" class="profile-field">
        <ion-label position="stacked">Email</ion-label>
        <ion-input v-model="email" type="email" autocapitalize="off" />
      </ion-item>
      <ion-item lines="none" class="profile-field">
        <ion-label position="stacked">Phone Number</ion-label>
        <ion-input v-model="phoneNumber" type="tel" />
      </ion-item>
      <ion-item lines="none" class="profile-field">
        <ion-label position="stacked">Username</ion-label>
        <ion-input v-model="username" autocapitalize="off" />
      </ion-item>

      <Transition name="view-fade">
        <p v-if="profileError" class="form-error">{{ profileError }}</p>
        <p v-else-if="profileSaved" class="form-success">Profile updated.</p>
      </Transition>

      <ion-button
        expand="block"
        :disabled="savingProfile || !displayName.trim() || !username.trim()"
        @click="handleSaveProfile"
      >
        <ion-spinner v-if="savingProfile" name="dots" />
        <span v-else>Save Changes</span>
      </ion-button>

      <div class="divider" />

      <p class="section-label">Change Password</p>
      <ion-item lines="none" class="profile-field">
        <ion-label position="stacked">New Password</ion-label>
        <ion-input v-model="newPassword" type="password" autocomplete="new-password" />
      </ion-item>
      <ion-item lines="none" class="profile-field">
        <ion-label position="stacked">Confirm New Password</ion-label>
        <ion-input v-model="confirmPassword" type="password" autocomplete="new-password" />
      </ion-item>

      <Transition name="view-fade">
        <p v-if="passwordError" class="form-error">{{ passwordError }}</p>
        <p v-else-if="passwordSaved" class="form-success">Password updated.</p>
      </Transition>

      <ion-button
        expand="block"
        fill="outline"
        :disabled="changingPassword || !newPassword"
        @click="handleChangePassword"
      >
        <ion-spinner v-if="changingPassword" name="dots" />
        <span v-else>Update Password</span>
      </ion-button>

      <div class="divider" />

      <ion-button expand="block" fill="clear" color="danger" @click="handleSignOut">
        Sign Out
      </ion-button>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon, IonContent,
  IonItem, IonLabel, IonInput, IonSpinner, modalController, alertController,
} from '@ionic/vue';
import { closeOutline } from 'ionicons/icons';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';
import { ApiError } from '@/services/api.service';

const router = useRouter();
const authStore = useAuthStore();

const displayName = ref(authStore.user?.displayName ?? '');
const email = ref(authStore.user?.email ?? '');
const phoneNumber = ref(authStore.user?.phoneNumber ?? '');
const username = ref(authStore.user?.username ?? '');

const initials = computed(() => {
  const name = authStore.user?.displayName?.trim();
  if (!name) return '?';
  const parts = name.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
});

// ── Profile fields ──
const savingProfile = ref(false);
const profileError = ref<string | null>(null);
const profileSaved = ref(false);

async function handleSaveProfile(): Promise<void> {
  profileError.value = null;
  profileSaved.value = false;
  savingProfile.value = true;
  try {
    await authStore.updateProfile({
      displayName: displayName.value.trim(),
      email: email.value.trim(),
      phoneNumber: phoneNumber.value.trim(),
      username: username.value.trim(),
    });
    profileSaved.value = true;
  } catch (err) {
    profileError.value = err instanceof ApiError ? err.message : 'Could not save profile.';
  } finally {
    savingProfile.value = false;
  }
}

// ── Password — same bcrypt hashing used everywhere else in this app
// (see loadBcrypt/auth.store.ts changePassword). Never sent or stored plain. ──
const newPassword = ref('');
const confirmPassword = ref('');
const changingPassword = ref(false);
const passwordError = ref<string | null>(null);
const passwordSaved = ref(false);

async function handleChangePassword(): Promise<void> {
  passwordError.value = null;
  passwordSaved.value = false;
  if (newPassword.value.length < 6) {
    passwordError.value = 'Password must be at least 6 characters.';
    return;
  }
  if (newPassword.value !== confirmPassword.value) {
    passwordError.value = 'Passwords do not match.';
    return;
  }
  changingPassword.value = true;
  try {
    await authStore.changePassword(newPassword.value);
    passwordSaved.value = true;
    newPassword.value = '';
    confirmPassword.value = '';
  } catch (err) {
    passwordError.value = err instanceof ApiError ? err.message : 'Could not update password.';
  } finally {
    changingPassword.value = false;
  }
}

async function handleSignOut(): Promise<void> {
  const alert = await alertController.create({
    header: 'Sign Out',
    message: 'Are you sure you want to sign out?',
    buttons: [
      { text: 'Cancel', role: 'cancel' },
      {
        text: 'Sign Out',
        role: 'destructive',
        handler: async () => {
          authStore.logout();
          await modalController.dismiss();
          router.replace('/login');
        },
      },
    ],
  });
  await alert.present();
}
</script>

<style scoped>
.profile-identity {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 8px 0 20px;
}

.avatar-circle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--app-blue-pale);
  color: var(--app-blue);
  font-size: var(--text-xl);
  font-weight: 700;
  margin-bottom: 10px;
}

.identity-name {
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--app-fg);
  margin: 0;
}

.identity-number {
  color: var(--app-text-muted);
  font-size: var(--text-sm);
  margin: 2px 0 0;
}

.section-label {
  padding: 0 0 8px;
}

.profile-field {
  --background: var(--app-surface);
  --border-color: var(--app-border);
  margin-bottom: 4px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-sm);
}

.form-error {
  color: var(--ion-color-danger);
  font-size: var(--text-sm);
  margin: 4px 0 12px;
}

.form-success {
  color: var(--ion-color-success);
  font-size: var(--text-sm);
  margin: 4px 0 12px;
}

.divider {
  height: 1px;
  background: var(--app-border);
  margin: 24px 0;
}
</style>
