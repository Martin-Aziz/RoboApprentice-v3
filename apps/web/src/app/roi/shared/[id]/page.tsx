"use client";

import { useParams } from "next/navigation";
import { RoiCalculator } from "@/components/roi-calculator";
import { decodeRoi } from "@/lib/roi";

export default function SharedRoiPage() {
  const params = useParams<{ id: string }>();
  const inputs = decodeRoi(params.id);
  return (
    <main className="mx-auto max-w-7xl space-y-6 p-5 md:p-8">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-[rgb(var(--signal-cyan))]">Shared Aurevix analysis</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Read-only ROI analysis</h1>
      </div>
      {inputs ? <RoiCalculator initial={inputs} readOnly /> : <p>Invalid shared analysis link.</p>}
    </main>
  );
}
