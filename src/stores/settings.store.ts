import { defineStore } from 'pinia';
import { ref } from 'vue';
import { SettingsService } from '@/services/settings.service';

export const useSettingsStore = defineStore('settings', () => {
  const includeShelfLife = ref(SettingsService.getIncludeShelfLife());
  const showItemPrices = ref(SettingsService.getShowItemPrices());

  function setIncludeShelfLife(value: boolean): void {
    includeShelfLife.value = value;
    SettingsService.setIncludeShelfLife(value);
  }

  function setShowItemPrices(value: boolean): void {
    showItemPrices.value = value;
    SettingsService.setShowItemPrices(value);
  }

  return {
    includeShelfLife,
    showItemPrices,
    setIncludeShelfLife,
    setShowItemPrices,
  };
});
