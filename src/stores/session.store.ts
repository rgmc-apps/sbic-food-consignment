import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Contact, Customer, OrderLine, ScanSession } from '@/types';
import { DraftService } from '@/services/draft.service';
import { todayISO } from '@/utils/format';

function generateId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).substring(2) + Date.now().toString(36);
}

function buildSession(user: Contact, companyCode?: string): ScanSession {
  return {
    id: generateId(),
    user: { displayName: user.displayName, id: user.id || undefined, number: user.number || undefined },
    companyCode,
    customer: null,
    postingDate: todayISO(),
    orderNumber: '',
    lines: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'draft',
  };
}

export const useSessionStore = defineStore('session', () => {
  const currentSession = ref<ScanSession | null>(null);
  const drafts = ref<ScanSession[]>([]);

  const lines = computed(() => currentSession.value?.lines ?? []);
  const lineCount = computed(() => lines.value.reduce((sum, l) => sum + l.quantity, 0));
  const hasDrafts = computed(() => drafts.value.length > 0);
  const hasLines = computed(() => lines.value.length > 0);

  function loadFromStorage(): void {
    drafts.value = DraftService.getDrafts();
  }

  function startNewSession(user: Contact, companyCode?: string): void {
    currentSession.value = buildSession(user, companyCode);
  }

  function resumeDraft(session: ScanSession): void {
    currentSession.value = { ...session };
  }

  function setCustomer(customer: Customer): void {
    if (!currentSession.value) return;
    currentSession.value.customer = customer;
    _touch();
    _saveDraft();
  }

  function setPostingDate(date: string): void {
    if (!currentSession.value) return;
    currentSession.value.postingDate = date;
    _touch();
    _saveDraft();
  }

  function setOrderNumber(orderNumber: string): void {
    if (!currentSession.value) return;
    currentSession.value.orderNumber = orderNumber;
    _touch();
    _saveDraft();
  }

  function addLine(line: Omit<OrderLine, 'id'>): void {
    if (!currentSession.value) return;
    currentSession.value.lines.push({ ...line, id: generateId() });
    _touch();
    _saveDraft();
  }

  function removeLine(lineId: string): void {
    if (!currentSession.value) return;
    currentSession.value.lines = currentSession.value.lines.filter((l) => l.id !== lineId);
    _touch();
    _saveDraft();
  }

  function updateLineQuantity(lineId: string, quantity: number): void {
    if (!currentSession.value) return;
    const idx = currentSession.value.lines.findIndex((l) => l.id === lineId);
    if (idx === -1) return;
    currentSession.value.lines[idx] = { ...currentSession.value.lines[idx], quantity };
    _touch();
    _saveDraft();
  }

  /** Called on navigation away — persists to drafts but keeps session active. */
  function autoSaveDraft(): void {
    if (!currentSession.value || !currentSession.value.customer) return;
    currentSession.value.status = 'draft';
    _touch();
    DraftService.saveDraft({ ...currentSession.value });
    drafts.value = DraftService.getDrafts();
  }

  function saveAsDraftAndExit(): void {
    if (!currentSession.value) return;
    if (currentSession.value.customer) {
      currentSession.value.status = 'draft';
      _touch();
      DraftService.saveDraft({ ...currentSession.value });
      drafts.value = DraftService.getDrafts();
    }
    currentSession.value = null;
  }

  /** Called only after the backend confirms the BC document was created. */
  function markSubmitted(documentNumber: string): void {
    if (!currentSession.value) return;
    DraftService.removeDraft(currentSession.value.id);
    drafts.value = DraftService.getDrafts();
    currentSession.value = { ...currentSession.value, status: 'submitted', documentNumber };
  }

  function markFailed(errorMessage: string): void {
    if (!currentSession.value) return;
    currentSession.value.status = 'failed';
    currentSession.value.errorMessage = errorMessage;
    _touch();
    DraftService.saveDraft({ ...currentSession.value });
    drafts.value = DraftService.getDrafts();
  }

  function deleteDraft(sessionId: string): void {
    DraftService.removeDraft(sessionId);
    drafts.value = DraftService.getDrafts();
    if (currentSession.value?.id === sessionId) currentSession.value = null;
  }

  function clearCurrentSession(): void {
    currentSession.value = null;
  }

  function _touch(): void {
    if (currentSession.value) currentSession.value.updatedAt = new Date().toISOString();
  }

  function _saveDraft(): void {
    if (!currentSession.value || !currentSession.value.customer) return;
    DraftService.saveDraft({ ...currentSession.value });
    drafts.value = DraftService.getDrafts();
  }

  return {
    currentSession,
    drafts,
    lines,
    lineCount,
    hasDrafts,
    hasLines,
    loadFromStorage,
    startNewSession,
    resumeDraft,
    setCustomer,
    setPostingDate,
    setOrderNumber,
    addLine,
    removeLine,
    updateLineQuantity,
    autoSaveDraft,
    saveAsDraftAndExit,
    markSubmitted,
    markFailed,
    deleteDraft,
    clearCurrentSession,
  };
});
