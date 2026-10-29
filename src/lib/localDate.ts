// Formats a Date as YYYY-MM-DD in the device's local timezone. Mealie meal plan
// dates are plain calendar dates, so `toISOString()` (UTC) shifts them by a day
// whenever the local date and the UTC date differ.
export function localIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
