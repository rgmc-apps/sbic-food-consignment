export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
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
