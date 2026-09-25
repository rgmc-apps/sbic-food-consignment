import { modalController } from '@ionic/vue';
import ProfileModal from '@/components/ProfileModal.vue';

/** Shared so both the mobile per-page header button and the unified desktop
 *  nav bar (TabsPage.vue) open the exact same modal the exact same way. */
export function useProfileModal() {
  async function openProfile(): Promise<void> {
    const modal = await modalController.create({ component: ProfileModal });
    await modal.present();
  }

  return { openProfile };
}
