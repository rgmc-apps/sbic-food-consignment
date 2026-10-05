/**
 * User-facing app configuration — per-device display toggles only (never
 * submitted to BC, never affect what an order actually contains). A new
 * sanctioned localStorage key alongside auth/company/drafts/catalogs — see
 * README.md's localStorage key table, kept in sync with this file.
 */
const STORAGE_KEY = 'sbic_food_settings_v1';

export type FontSizePreset = 'compact' | 'cozy' | 'default' | 'comfortable' | 'spacious';
export const FONT_SIZE_PRESETS: { value: FontSizePreset; label: string; scale: number }[] = [
  { value: 'compact', label: 'Extra Small', scale: 0.85 },
  { value: 'cozy', label: 'Small', scale: 0.925 },
  { value: 'default', label: 'Default', scale: 1 },
  { value: 'comfortable', label: 'Large', scale: 1.1 },
  { value: 'spacious', label: 'Extra Large', scale: 1.2 },
];

interface StoredSettings {
  includeShelfLife?: boolean;
  showItemPrices?: boolean;
  fontSizePreset?: FontSizePreset;
}

function readSettings(): StoredSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredSettings) : {};
  } catch {
    return {};
  }
}

function writeSettings(patch: Partial<StoredSettings>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readSettings(), ...patch }));
  } catch {
    // Storage unavailable (private mode, quota) — the setting still applies
    // for the rest of this tab's session via the store's in-memory value,
    // it just won't survive a reload.
  }
}

export const SettingsService = {
  getIncludeShelfLife(): boolean {
    return readSettings().includeShelfLife ?? false;
  },
  setIncludeShelfLife(value: boolean): void {
    writeSettings({ includeShelfLife: value });
  },

  getShowItemPrices(): boolean {
    return readSettings().showItemPrices ?? false;
  },
  setShowItemPrices(value: boolean): void {
    writeSettings({ showItemPrices: value });
  },

  getFontSizePreset(): FontSizePreset {
    return readSettings().fontSizePreset ?? 'default';
  },
  setFontSizePreset(value: FontSizePreset): void {
    writeSettings({ fontSizePreset: value });
  },
};
