"use client";

import { LOCALES, useLocale } from "@/lib/i18n";
import type { DemoLocale } from "@/lib/demo-seed";

const labels: Record<DemoLocale, string> = {
  "en-US": "US",
  "en-GB": "UK",
  "de-DE": "DE",
  "zh-CN": "CN",
};

export function LanguageSelector() {
  const { locale, setLocale } = useLocale();
  return (
    <div className="flex rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] p-1">
      {LOCALES.map((item) => (
        <button
          key={item}
          onClick={() => setLocale(item)}
          className={`rounded px-2 py-1 font-mono text-[11px] tabular transition ${
            locale === item
              ? "bg-[rgb(var(--signal-cyan))] text-white"
              : "text-[rgb(var(--bone-2))] hover:bg-[rgb(var(--ink-3))]"
          }`}
          title={item}
        >
          {labels[item]}
        </button>
      ))}
    </div>
  );
}

