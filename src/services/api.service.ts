import axios from 'axios';
import type {
  Company,
  Contact,
  Customer,
  FoodSalesOrderPayload,
  FoodSalesOrderResult,
  Item,
  ItemLot,
  ItemUnitOfMeasure,
  Page,
} from '@/types';

/** Richer error that preserves HTTP status + endpoint for troubleshooting. */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly endpoint?: string,
    public readonly method?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const apiClient = axios.create({
  baseURL: '',
  timeout: 60_000,
  headers: { 'Content-Type': 'application/json' },
});

/* Selected company code — set at login, restored on startup. Injected as
 * ?company=<code> on every /food/ call, same mechanism as the garments app. */
let _companyCode: string | null = null;

export function setApiCompany(code: string | null): void {
  _companyCode = code;
}

apiClient.interceptors.request.use((config) => {
  if (_companyCode && config.url?.startsWith('/food/')) {
    config.params = { ...config.params, company: _companyCode };
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message: string =
      error.response?.data?.detail ||
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      'An unexpected error occurred';
    const status: number | undefined = error.response?.status;
    const endpoint: string | undefined = error.config?.url;
    const method: string | undefined = error.config?.method?.toUpperCase();
    return Promise.reject(new ApiError(message, status, endpoint, method));
  },
);

function toPage<T>(body: unknown): Page<T> {
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;
    if (Array.isArray(b['value'])) {
      return {
        value: b['value'] as T[],
        total: typeof b['total'] === 'number' ? (b['total'] as number) : (b['value'] as T[]).length,
        limit: typeof b['limit'] === 'number' ? (b['limit'] as number) : (b['value'] as T[]).length,
        offset: typeof b['offset'] === 'number' ? (b['offset'] as number) : 0,
      };
    }
  }
  if (Array.isArray(body)) {
    return { value: body as T[], total: body.length, limit: body.length, offset: 0 };
  }
  return { value: [], total: 0, limit: 0, offset: 0 };
}

export const ApiService = {
  /** Companies flagged foodConsignmentVisible=true — live, every call. */
  async getCompanies(): Promise<Company[]> {
    const res = await apiClient.get('/food/companies');
    return toPage<Company>(res.data).value;
  },

  /** Single-contact lookup by username for login — no full-list prefetch. */
  async getContactByUsername(username: string): Promise<Contact | null> {
    const res = await apiClient.get('/food/contacts', { params: { username } });
    const list = toPage<Contact>(res.data).value;
    return list[0] ?? null;
  },

  async updateContact(id: string, patch: Partial<Contact>): Promise<void> {
    await apiClient.patch(`/food/contacts/${encodeURIComponent(id)}`, patch);
  },

  /** Paginated, live customer search — chain=true is always enforced server-side. */
  async getCustomers(opts: { search?: string; limit?: number; offset?: number } = {}): Promise<Page<Customer>> {
    const res = await apiClient.get('/food/customers', {
      params: { search: opts.search || undefined, limit: opts.limit ?? 25, offset: opts.offset ?? 0 },
    });
    return toPage<Customer>(res.data);
  },

  /** Paginated, live item search by number, id, or description. */
  async getItems(opts: { search?: string; limit?: number; offset?: number } = {}): Promise<Page<Item>> {
    const res = await apiClient.get('/food/items', {
      params: { search: opts.search || undefined, limit: opts.limit ?? 25, offset: opts.offset ?? 0 },
    });
    return toPage<Item>(res.data);
  },

  /** Available lots for one item, oldest expiration first (live). */
  async getItemLots(itemNo: string, opts: { limit?: number; offset?: number } = {}): Promise<Page<ItemLot>> {
    const res = await apiClient.get(`/food/items/${encodeURIComponent(itemNo)}/lots`, {
      params: { limit: opts.limit ?? 50, offset: opts.offset ?? 0 },
    });
    return toPage<ItemLot>(res.data);
  },

  /** Valid Units of Measure for one item (live). */
  async getItemUnitsOfMeasure(itemNo: string): Promise<ItemUnitOfMeasure[]> {
    const res = await apiClient.get(`/food/items/${encodeURIComponent(itemNo)}/uom`);
    return toPage<ItemUnitOfMeasure>(res.data).value;
  },

  /** Synchronous, direct submit to Business Central — no queue, no polling. */
  async submitSalesOrder(payload: FoodSalesOrderPayload): Promise<FoodSalesOrderResult> {
    const res = await apiClient.post('/food/sales-orders', payload);
    return res.data as FoodSalesOrderResult;
  },
};
