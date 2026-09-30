/**
 * User-facing app configuration — per-device display toggles only (never
 * submitted to BC, never affect what an order actually contains). A new
 * sanctioned localStorage key alongside auth/company/drafts/catalogs — see
 * README.md's localStorage key table, kept in sync with this file.
 */
const STORAGE_KEY = 'sbic_food_settings_v1';

interface StoredSettings {
  includeShelfLife?: boolean;
  showItemPrices?: boolean;
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
};
