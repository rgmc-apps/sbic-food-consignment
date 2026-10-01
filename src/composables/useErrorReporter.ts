/**
 * Same mechanism as rgmc-consignment-webapp's useErrorReporter: builds a
 * formatted diagnostic text blob and opens the shared rgmc-gateway's
 * /report-issue form in a new tab, pre-filled via query params. No direct
 * backend call from this app — the gateway's own /api/issues endpoint
 * handles the ticket, email, and IT-bot notification once the user submits
 * the form.
 */
import { useAuthStore } from '@/stores/auth.store';
import { ApiError } from '@/services/api.service';

const REPORT_BASE = `${import.meta.env.VITE_GATEWAY_URL ?? 'https://rgmc-gateway-935246372408.asia-southeast1.run.app'}/report-issue`;

export interface ReportContext {
  error?: unknown;
  context?: string;
  payload?: unknown;
  title?: string;
}

export function useErrorReporter() {
  function openReport({ error, context, payload, title }: ReportContext = {}): void {
    const authStore = useAuthStore();
    const lines: string[] = [title ? `[SBIC Consignment - Food] ${title}` : '[SBIC Consignment - Food] Bug Report'];
    lines.push(`Time     : ${new Date().toISOString()}`);
    if (authStore.user?.displayName) lines.push(`User     : ${authStore.user.displayName}`);
    if (authStore.company?.displayName) lines.push(`Company  : ${authStore.company.displayName}`);
    if (context) lines.push(`Context  : ${context}`);
    if (error instanceof ApiError) {
      if (error.status) lines.push(`HTTP     : ${error.status}`);
      if (error.method && error.endpoint) lines.push(`Request  : ${error.method} ${error.endpoint}`);
      lines.push(`Error    : ${error.message}`);
    } else if (error instanceof Error) {
      lines.push(`Error    : ${error.message}`);
    } else if (error !== undefined && error !== null) {
      lines.push(`Error    : ${String(error)}`);
    }
    const screen = window.location.pathname;
    lines.push(`Page     : ${screen}`);
    lines.push(`UA       : ${navigator.userAgent.slice(0, 80)}`);

    const url = new URL(REPORT_BASE);
    url.searchParams.set('system', 'sbic-consignment-food');
    url.searchParams.set('error', lines.join('\n'));
    if (payload != null) {
      const payloadObj = { screen, ...(typeof payload === 'object' ? (payload as object) : { data: payload }) };
      url.searchParams.set('payload', JSON.stringify(payloadObj));
    }
    window.open(url.toString(), '_blank');
  }

  return { openReport };
}
