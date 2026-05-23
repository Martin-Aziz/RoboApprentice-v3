"use client";

import { RoiCalculator } from "@/components/roi-calculator";
import { useLocale } from "@/lib/i18n";

export default function RoiPage() {
  const { t } = useLocale();
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-5 md:p-8">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-[rgb(var(--signal-cyan))]">Sales artifact</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">{t("roi.title")}</h1>
      </div>
      <RoiCalculator />
    </div>
  );
}

