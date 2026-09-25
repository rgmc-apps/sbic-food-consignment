/** BC company scoped to this app — filtered server-side by foodConsignmentVisible.
 *  `code` is BC's own company name (e.g. "SBIC") — the value sent back as the
 *  ?company= query param on every subsequent /food/ call. */
export interface Company {
  id: string;
  code: string;
  displayName: string;
  foodConsignmentVisible?: boolean;
}

/** BC Contact — login identity. username/passwordHash are app-specific fields
 *  bolted onto Contact (same mechanism as the garments app). */
export interface Contact {
  id: string;
  number?: string;
  displayName: string;
  email?: string;
  phoneNumber?: string;
  username?: string;
  passwordHash?: string;
}

/** BC Customer — only chain=true customers are ever returned by /food/customers. */
export interface Customer {
  id: string;
  number: string;
  displayName: string;
  address?: string;
  city?: string;
  county?: string;
  postCode?: string;
  countryRegionCode?: string;
  phoneNumber?: string;
  email?: string;
  chain?: boolean;
}

/** BC Item — catalog fields only, no brand/family filter for this app. */
export interface Item {
  id: string;
  number: string;
  description?: string;
  baseUnitOfMeasureCode?: string;
}

/** A lot/expiration record for one item, sourced live from Item Ledger Entries
 *  (RGMC Item Ledger Entry API v2) filtered to remainingQuantity > 0. */
export interface ItemLot {
  itemNo: string;
  lotNo?: string;
  expirationDate?: string;
  remainingQuantity: number;
}

/** Per-item Unit of Measure option, sourced from the new RGMC Item Unit Of
 *  Measure API v2 (Item Unit of Measure table). */
export interface ItemUnitOfMeasure {
  itemNo: string;
  code: string;
  description?: string;
  qtyPerUnitOfMeasure: number;
}

/** One line the user has added to the current order. */
export interface OrderLine {
  id: string;
  itemNumber: string;
  description: string;
  quantity: number;
  unitOfMeasureCode: string;
  expirationDate?: string;
  lotNo?: string;
  availableQuantity: number;
}

export type SessionStatus = 'draft' | 'submitted' | 'failed';

/** The unit of work autosaved to localStorage. Everything else in this app is
 *  fetched live — this is the ONLY thing persisted client-side. */
export interface ScanSession {
  id: string;
  user: {
    displayName: string;
    id?: string;
    number?: string;
  };
  companyCode?: string;
  customer: Customer | null;
  postingDate: string;
  orderNumber: string;
  lines: OrderLine[];
  createdAt: string;
  updatedAt: string;
  status: SessionStatus;
  documentNumber?: string;
  errorMessage?: string;
}

/** Outbound payload for POST /food/sales-orders. */
export interface FoodSalesOrderLinePayload {
  itemNumber: string;
  description: string;
  quantity: number;
  unitOfMeasureCode: string;
}

export interface FoodSalesOrderPayload {
  customerNumber: string;
  postingDate: string;
  orderNumber: string;
  lines: FoodSalesOrderLinePayload[];
}

export interface FoodSalesOrderResult {
  documentNumber: string;
  externalDocumentNo: string;
}

/** Standard pagination envelope every /food/* list endpoint returns. */
export interface Page<T> {
  value: T[];
  total: number;
  limit: number;
  offset: number;
}
