export const REGIONAL_DEFAULTS = Object.freeze({
  country: "India",
  countryCode: "IN",
  state: "Gujarat",
  currency: "INR",
  currencySymbol: "₹",
  locale: "en-IN",
  timeZone: "Asia/Kolkata",
  dateLocale: "en-IN",
  dateFormat: "DD-MM-YYYY",
  timeFormat: "HH:mm",
  language: "en",
  measurementSystem: "metric",
  financialYearStartMonth: 3,
});

const currencyFormatter = new Intl.NumberFormat(REGIONAL_DEFAULTS.locale, {
  style: "currency", currency: REGIONAL_DEFAULTS.currency,
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});
const numberFormatter = new Intl.NumberFormat(REGIONAL_DEFAULTS.locale);

export function formatCurrency(value) {
  const amount = Number(value);
  return currencyFormatter.format(Number.isFinite(amount) ? amount : 0);
}

export function formatNumber(value, options) {
  const amount = Number(value);
  return new Intl.NumberFormat(REGIONAL_DEFAULTS.locale, options).format(Number.isFinite(amount) ? amount : 0);
}

export function formatDate(value, options) {
  if (!value) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  const date = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const dateUtc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  if (!options) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "UTC",
    }).formatToParts(dateUtc);
    const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    return `${values.day}-${values.month}-${values.year}`;
  }
  return new Intl.DateTimeFormat(REGIONAL_DEFAULTS.dateLocale, { ...options, timeZone: "UTC" }).format(dateUtc);
}

export function getBusinessDateISO(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: REGIONAL_DEFAULTS.timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function getFinancialYearRange(date = getBusinessDateISO()) {
  const [year, month] = String(date).slice(0, 7).split("-").map(Number);
  const startYear = month >= 4 ? year : year - 1;
  return { start: `${startYear}-04-01`, endExclusive: `${startYear + 1}-04-01`, label: `${startYear}-${String(startYear + 1).slice(-2)}` };
}

export function getFinancialYearStart(date = getBusinessDateISO()) {
  return getFinancialYearRange(date).start;
}

export { numberFormatter };
