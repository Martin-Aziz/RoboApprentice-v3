import type { DemoLocale } from "@/lib/demo-seed";

export interface RoiInputs {
  robots: number;
  tasksPerRobotPerShift: number;
  shiftsPerDay: number;
  operatingDaysPerYear: number;
  currentProgrammingHours: number;
  aurevixProgrammingHours: number;
  operatorHourlyRate: number;
  tasksReprogrammedPerYear: number;
}

export const ROI_DEFAULTS: Record<DemoLocale, { currentTime: string; aurevixTime: string; hourlyRate: string }> = {
  "en-US": { currentTime: "3.5", aurevixTime: "0.3", hourlyRate: "32" },
  "en-GB": { currentTime: "3.5", aurevixTime: "0.3", hourlyRate: "18" },
  "de-DE": { currentTime: "3,5", aurevixTime: "0,3", hourlyRate: "28" },
  "es-ES": { currentTime: "3,5", aurevixTime: "0,3", hourlyRate: "22" },
  "zh-CN": { currentTime: "3.5", aurevixTime: "0.3", hourlyRate: "85" },
  "ja-JP": { currentTime: "3.5", aurevixTime: "0.3", hourlyRate: "2800" },
};

export function parseLocaleNumber(value: string, locale: DemoLocale): number {
  if (["de-DE", "es-ES"].includes(locale)) {
    return parseFloat(value.replace(".", "").replace(",", "."));
  }
  return parseFloat(value.replace(",", ""));
}

export function defaultRoiInputs(locale: DemoLocale): RoiInputs {
  const defaults = ROI_DEFAULTS[locale];
  return {
    robots: 3,
    tasksPerRobotPerShift: 240,
    shiftsPerDay: 2,
    operatingDaysPerYear: 250,
    currentProgrammingHours: parseLocaleNumber(defaults.currentTime, locale),
    aurevixProgrammingHours: parseLocaleNumber(defaults.aurevixTime, locale),
    operatorHourlyRate: parseLocaleNumber(defaults.hourlyRate, locale),
    tasksReprogrammedPerYear: 24,
  };
}

const regionalOpportunityPerRobot: Record<DemoLocale, number> = {
  "en-US": 15000,
  "en-GB": 12200,
  "de-DE": 13500,
  "es-ES": 11800,
  "zh-CN": 113500,
  "ja-JP": 2100000,
};

export function calculateRoi(inputs: RoiInputs, locale: DemoLocale = "en-US") {
  const hoursSavedPerTask = Math.max(0, inputs.currentProgrammingHours - inputs.aurevixProgrammingHours);
  const annualHoursSaved = hoursSavedPerTask * inputs.tasksReprogrammedPerYear * inputs.robots;
  const directLaborSavings = annualHoursSaved * inputs.operatorHourlyRate;
  const avoidedCommissioningCost = regionalOpportunityPerRobot[locale] * inputs.robots;
  const annualSavings = directLaborSavings + avoidedCommissioningCost;
  const aurevixAnnualCost = 6000;
  const paybackMonths = annualSavings > 0 ? (aurevixAnnualCost / annualSavings) * 12 : 0;
  return {
    annualHoursSaved,
    annualSavings,
    paybackMonths,
    threeYearSavings: Math.round(annualSavings) * 3 - aurevixAnnualCost * 3,
    currentCost: inputs.currentProgrammingHours * inputs.tasksReprogrammedPerYear * inputs.robots * inputs.operatorHourlyRate,
    aurevixCost: inputs.aurevixProgrammingHours * inputs.tasksReprogrammedPerYear * inputs.robots * inputs.operatorHourlyRate,
  };
}

export function encodeRoi(inputs: RoiInputs) {
  return btoa(encodeURIComponent(JSON.stringify(inputs)));
}

export function decodeRoi(encoded: string): RoiInputs | null {
  try {
    return JSON.parse(decodeURIComponent(atob(encoded))) as RoiInputs;
  } catch {
    return null;
  }
}
