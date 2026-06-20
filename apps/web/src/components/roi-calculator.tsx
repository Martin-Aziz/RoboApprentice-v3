"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { calculateRoi, defaultRoiInputs, encodeRoi, parseLocaleNumber, type RoiInputs } from "@/lib/roi";
import { formatCurrency, formatNumber } from "@/lib/format";
import { useLocale } from "@/lib/i18n";
import type { DemoLocale } from "@/lib/demo-seed";

export function RoiCalculator({ initial, readOnly = false }: { initial?: RoiInputs; readOnly?: boolean }) {
  const { locale, t } = useLocale();
  const [inputs, setInputs] = useState<RoiInputs>(initial ?? defaultRoiInputs(locale));
  const [shareUrl, setShareUrl] = useState("");
  const [email, setEmail] = useState("");
  const [emailed, setEmailed] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);
  const result = useMemo(() => calculateRoi(inputs, locale), [inputs, locale]);
  const chart = [
    { name: "Current", cost: result.currentCost },
    { name: "With Aurevix", cost: result.aurevixCost },
  ];

  const update = (key: keyof RoiInputs, value: number) => setInputs((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    if (!initial) setInputs(defaultRoiInputs(locale));
  }, [initial, locale]);

  const share = () => {
    const encoded = encodeRoi(inputs);
    const url = `${window.location.origin}/roi/shared/${encoded}`;
    setShareUrl(url);
    navigator.clipboard?.writeText(url);
  };

  const downloadPdf = async () => {
    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    pdf.setFontSize(18);
    pdf.text("Aurevix", 48, 48);
    pdf.setFontSize(22);
    pdf.text("Robot Automation ROI Analysis for Walldorf Assembly Plant", 48, 86, { maxWidth: 500 });
    pdf.setFontSize(36);
    pdf.text(formatCurrency(result.annualSavings, locale), 48, 150);
    pdf.setFontSize(12);
    pdf.text(`${t("regional.roi")} • Payback ${result.paybackMonths.toFixed(1)} months`, 48, 174);
    if (chartRef.current) {
      const canvas = await html2canvas(chartRef.current);
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 48, 210, 500, 220);
    }
    pdf.setFontSize(10);
    pdf.text(`Generated ${new Date().toLocaleString(locale)} by Aurevix`, 48, 790);
    pdf.save("aurevix-roi-analysis.pdf");
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <section className="rounded-lg border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] p-5">
        <h2 className="font-semibold">Inputs</h2>
        <div className="mt-4 grid gap-3">
          <Field label="Number of robots" value={inputs.robots} locale={locale} disabled={readOnly} onChange={(v) => update("robots", v)} />
          <Field label="Tasks per robot per shift" value={inputs.tasksPerRobotPerShift} locale={locale} disabled={readOnly} onChange={(v) => update("tasksPerRobotPerShift", v)} />
          <Field label="Shifts per day" value={inputs.shiftsPerDay} locale={locale} disabled={readOnly} onChange={(v) => update("shiftsPerDay", v)} />
          <Field label="Operating days per year" value={inputs.operatingDaysPerYear} locale={locale} disabled={readOnly} onChange={(v) => update("operatingDaysPerYear", v)} />
          <Field label="Current programming time per task (hours)" value={inputs.currentProgrammingHours} locale={locale} step={0.1} disabled={readOnly} onChange={(v) => update("currentProgrammingHours", v)} />
          <Field label="Aurevix programming time per task (hours)" value={inputs.aurevixProgrammingHours} locale={locale} step={0.1} disabled={readOnly} onChange={(v) => update("aurevixProgrammingHours", v)} />
          <Field label="Operator hourly rate" value={inputs.operatorHourlyRate} locale={locale} disabled={readOnly} onChange={(v) => update("operatorHourlyRate", v)} />
          <Field label="Tasks reprogrammed per year" value={inputs.tasksReprogrammedPerYear} locale={locale} disabled={readOnly} onChange={(v) => update("tasksReprogrammedPerYear", v)} />
        </div>
      </section>

      <section className="space-y-4">
        <div className="rounded-lg border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] p-5">
          <p className="text-sm text-[rgb(var(--bone-2))]">{t("regional.roi")}</p>
          <p className="mt-2 font-mono text-5xl tabular">{formatCurrency(result.annualSavings, locale)}</p>
          <div className="mt-5 grid grid-cols-3 gap-3">
            <Output label="Hours saved" value={formatNumber(Math.round(result.annualHoursSaved), locale)} />
            <Output label="Payback" value={`${result.paybackMonths.toFixed(1)} mo`} />
            <Output label="3-year savings" value={formatSignedCurrency(result.threeYearSavings, locale)} />
          </div>
        </div>
        <div ref={chartRef} className="h-72 rounded-lg border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] p-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis label={{ value: "Annual cost", angle: -90, position: "insideLeft" }} />
              <Tooltip formatter={(value: number) => formatCurrency(value, locale)} />
              <Bar dataKey="cost" fill="rgb(var(--signal-cyan))" radius={[4, 4, 0, 0]}>
                <LabelList dataKey="cost" position="top" formatter={(value: number) => formatCurrency(value, locale)} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button onClick={downloadPdf}>Download as PDF</Button>
          {!readOnly && <Button variant="outline" onClick={share}>Share link</Button>}
        </div>
        {shareUrl && <p className="rounded-md bg-[rgb(var(--signal-green)/0.1)] p-3 text-sm text-[rgb(var(--signal-green))]">Share URL copied: {shareUrl}</p>}
        {!readOnly && (
          <div className="rounded-lg border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] p-4">
            <p className="font-semibold">Email me this analysis</p>
            <div className="mt-3 flex gap-2">
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" className="min-w-0 flex-1 rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-3))] px-3 py-2 text-sm" />
              <Button variant="outline" onClick={() => setEmailed(true)}>Send</Button>
            </div>
            {emailed && <p className="mt-2 text-sm text-[rgb(var(--signal-green))]">Saved to this workspace. No email was sent.</p>}
          </div>
        )}
      </section>
    </div>
  );
}

function formatInputValue(value: number, locale: DemoLocale, step: number) {
  const maximumFractionDigits = step < 1 ? 1 : 0;
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: step < 1 ? 1 : 0,
    maximumFractionDigits,
    useGrouping: false,
  }).format(value);
}

function formatSignedCurrency(value: number, locale: DemoLocale) {
  const formatted = formatCurrency(value, locale);
  return value > 0 ? `+${formatted}` : formatted;
}

function Field({ label, value, locale, step = 1, disabled, onChange }: { label: string; value: number; locale: DemoLocale; step?: number; disabled?: boolean; onChange: (value: number) => void }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-[rgb(var(--bone-2))]">{label}</span>
      <input
        disabled={disabled}
        inputMode="decimal"
        value={formatInputValue(value, locale, step)}
        onChange={(event) => {
          const next = parseLocaleNumber(event.target.value, locale);
          if (!Number.isNaN(next)) onChange(next);
        }}
        className="rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-3))] px-3 py-2 font-mono tabular"
      />
    </label>
  );
}

function Output({ label, value }: { label: string; value: string }) {
  return <div><p className="font-mono text-lg tabular">{value}</p><p className="text-xs text-[rgb(var(--bone-2))]">{label}</p></div>;
}
