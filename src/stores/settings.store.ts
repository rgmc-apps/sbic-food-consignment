import { defineStore } from 'pinia';
import { ref } from 'vue';
import { SettingsService, type FontSizePreset } from '@/services/settings.service';

export const useSettingsStore = defineStore('settings', () => {
  const includeShelfLife = ref(SettingsService.getIncludeShelfLife());
  const showItemPrices = ref(SettingsService.getShowItemPrices());
  const fontSizePreset = ref<FontSizePreset>(SettingsService.getFontSizePreset());

  function setIncludeShelfLife(value: boolean): void {
    includeShelfLife.value = value;
    SettingsService.setIncludeShelfLife(value);
  }

  function setShowItemPrices(value: boolean): void {
    showItemPrices.value = value;
    SettingsService.setShowItemPrices(value);
  }

  function setFontSizePreset(value: FontSizePreset): void {
    fontSizePreset.value = value;
    SettingsService.setFontSizePreset(value);
  }

  return {
    includeShelfLife,
    showItemPrices,
    fontSizePreset,
    setIncludeShelfLife,
    setShowItemPrices,
    setFontSizePreset,
  };
});
