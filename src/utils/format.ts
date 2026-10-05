export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Short, year-less date for use inside an already-labeled month group
 *  (e.g. "Sep 1") — the month/year is established by the group header,
 *  so repeating it per entry would be redundant. */
export function formatShortDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatCurrency(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value);
}

export function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

/** Days remaining are meaningful for FEFO food/beverage stock, not decorative —
 *  this is the one place color carries real safety/priority information. */
export const EXPIRY_SOON_DAYS = 14;

export function isExpiringSoon(value: string | null | undefined, withinDays = EXPIRY_SOON_DAYS): boolean {
  if (!value) return false;
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const days = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  return days <= withinDays;
}

/** Extends a lot's real BC expiration date by the selected customer's Prod
 *  Shelf Life (months) — the "Include Item Shelf Life" setting. Returns the
 *  original date unchanged if there's nothing to add (no lot expiry, no
 *  customer shelf-life term, or a non-positive value). */
export function addShelfLifeMonths(expirationDate: string | null | undefined, shelfLifeMonths: number | null | undefined): string | undefined {
  if (!expirationDate) return expirationDate ?? undefined;
  if (!shelfLifeMonths || shelfLifeMonths <= 0) return expirationDate;
  const d = new Date(`${expirationDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return expirationDate;
  const originalDay = d.getDate();
  d.setMonth(d.getMonth() + shelfLifeMonths);
  if (d.getDate() !== originalDay) {
    // Overflowed into the following month (e.g. Nov 30 + 3 months lands on
    // a month with no 30th) — clamp to the last day of the intended month
    // instead of silently extending the expiry further than the customer's
    // shelf-life term actually allows.
    d.setDate(0);
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
