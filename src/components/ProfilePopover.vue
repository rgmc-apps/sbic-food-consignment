<template>
  <div class="profile-popover">
    <div class="popover-identity">
      <div class="avatar-circle">
        <img v-if="authStore.user?.pictureUrl" :src="authStore.user.pictureUrl" alt="" class="avatar-img" />
        <span v-else>{{ initials }}</span>
      </div>
      <div class="popover-identity-text">
        <p class="popover-name">{{ authStore.user?.displayName ?? 'Signed in' }}</p>
        <p class="popover-sub">{{ authStore.user?.email || authStore.user?.username || '—' }}</p>
      </div>
    </div>

    <div class="divider" />

    <button type="button" class="popover-item" @click="handleViewProfile">
      <ion-icon :icon="personOutline" />
      <span>View Profile</span>
    </button>

    <button type="button" class="popover-item" @click="handleOpenConfig">
      <ion-icon :icon="settingsOutline" />
      <span>Configuration</span>
    </button>

    <button type="button" class="popover-item" @click="handleReportIssue">
      <ion-icon :icon="bugOutline" />
      <span>Report to IT/MIS</span>
    </button>

    <button type="button" class="popover-item popover-item--danger" @click="handleSignOut">
      <ion-icon :icon="logOutOutline" />
      <span>Sign Out</span>
    </button>

    <div class="divider" />

    <p class="popover-build">Build {{ buildLabel }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { IonIcon, popoverController } from '@ionic/vue';
import { useRouter } from 'vue-router';
import { personOutline, logOutOutline, settingsOutline, bugOutline } from 'ionicons/icons';
import { useAuthStore } from '@/stores/auth.store';
import { useProfile } from '@/composables/useProfile';
import { useErrorReporter } from '@/composables/useErrorReporter';
import { getInitials } from '@/utils/initials';

const router = useRouter();
const authStore = useAuthStore();
const { openProfileModal, signOut } = useProfile();
const { openReport } = useErrorReporter();

const initials = computed(() => getInitials(authStore.user?.displayName));
// Global const injected at build time by vite.config.ts (see env.d.ts) — the
// same mechanism rgmc-consignment-webapp already uses for this.
const buildLabel = __APP_BUILD__;

async function handleViewProfile(): Promise<void> {
  await popoverController.dismiss();
  await openProfileModal();
}

async function handleOpenConfig(): Promise<void> {
  await popoverController.dismiss();
  router.push('/app/settings');
}

function handleSignOut(): void {
  signOut(() => popoverController.dismiss());
}

async function handleReportIssue(): Promise<void> {
  await popoverController.dismiss();
  openReport({ context: 'Manual bug report from ' + window.location.pathname });
}
</script>

<style scoped>
.profile-popover {
  min-width: 240px;
  padding: 16px 4px 8px;
}

.popover-identity {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px 12px;
}

.avatar-circle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--app-blue-pale);
  color: var(--app-blue);
  font-size: var(--text-md);
  font-weight: 700;
  flex-shrink: 0;
  overflow: hidden;
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.popover-identity-text {
  min-width: 0;
}

.popover-name {
  font-size: var(--text-base);
  font-weight: 700;
  color: var(--app-fg);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.popover-sub {
  font-size: var(--text-xs);
  color: var(--app-text-muted);
  margin: 2px 0 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.divider {
  height: 1px;
  background: var(--app-border);
  margin: 4px 0;
}

.popover-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 16px;
  border: none;
  background: transparent;
  color: var(--app-fg);
  font-size: var(--text-sm);
  font-weight: 600;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s var(--ease-out-quart);
}

.popover-item:hover {
  background: var(--app-surface-alt);
}

.popover-item ion-icon {
  font-size: 18px;
  color: var(--app-text-muted);
  flex-shrink: 0;
}

.popover-item--danger {
  color: var(--ion-color-danger);
}

.popover-item--danger ion-icon {
  color: var(--ion-color-danger);
}

.popover-build {
  font-size: var(--text-2xs);
  color: var(--app-text-muted);
  text-align: center;
  margin: 4px 0 0;
}
</style>
