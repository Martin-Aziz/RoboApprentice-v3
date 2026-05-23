import type { DemoLocale } from "@/lib/demo-seed";
import { operatorRateByLocale } from "@/lib/format";

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

export function defaultRoiInputs(locale: DemoLocale): RoiInputs {
  return {
    robots: 3,
    tasksPerRobotPerShift: 240,
    shiftsPerDay: 2,
    operatingDaysPerYear: 250,
    currentProgrammingHours: 3.5,
    aurevixProgrammingHours: 0.3,
    operatorHourlyRate: operatorRateByLocale[locale],
    tasksReprogrammedPerYear: 24,
  };
}

const regionalOpportunityPerRobot: Record<DemoLocale, number> = {
  "en-US": 15000,
  "en-GB": 12200,
  "de-DE": 13500,
  "zh-CN": 113500,
};

export function calculateRoi(inputs: RoiInputs, locale: DemoLocale = "en-US") {
  const hoursSavedPerTask = Math.max(0, inputs.currentProgrammingHours - inputs.aurevixProgrammingHours);
  const annualHoursSaved = hoursSavedPerTask * inputs.tasksReprogrammedPerYear * inputs.robots;
  const directLaborSavings = annualHoursSaved * inputs.operatorHourlyRate;
  const avoidedCommissioningCost = regionalOpportunityPerRobot[locale] * inputs.robots;
  const annualSavings = directLaborSavings + avoidedCommissioningCost;
  const assumedAnnualPrice = 18000 * inputs.robots;
  const paybackMonths = annualSavings > 0 ? (assumedAnnualPrice / annualSavings) * 12 : 0;
  return {
    annualHoursSaved,
    annualSavings,
    paybackMonths,
    threeYearSavings: annualSavings * 3 - assumedAnnualPrice * 3,
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
