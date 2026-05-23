import type { DemoLocale } from "@/lib/demo-seed";

const currencyByLocale: Record<DemoLocale, string> = {
  "en-US": "USD",
  "en-GB": "GBP",
  "de-DE": "EUR",
  "es-ES": "EUR",
  "zh-CN": "CNY",
  "ja-JP": "JPY",
};

export const operatorRateByLocale: Record<DemoLocale, number> = {
  "en-US": 32,
  "en-GB": 18,
  "de-DE": 28,
  "es-ES": 22,
  "zh-CN": 85,
  "ja-JP": 3400,
};

export function formatCurrency(amount: number, locale: DemoLocale) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyByLocale[locale],
    maximumFractionDigits: amount > 999 ? 0 : 2,
  }).format(amount);
}

export function formatDate(date: string | Date, locale: DemoLocale) {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(date));
}

export function formatNumber(n: number, locale: DemoLocale) {
  return new Intl.NumberFormat(locale).format(n);
}

export function formatDuration(ms: number, locale: DemoLocale) {
  const seconds = ms / 1000;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(seconds)} s`;
}

export function formatMass(kg: number, locale: DemoLocale) {
  if (locale === "en-US") return `${formatNumber(Math.round(kg * 2.20462), locale)} lbs`;
  return `${formatNumber(kg, locale)} kg`;
}

export function formatTemperature(celsius: number, locale: DemoLocale) {
  if (locale === "en-US") return `${Math.round((celsius * 9) / 5 + 32)} °F`;
  return `${Math.round(celsius)} °C`;
}
