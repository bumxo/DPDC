/** Philippine business locale: peso amounts, Manila-local timestamps. */
export const TIME_ZONE = "Asia/Manila";
const LOCALE = "en-PH";

const currency = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: "PHP",
});

// Timestamps render server-side, where the host clock is UTC, so the zone is
// pinned explicitly and labelled (GMT+8) to keep order times unambiguous.
const dateTime = new Intl.DateTimeFormat(LOCALE, {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: TIME_ZONE,
  timeZoneName: "short",
});

export function formatMoney(value: number | string) {
  return currency.format(typeof value === "string" ? Number(value) : value);
}

export function formatDate(value: string) {
  return dateTime.format(new Date(value));
}

export function shortId(id: string) {
  return id.slice(0, 8).toUpperCase();
}
