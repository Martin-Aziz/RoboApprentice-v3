"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { DemoLocale } from "@/lib/demo-seed";

export const LOCALES: DemoLocale[] = ["en-US", "en-GB", "de-DE", "zh-CN"];

type Messages = Record<string, string>;

const translations: Record<DemoLocale, Messages> = {
  "en-US": {
    "nav.overview": "Overview",
    "nav.robots": "Robots",
    "nav.skills": "Skills",
    "nav.teach": "Teach a robot",
    "nav.library": "Skill Library",
    "nav.roi": "ROI Calculator",
    "nav.settings": "Settings",
    "action.openConsole": "Open Console",
    "action.resetDemo": "Reset demo",
    "action.exportCode": "Export code",
    "action.calculateRoi": "Calculate ROI",
    "landing.hero": "Reduce robot programming time by 90%",
    "landing.sub": "Show Aurevix one demonstration video and get a deployable robot skill, code, simulation, and ROI story in one flow.",
    "landing.cta": "See it work in 30 seconds",
    "regional.roi": "Annual savings per cell",
    "regional.secondary": "Higher throughput, faster ROI",
    "teach.banner": "You are in demo mode - no customer data is saved.",
    "teach.autoplay": "Auto-play demo",
    "teach.title": "Precision Gripper",
    "teach.result": "Pick Bracket A learned in 18 seconds",
    "roi.title": "Robot Automation ROI Analysis",
  },
  "en-GB": {
    "nav.overview": "Overview",
    "nav.robots": "Robots",
    "nav.skills": "Skills",
    "nav.teach": "Teach a robot",
    "nav.library": "Skill Library",
    "nav.roi": "ROI Calculator",
    "nav.settings": "Settings",
    "action.openConsole": "Open Console",
    "action.resetDemo": "Reset demo",
    "action.exportCode": "Export code",
    "action.calculateRoi": "Calculate ROI",
    "landing.hero": "Cut robot setup time from days to minutes",
    "landing.sub": "Turn one shop-floor demonstration into robot code, simulation, deployment notes, and a shareable savings case.",
    "landing.cta": "See it work in 30 seconds",
    "regional.roi": "Annual savings per cell",
    "regional.secondary": "Reduce dependency on contract programmers",
    "teach.banner": "You are in demo mode - no customer data is saved.",
    "teach.autoplay": "Auto-play demo",
    "teach.title": "Precision Gripper",
    "teach.result": "Pick Bracket A learned in 18 seconds",
    "roi.title": "Robot Automation ROI Analysis",
  },
  "de-DE": {
    "nav.overview": "Überblick",
    "nav.robots": "Roboter",
    "nav.skills": "Skills",
    "nav.teach": "Roboter anlernen",
    "nav.library": "Skill-Bibliothek",
    "nav.roi": "ROI-Rechner",
    "nav.settings": "Einstellungen",
    "action.openConsole": "Konsole öffnen",
    "action.resetDemo": "Demo zurücksetzen",
    "action.exportCode": "Code exportieren",
    "action.calculateRoi": "ROI berechnen",
    "landing.hero": "EU-Maschinenverordnung 2027 ready - compliance built in",
    "landing.sub": "Eine Werker-Demonstration wird zu Roboterprogramm, Simulation, Inbetriebnahme-Hinweisen und belastbarer Wirtschaftlichkeitsrechnung.",
    "landing.cta": "In 30 Sekunden ansehen",
    "regional.roi": "Jahresersparnis pro Zelle",
    "regional.secondary": "Wissenstransfer absichern bei Personalwechsel",
    "teach.banner": "Demo-Modus - es werden keine Kundendaten gespeichert.",
    "teach.autoplay": "Demo automatisch starten",
    "teach.title": "Präzisionsgreifer",
    "teach.result": "Pick Bracket A in 18 Sekunden gelernt",
    "roi.title": "ROI-Analyse für Roboterautomatisierung",
  },
  "zh-CN": {
    "nav.overview": "概览",
    "nav.robots": "机器人",
    "nav.skills": "技能",
    "nav.teach": "示教机器人",
    "nav.library": "技能库",
    "nav.roi": "投资回报计算",
    "nav.settings": "设置",
    "action.openConsole": "打开控制台",
    "action.resetDemo": "重置演示",
    "action.exportCode": "导出代码",
    "action.calculateRoi": "计算投资回报",
    "landing.hero": "30秒部署，无需编程经验",
    "landing.sub": "上传一段工厂示教视频，即可生成机器人技能、代码、仿真和可分享的节省分析。",
    "landing.cta": "30秒查看效果",
    "regional.roi": "每个工作单元年度节省",
    "regional.secondary": "兼容主流PLC和工业协议",
    "teach.banner": "当前为演示模式 - 不保存客户数据。",
    "teach.autoplay": "自动播放演示",
    "teach.title": "精密夹爪",
    "teach.result": "18秒学会 Pick Bracket A",
    "roi.title": "机器人自动化投资回报分析",
  },
};

const LocaleContext = createContext<{
  locale: DemoLocale;
  setLocale: (locale: DemoLocale) => void;
  t: (key: string) => string;
} | null>(null);

function detectLocale(): DemoLocale {
  if (typeof window === "undefined") return "en-US";
  const saved = localStorage.getItem("aurevix_locale") as DemoLocale | null;
  if (saved && LOCALES.includes(saved)) return saved;
  const urlLocale = new URLSearchParams(window.location.search).get("locale") as DemoLocale | null;
  if (urlLocale && LOCALES.includes(urlLocale)) return urlLocale;
  const browser = navigator.language;
  if (browser.startsWith("de")) return "de-DE";
  if (browser.startsWith("zh")) return "zh-CN";
  if (browser === "en-GB") return "en-GB";
  return "en-US";
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<DemoLocale>("en-US");

  useEffect(() => {
    setLocaleState(detectLocale());
  }, []);

  const setLocale = (next: DemoLocale) => {
    localStorage.setItem("aurevix_locale", next);
    setLocaleState(next);
  };

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t: (key: string) => translations[locale][key] ?? translations["en-US"][key] ?? key,
    }),
    [locale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used inside LocaleProvider");
  return ctx;
}

export function useRegionalCopy() {
  const { locale, t } = useLocale();
  return {
    locale,
    primary: t("landing.hero"),
    roiLabel: t("regional.roi"),
    secondary: t("regional.secondary"),
  };
}

