/**
 * The ONLY localStorage usage in this app. Unlike the garments app, there is no
 * customer/item/price catalog cache, no sync timestamps, no IndexedDB — every
 * screen fetches live from the backend. This module exists purely so that an
 * in-progress, not-yet-submitted order isn't lost if the network drops or the
 * tab is closed mid-session.
 */
import type { Contact, ScanSession } from '@/types';

const KEYS = {
  AUTH: 'sbic_food_auth_v1',
  COMPANY: 'sbic_food_company_v1',
  DRAFTS: 'sbic_food_drafts_v1',
} as const;

interface AuthPayload {
  user: Contact;
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable (private mode, quota) — degrade silently, the
    // in-memory session still works for the rest of the current tab lifetime.
  }
}

export const DraftService = {
  // ---- Auth session (persists login across a page refresh) ----
  getAuth(): AuthPayload | null {
    return readJson<AuthPayload>(KEYS.AUTH);
  },
  setAuth(payload: AuthPayload): void {
    writeJson(KEYS.AUTH, payload);
  },
  clearAuth(): void {
    localStorage.removeItem(KEYS.AUTH);
  },

  getCompanyCode(): string | null {
    return readJson<string>(KEYS.COMPANY);
  },
  setCompanyCode(code: string): void {
    writeJson(KEYS.COMPANY, code);
  },
  clearCompanyCode(): void {
    localStorage.removeItem(KEYS.COMPANY);
  },

  // ---- Draft sessions (autosaved unsubmitted orders) ----
  getDrafts(): ScanSession[] {
    return readJson<ScanSession[]>(KEYS.DRAFTS) ?? [];
  },
  saveDraft(session: ScanSession): void {
    const all = this.getDrafts();
    const idx = all.findIndex((s) => s.id === session.id);
    if (idx >= 0) all[idx] = session;
    else all.push(session);
    writeJson(KEYS.DRAFTS, all);
  },
  removeDraft(sessionId: string): void {
    const all = this.getDrafts().filter((s) => s.id !== sessionId);
    writeJson(KEYS.DRAFTS, all);
  },
};
