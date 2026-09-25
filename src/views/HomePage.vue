<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>SBIC Consignment</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="openProfile">
            <ion-icon :icon="personCircleOutline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content :fullscreen="true" class="wide-content">
      <!-- Mobile/tablet: natural single-column stack, unchanged. Desktop
           (≥1024px): the two divs below become a sticky left column (identity
           + primary action) next to a right column (drafts) — see <style>. -->
      <div class="home-layout animate-in">
        <div class="home-left">
          <div class="hero">
            <p class="hero-eyebrow">Welcome back</p>
            <h1 class="hero-name">{{ authStore.user?.displayName ?? 'there' }}</h1>
            <p class="hero-date">{{ todayLabel }}</p>
          </div>

          <div class="ion-padding-horizontal start-btn-wrap">
            <ion-button expand="block" size="large" @click="startNewSession">
              <ion-icon :icon="addCircleOutline" slot="start" />
              Start New Session
            </ion-button>
          </div>
        </div>

        <div class="home-right">
          <template v-if="sessionStore.hasDrafts">
            <p class="section-label">Open Drafts</p>
            <ion-list class="drafts-list" lines="full">
              <ion-item-sliding v-for="draft in sessionStore.drafts" :key="draft.id">
                <ion-item button @click="resumeDraft(draft)">
                  <div class="draft-badge" slot="start">
                    <ion-icon :icon="documentTextOutline" />
                  </div>
                  <ion-label>
                    <h2>{{ draft.customer?.displayName ?? 'No customer selected' }}</h2>
                    <p>
                      {{ draft.lines.length }} item(s) · updated {{ formatDate(draft.updatedAt) }}
                      <span v-if="draftHasExpiringSoon(draft)" class="expiry-badge">Expiring soon</span>
                    </p>
                  </ion-label>
                  <ion-icon :icon="chevronForwardOutline" slot="end" color="medium" />
                </ion-item>
                <ion-item-options side="end">
                  <ion-item-option color="danger" @click="deleteDraft(draft.id)">
                    <ion-icon :icon="trashOutline" slot="icon-only" />
                  </ion-item-option>
                </ion-item-options>
              </ion-item-sliding>
            </ion-list>
          </template>
          <div v-else class="empty-state">
            <div class="empty-icon-wrap">
              <ion-icon :icon="documentTextOutline" class="empty-icon" />
            </div>
            <p>No open drafts. Start a new session to record a sale.</p>
          </div>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon, IonContent,
  IonList, IonItem, IonItemSliding, IonItemOptions, IonItemOption, IonLabel, alertController,
  modalController,
} from '@ionic/vue';
import { addCircleOutline, chevronForwardOutline, trashOutline, documentTextOutline, personCircleOutline } from 'ionicons/icons';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';
import { useSessionStore } from '@/stores/session.store';
import { formatDate, isExpiringSoon } from '@/utils/format';
import ProfileModal from '@/components/ProfileModal.vue';
import type { ScanSession } from '@/types';

const router = useRouter();
const authStore = useAuthStore();
const sessionStore = useSessionStore();

const todayLabel = computed(() =>
  new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
);

function startNewSession(): void {
  if (!authStore.user) return;
  sessionStore.startNewSession(authStore.user, authStore.company?.code);
  router.push('/app/scan');
}

function resumeDraft(draft: ScanSession): void {
  sessionStore.resumeDraft(draft);
  router.push('/app/scan');
}

function draftHasExpiringSoon(draft: ScanSession): boolean {
  return draft.lines.some((l) => isExpiringSoon(l.expirationDate));
}

async function deleteDraft(id: string): Promise<void> {
  const alert = await alertController.create({
    header: 'Delete Draft',
    message: 'This draft will be removed from this device. This cannot be undone.',
    buttons: [
      { text: 'Cancel', role: 'cancel' },
      { text: 'Delete', role: 'destructive', handler: () => sessionStore.deleteDraft(id) },
    ],
  });
  await alert.present();
}

async function openProfile(): Promise<void> {
  const modal = await modalController.create({ component: ProfileModal });
  await modal.present();
}
</script>

<style scoped>
/* Desktop (≥1024px): identity + primary action become a sticky left column
   beside the drafts list, instead of a long stacked scroll. Mobile/tablet
   below this breakpoint is untouched — .home-layout stays a plain block. */
@media (min-width: 1024px) {
  .home-layout {
    display: grid;
    grid-template-columns: minmax(320px, 400px) 1fr;
    gap: 40px;
    padding: 32px 24px 0;
    align-items: start;
  }

  .home-left {
    position: sticky;
    top: 24px;
  }

  .hero {
    padding: 0 0 8px;
  }

  .start-btn-wrap {
    padding-left: 0;
    padding-right: 0;
  }

  .section-label {
    padding-left: 0;
    padding-right: 0;
  }

  .drafts-list {
    margin: 0;
  }

  .empty-state {
    align-items: flex-start;
    text-align: left;
    padding: 8px 0;
  }
}

.hero {
  padding: 24px 16px 8px;
}

.hero-eyebrow {
  color: var(--app-gold-dark);
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: var(--tracking-wider);
  text-transform: uppercase;
  margin: 0;
}

.hero-name {
  font-size: var(--text-hero);
  font-weight: 700;
  color: var(--app-fg);
  margin: 2px 0 4px;
}

.hero-date {
  color: var(--app-text-muted);
  font-size: var(--text-sm);
  margin: 0 0 8px;
}

.drafts-list {
  margin: 0 12px;
  border-radius: var(--app-radius);
  overflow: hidden;
}

.draft-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--app-blue-pale);
  color: var(--app-blue);
  font-size: 18px;
  margin-inline-end: 12px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 48px 24px;
  color: var(--app-text-muted);
  text-align: center;
}

.empty-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--app-blue-pale);
  margin-bottom: 4px;
}

.empty-icon {
  font-size: 30px;
  color: var(--app-blue);
}
</style>
