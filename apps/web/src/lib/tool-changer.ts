export type ToolType = "gripper" | "vacuum" | "screwdriver" | "custom";

export interface ToolStation {
  id: string;
  name: string;
  toolType: ToolType;
  /** Dock waypoint in the robot base frame (meters / radians), matching Waypoint convention. */
  dock: { x: number; y: number; z: number; rz: number };
  lockPort: number;
  unlockPort: number;
  actuationDelayMs: number;
}

export interface ToolChangerConfig {
  enabled: boolean;
  activeStationId: string;
  stations: ToolStation[];
}

export const TOOL_TYPES: Array<{ value: ToolType; label: string }> = [
  { value: "gripper", label: "Parallel gripper" },
  { value: "vacuum", label: "Vacuum cup" },
  { value: "screwdriver", label: "Screwdriver / fastening tool" },
  { value: "custom", label: "Custom tool" },
];

export const DEFAULT_TOOL_STATIONS: ToolStation[] = [
  { id: "station-gripper", name: "Parallel Gripper Dock", toolType: "gripper", dock: { x: 0.55, y: 0.4, z: 0.22, rz: 0 }, lockPort: 4, unlockPort: 5, actuationDelayMs: 600 },
  { id: "station-vacuum", name: "Vacuum Cup Dock", toolType: "vacuum", dock: { x: 0.55, y: -0.4, z: 0.22, rz: 0 }, lockPort: 4, unlockPort: 5, actuationDelayMs: 600 },
  { id: "station-screwdriver", name: "Screwdriver Dock", toolType: "screwdriver", dock: { x: 0.55, y: 0, z: 0.26, rz: 0 }, lockPort: 4, unlockPort: 5, actuationDelayMs: 800 },
];

export const DEFAULT_TOOL_CHANGER_CONFIG: ToolChangerConfig = {
  enabled: false,
  activeStationId: "station-gripper",
  stations: DEFAULT_TOOL_STATIONS,
};

const STORAGE_KEY = "aurevix_tool_changer_config";

export function readToolChangerConfig(): ToolChangerConfig {
  if (typeof window === "undefined") return DEFAULT_TOOL_CHANGER_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_TOOL_CHANGER_CONFIG;
    const parsed = JSON.parse(raw) as Partial<ToolChangerConfig>;
    return {
      ...DEFAULT_TOOL_CHANGER_CONFIG,
      ...parsed,
      stations: parsed.stations?.length ? parsed.stations : DEFAULT_TOOL_STATIONS,
    };
  } catch {
    return DEFAULT_TOOL_CHANGER_CONFIG;
  }
}

export function saveToolChangerConfig(config: ToolChangerConfig) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function getToolStation(config: ToolChangerConfig, id: string | undefined): ToolStation {
  return config.stations.find((station) => station.id === id) ?? config.stations[0];
}

export function nextToolStation(config: ToolChangerConfig, currentId: string): ToolStation {
  const index = config.stations.findIndex((station) => station.id === currentId);
  if (index === -1) return config.stations[0];
  return config.stations[(index + 1) % config.stations.length];
}
