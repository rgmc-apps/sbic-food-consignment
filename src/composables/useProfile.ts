import { modalController, popoverController, alertController } from '@ionic/vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';
import ProfileModal from '@/components/ProfileModal.vue';
import ProfilePopover from '@/components/ProfilePopover.vue';

/** Shared account actions — used by the mobile per-page header buttons, the
 *  unified desktop nav bar (TabsPage.vue), and ProfilePopover itself, so
 *  every entry point opens the same things the same way. */
export function useProfile() {
  const router = useRouter();
  const authStore = useAuthStore();

  async function openProfileModal(): Promise<void> {
    const modal = await modalController.create({ component: ProfileModal });
    await modal.present();
  }

  /** The "quick" entry point every profile button in the app triggers now —
   *  a small popover (who's signed in + View Profile + Sign Out) instead of
   *  jumping straight into the full edit modal, so signing out never
   *  requires scrolling through an edit form to find the button. */
  async function openProfileMenu(ev: Event): Promise<void> {
    const popover = await popoverController.create({
      component: ProfilePopover,
      event: ev,
      side: 'bottom',
      alignment: 'end',
    });
    await popover.present();
  }

  /** `dismissCaller` closes whichever overlay (modal or popover) this was
   *  triggered from — only on confirm, never on cancel, so a cancelled sign
   *  out leaves the caller exactly as it was. */
  async function signOut(dismissCaller?: () => unknown): Promise<void> {
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
            if (dismissCaller) await dismissCaller();
            router.replace('/login');
          },
        },
      ],
    });
    await alert.present();
  }

  return { openProfileModal, openProfileMenu, signOut };
}
