import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { loadBcrypt } from '@/utils/bcrypt';
import type { Company, Contact } from '@/types';
import { ApiService, setApiCompany } from '@/services/api.service';
import { DraftService } from '@/services/draft.service';
import { clearItemPrefetch } from '@/services/item-prefetch.service';

function isBcryptHash(value: string): boolean {
  return /^\$2[abyA-Z]\$\d{2}\$/.test(value);
}

export const useAuthStore = defineStore('auth', () => {
  const company = ref<Company | null>(null);
  const user = ref<Contact | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  const forcePasswordSetup = ref(false);
  const pendingSetupContact = ref<Contact | null>(null);

  const isAuthenticated = computed(() => !!company.value && !!user.value);

  function loadFromStorage(): void {
    const savedCode = DraftService.getCompanyCode();
    const savedAuth = DraftService.getAuth();
    if (savedCode) {
      setApiCompany(savedCode);
      company.value = { id: savedCode, code: savedCode, displayName: savedCode };
    }
    if (savedAuth?.user) {
      user.value = savedAuth.user;
    }
  }

  /** Live lookup + client-side bcrypt/legacy-plaintext check — same mechanism
   *  as the garments app, but the contact is fetched fresh every attempt
   *  instead of being prefetched/cached for the whole session. */
  async function login(selectedCompany: Company, username: string, password: string): Promise<boolean> {
    isLoading.value = true;
    error.value = null;

    try {
      setApiCompany(selectedCompany.code);
      const candidate = await ApiService.getContactByUsername(username.trim());

      if (!candidate) {
        error.value = 'Invalid username or password.';
        return false;
      }

      if (!candidate.passwordHash) {
        pendingSetupContact.value = candidate;
        forcePasswordSetup.value = true;
        return false;
      }

      if (!isBcryptHash(candidate.passwordHash)) {
        if (candidate.passwordHash.trim() !== password.trim()) {
          error.value = 'Invalid username or password.';
          return false;
        }
        const bcrypt = await loadBcrypt();
        const hash = await bcrypt.hash(password.trim(), 10);
        ApiService.updateContact(candidate.id, { passwordHash: hash }).catch(() => {});
        return _completeLogin(selectedCompany, { ...candidate, passwordHash: hash });
      }

      const bcrypt = await loadBcrypt();
      const [passwordValid, isDefaultPassword] = await Promise.all([
        bcrypt.compare(password, candidate.passwordHash),
        bcrypt.compare('12345678', candidate.passwordHash),
      ]);

      if (!passwordValid) {
        error.value = 'Invalid username or password.';
        return false;
      }
      if (isDefaultPassword) {
        pendingSetupContact.value = candidate;
        forcePasswordSetup.value = true;
        return false;
      }

      return _completeLogin(selectedCompany, candidate);
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Login failed. Please try again.';
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  function _completeLogin(selectedCompany: Company, contact: Contact): boolean {
    company.value = selectedCompany;
    user.value = contact;
    setApiCompany(selectedCompany.code);
    DraftService.setCompanyCode(selectedCompany.code);
    DraftService.setAuth({ user: contact });
    return true;
  }

  async function completePasswordSetup(newPassword: string): Promise<void> {
    if (!pendingSetupContact.value) return;
    const bcrypt = await loadBcrypt();
    const hash = await bcrypt.hash(newPassword, 10);
    const updated: Contact = { ...pendingSetupContact.value, passwordHash: hash };
    await ApiService.updateContact(updated.id, { passwordHash: hash }).catch(() => {});
    forcePasswordSetup.value = false;
    pendingSetupContact.value = null;
  }

  function clearPasswordSetup(): void {
    forcePasswordSetup.value = false;
    pendingSetupContact.value = null;
  }

  /** Editable profile fields only — never number/id. Throws on failure so the
   *  Profile screen can show the real error, unlike the silent bcrypt-upgrade
   *  writes above. */
  async function updateProfile(patch: {
    displayName?: string;
    email?: string;
    phoneNumber?: string;
    username?: string;
  }): Promise<void> {
    if (!user.value) return;
    await ApiService.updateContact(user.value.id, patch);
    user.value = { ...user.value, ...patch };
    DraftService.setAuth({ user: user.value });
  }

  /** Same bcrypt hashing as login's legacy-password upgrade and first-time
   *  setup — the one encryption scheme this app ever writes to passwordHash. */
  async function changePassword(newPassword: string): Promise<void> {
    if (!user.value) return;
    const bcrypt = await loadBcrypt();
    const hash = await bcrypt.hash(newPassword, 10);
    await ApiService.updateContact(user.value.id, { passwordHash: hash });
    user.value = { ...user.value, passwordHash: hash };
    DraftService.setAuth({ user: user.value });
  }

  function logout(): void {
    company.value = null;
    user.value = null;
    setApiCompany(null);
    DraftService.clearAuth();
    DraftService.clearCompanyCode();
    clearItemPrefetch();
  }

  function clearError(): void {
    error.value = null;
  }

  return {
    company,
    user,
    isAuthenticated,
    isLoading,
    error,
    forcePasswordSetup,
    pendingSetupContact,
    loadFromStorage,
    login,
    completePasswordSetup,
    clearPasswordSetup,
    updateProfile,
    changePassword,
    logout,
    clearError,
  };
});
