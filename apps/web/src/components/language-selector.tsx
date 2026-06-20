"use client";

import { LOCALES, useLocale } from "@/lib/i18n";
import type { DemoLocale } from "@/lib/demo-seed";

const labels: Record<DemoLocale, string> = {
  "en-US": "ENG",
  "en-GB": "ENG",
  "de-DE": "DE",
  "es-ES": "ES",
  "zh-CN": "CN",
  "ja-JP": "JP",
};

export function LanguageSelector() {
  const { locale, setLocale } = useLocale();
  const visibleLocales = LOCALES.filter((item) => item !== "en-GB");
  return (
    <div data-testid="locale-switcher" className="flex rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] p-1">
      {visibleLocales.map((item) => (
        <button
          key={item}
          onClick={() => setLocale(item)}
          className={`min-h-10 min-w-10 rounded px-2 py-2 font-mono text-[11px] tabular transition ${
            locale === item
              ? "bg-[rgb(var(--signal-cyan))] text-white"
              : "text-[rgb(var(--bone-2))] hover:bg-[rgb(var(--ink-3))]"
          }`}
          title={item === "en-US" ? "English" : item}
        >
          {labels[item]}
        </button>
      ))}
    </div>
  );
}
