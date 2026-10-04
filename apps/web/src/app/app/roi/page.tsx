"use client";

import { RoiCalculator } from "@/components/roi-calculator";
import { useLocale } from "@/lib/i18n";

export default function RoiPage() {
  const { t } = useLocale();
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-5 md:p-8">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-[rgb(var(--signal-cyan))]">Your ROI</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">{t("roi.title")}</h1>
      </div>
      <RoiCalculator />
      <p className="rounded-md bg-[rgb(var(--ink-3))] p-3 text-xs text-[rgb(var(--bone-2))]">Figures are derived from the inputs above. Defaults are illustrative assumptions, not measured design-partner results.</p>
    </div>
  );
}
