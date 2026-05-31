"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { DemoLocale } from "@/lib/demo-seed";

export const LOCALES: DemoLocale[] = ["en-US", "en-GB", "de-DE", "es-ES", "zh-CN", "ja-JP"];

type Messages = Record<string, string>;

const translations: Record<DemoLocale, Messages> = {
  "en-US": {
    "nav.overview": "Overview",
    "nav.robots": "Robots",
    "nav.skills": "Skills",
    "nav.teach": "Teach a robot",
    "nav.library": "Skill Library",
    "nav.roi": "ROI Calculator",
    "nav.executions": "Execution history",
    "nav.workcell": "Workcell setup",
    "nav.export": "Code export",
    "nav.settings": "Settings",
    "action.openConsole": "Open Console",
    "action.resetDemo": "Reset workspace",
    "action.exportCode": "Export code",
    "action.calculateRoi": "Calculate ROI",
    "landing.hero": "Reduce robot programming time by 90%",
    "landing.sub": "Show Aurevix one demonstration video and get a deployable robot skill, code, simulation, and ROI story in one flow.",
    "landing.cta": "See it work in 30 seconds",
    "regional.roi": "Annual savings per cell",
    "regional.secondary": "Higher throughput, faster ROI",
    "teach.banner": "",
    "teach.autoplay": "Run workflow",
    "teach.title": "Multi-task Robot",
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
    "nav.executions": "Execution history",
    "nav.workcell": "Workcell setup",
    "nav.export": "Code export",
    "nav.settings": "Settings",
    "action.openConsole": "Open Console",
    "action.resetDemo": "Reset workspace",
    "action.exportCode": "Export code",
    "action.calculateRoi": "Calculate ROI",
    "landing.hero": "Cut robot setup time from days to minutes",
    "landing.sub": "Turn one shop-floor demonstration into robot code, simulation, deployment notes, and a shareable savings case.",
    "landing.cta": "See it work in 30 seconds",
    "regional.roi": "Annual savings per cell",
    "regional.secondary": "Reduce dependency on contract programmers",
    "teach.banner": "",
    "teach.autoplay": "Run workflow",
    "teach.title": "Multi-task Robot",
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
    "nav.executions": "Ausführungshistorie",
    "nav.workcell": "Arbeitszelle",
    "nav.export": "Code-Export",
    "nav.settings": "Einstellungen",
    "action.openConsole": "Konsole öffnen",
    "action.resetDemo": "Workspace zurücksetzen",
    "action.exportCode": "Code exportieren",
    "action.calculateRoi": "ROI berechnen",
    "landing.hero": "EU-Maschinenverordnung 2027 ready - compliance built in",
    "landing.sub": "Eine Werker-Demonstration wird zu Roboterprogramm, Simulation, Inbetriebnahme-Hinweisen und belastbarer Wirtschaftlichkeitsrechnung.",
    "landing.cta": "In 30 Sekunden ansehen",
    "regional.roi": "Jahresersparnis pro Zelle",
    "regional.secondary": "Wissenstransfer absichern bei Personalwechsel",
    "teach.banner": "",
    "teach.autoplay": "Workflow starten",
    "teach.title": "Präzisionsgreifer",
    "teach.result": "Pick Bracket A in 18 Sekunden gelernt",
    "roi.title": "ROI-Analyse für Roboterautomatisierung",
  },
  "es-ES": {
    "nav.overview": "Resumen",
    "nav.robots": "Robots",
    "nav.skills": "Skills",
    "nav.teach": "Enseñar robot",
    "nav.library": "Biblioteca de skills",
    "nav.roi": "Calculadora ROI",
    "nav.executions": "Historial de ejecución",
    "nav.workcell": "Configuración de célula",
    "nav.export": "Exportar código",
    "nav.settings": "Ajustes",
    "action.openConsole": "Abrir consola",
    "action.resetDemo": "Restablecer workspace",
    "action.exportCode": "Exportar código",
    "action.calculateRoi": "Calcular ROI",
    "landing.hero": "Programa robots en minutos, no en días",
    "landing.sub": "Convierte una demostración de planta en código de robot, simulación, notas de despliegue y un caso de ahorro compartible.",
    "landing.cta": "Verlo en 30 segundos",
    "regional.roi": "Ahorro anual por célula",
    "regional.secondary": "Más producción con menos programación manual",
    "teach.banner": "",
    "teach.autoplay": "Ejecutar flujo",
    "teach.title": "Pinza de precisión",
    "teach.result": "Pick Bracket A aprendido en 18 segundos",
    "roi.title": "Análisis ROI de automatización robótica",
  },
  "zh-CN": {
    "nav.overview": "概览",
    "nav.robots": "机器人",
    "nav.skills": "技能",
    "nav.teach": "示教机器人",
    "nav.library": "技能库",
    "nav.roi": "投资回报计算",
    "nav.executions": "执行历史",
    "nav.workcell": "工作站设置",
    "nav.export": "代码导出",
    "nav.settings": "设置",
    "action.openConsole": "打开控制台",
    "action.resetDemo": "重置工作区",
    "action.exportCode": "导出代码",
    "action.calculateRoi": "计算投资回报",
    "landing.hero": "30秒部署，无需编程经验",
    "landing.sub": "上传一段工厂示教视频，即可生成机器人技能、代码、仿真和可分享的节省分析。",
    "landing.cta": "30秒查看效果",
    "regional.roi": "每个工作单元年度节省",
    "regional.secondary": "兼容主流PLC和工业协议",
    "teach.banner": "",
    "teach.autoplay": "自动播放演示",
    "teach.title": "精密夹爪",
    "teach.result": "18秒学会 Pick Bracket A",
    "roi.title": "机器人自动化投资回报分析",
  },
  "ja-JP": {
    "nav.overview": "概要",
    "nav.robots": "ロボット",
    "nav.skills": "スキル",
    "nav.teach": "ロボットを教示",
    "nav.library": "スキルライブラリ",
    "nav.roi": "ROI計算",
    "nav.executions": "実行履歴",
    "nav.workcell": "ワークセル設定",
    "nav.export": "コード出力",
    "nav.settings": "設定",
    "action.openConsole": "コンソールを開く",
    "action.resetDemo": "ワークスペースをリセット",
    "action.exportCode": "コードを出力",
    "action.calculateRoi": "ROIを計算",
    "landing.hero": "30秒でデモから本番展開へ",
    "landing.sub": "現場の実演を、ロボットコード、シミュレーション、展開メモ、共有可能な投資対効果に変換します。",
    "landing.cta": "30秒で確認",
    "regional.roi": "セルあたり年間削減額",
    "regional.secondary": "教示作業を標準化し、立ち上げを短縮",
    "teach.banner": "",
    "teach.autoplay": "フローを再生",
    "teach.title": "精密グリッパー",
    "teach.result": "Pick Bracket Aを18秒で学習",
    "roi.title": "ロボット自動化ROI分析",
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
  if (browser.startsWith("es")) return "es-ES";
  if (browser.startsWith("zh")) return "zh-CN";
  if (browser.startsWith("ja")) return "ja-JP";
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
