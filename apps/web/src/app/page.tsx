"use client";

import Link from "next/link";
import { ArrowRight, Bot, Gauge, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/logo";
import { LanguageSelector } from "@/components/language-selector";
import { useLocale } from "@/lib/i18n";
import { DEMO_VIDEO_URL } from "@/lib/demo-seed";

export default function LandingPage() {
  const { t } = useLocale();

  return (
    <main className="min-h-screen bg-[rgb(var(--ink))]">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5">
        <Wordmark />
        <div className="flex items-center gap-3">
          <LanguageSelector />
          <Button asChild>
            <Link href="/app">{t("action.openConsole")}</Link>
          </Button>
        </div>
      </header>

      <section className="mx-auto grid min-h-[72vh] max-w-7xl items-center gap-10 px-5 py-10 lg:grid-cols-[1fr_0.9fr]">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-[rgb(var(--signal-cyan))]">Automation memory for high-mix manufacturing</p>
          <h1 className="mt-5 max-w-4xl text-5xl font-semibold tracking-tight md:text-7xl">Your factory&apos;s task knowledge, captured once and reusable across robots</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[rgb(var(--bone-2))]">Demonstrate a task on video. Aurevix turns it into a reviewable plan, controller code, and a versioned record your engineers and safety owner can approve — portable across robot brands.</p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="gap-2">
              <Link href="/app/teach">{t("landing.cta")} <ArrowRight className="h-4 w-4" /></Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/app">{t("action.openConsole")}</Link>
            </Button>
          </div>
          <div className="mt-10 grid max-w-xl grid-cols-3 gap-4">
            <MiniStat value="Human-gated" label="No deployment without qualified review" />
            <MiniStat value="Cross-vendor" label="UR, ABB, FANUC, KUKA, Techman, Yaskawa workflows" />
            <MiniStat value="Versioned" label="Every task record bound to an approved policy hash" />
          </div>
        </div>
        <div className="rounded-lg border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] p-3 shadow-xl">
          <video src={DEMO_VIDEO_URL} muted autoPlay loop playsInline className="aspect-video w-full rounded-md bg-[rgb(var(--ink-3))] object-cover" />
          <div className="grid grid-cols-3 gap-3 p-3">
            <Feature icon={<GraduationCap />} title="Teach" />
            <Feature icon={<Bot />} title="Deploy" />
            <Feature icon={<Gauge />} title="Measure" />
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-7xl items-center justify-between px-5 py-8 text-sm text-[rgb(var(--bone-2))]">
        <span>© Aurevix 2026</span>
        <span>Privacy • Imprint</span>
      </footer>
    </main>
  );
}

function MiniStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] p-3">
      <p className="font-mono text-lg tabular">{value}</p>
      <p className="mt-1 text-xs text-[rgb(var(--bone-2))]">{label}</p>
    </div>
  );
}

function Feature({ icon, title }: { icon: React.ReactElement; title: string }) {
  return <div className="flex items-center gap-2 rounded-md bg-[rgb(var(--ink-3))] px-3 py-2 text-sm [&>svg]:h-4 [&>svg]:w-4">{icon}{title}</div>;
}
