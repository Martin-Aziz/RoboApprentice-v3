export type GripperType =
  | "electric_parallel"
  | "pneumatic_parallel"
  | "pneumatic_angular"
  | "vacuum"
  | "magnetic"
  | "custom";

export interface GripperModel {
  id: string;
  name: string;
  type: GripperType;
  description: string;
  controlMethod: string;
  openPort?: number;
  closePort?: number;
  verifyPort?: number;
  springReturn?: boolean;
  actuationDelayMs: number;
  maxPayloadKg: number;
}

export interface WorkcellConfig {
  gripperType: GripperType;
  gripperModelId: string;
  openPort: number;
  closePort: number;
  verifyPort?: number;
  springReturn: boolean;
  actuationDelayMs: number;
  maxPayloadKg: number;
}

export const GRIPPER_TYPES: Array<{ value: GripperType; label: string; description: string; controlMethod: string }> = [
  {
    value: "electric_parallel",
    label: "Electric (Parallel)",
    description: "Robotiq 2F-85, OnRobot RG2, Schunk EGK",
    controlMethod: "Position + force control via serial/Ethernet",
  },
  {
    value: "pneumatic_parallel",
    label: "Pneumatic (Parallel)",
    description: "Schunk PGN-plus, SMC MHZ2, Festo DHWS",
    controlMethod: "Binary digital output (DO0=open, DO1=close)",
  },
  {
    value: "pneumatic_angular",
    label: "Pneumatic (Angular)",
    description: "Schunk PGH, Festo DHWA",
    controlMethod: "Binary digital output, often spring-return",
  },
  {
    value: "vacuum",
    label: "Vacuum / Suction",
    description: "Schmalz SCG, Piab, Coval",
    controlMethod: "Digital output + vacuum sensor feedback",
  },
  {
    value: "magnetic",
    label: "Magnetic",
    description: "Electropermanent magnet grippers",
    controlMethod: "Digital output energise/de-energise",
  },
  {
    value: "custom",
    label: "Custom / Other",
    description: "User-defined control method",
    controlMethod: "User-defined I/O mapping",
  },
];

export const GRIPPER_MODELS: GripperModel[] = [
  { id: "robotiq-2f-85", name: "Robotiq 2F-85", type: "electric_parallel", description: "Adaptive electric parallel gripper", controlMethod: "Modbus/serial position + force", actuationDelayMs: 450, maxPayloadKg: 5 },
  { id: "robotiq-2f-140", name: "Robotiq 2F-140", type: "electric_parallel", description: "Wide-stroke electric parallel gripper", controlMethod: "Modbus/serial position + force", actuationDelayMs: 500, maxPayloadKg: 2.5 },
  { id: "onrobot-rg2", name: "OnRobot RG2", type: "electric_parallel", description: "Collaborative electric gripper", controlMethod: "Ethernet/fieldbus position + force", actuationDelayMs: 450, maxPayloadKg: 2 },
  { id: "onrobot-rg6", name: "OnRobot RG6", type: "electric_parallel", description: "Higher payload collaborative electric gripper", controlMethod: "Ethernet/fieldbus position + force", actuationDelayMs: 500, maxPayloadKg: 6 },
  { id: "schunk-egk-40", name: "Schunk EGK 40", type: "electric_parallel", description: "Industrial electric gripper", controlMethod: "IO-Link/fieldbus position + force", actuationDelayMs: 400, maxPayloadKg: 3 },
  { id: "schunk-egk-50", name: "Schunk EGK 50", type: "electric_parallel", description: "Industrial electric gripper", controlMethod: "IO-Link/fieldbus position + force", actuationDelayMs: 450, maxPayloadKg: 5 },
  { id: "zimmer-gep2000", name: "Zimmer GEP2000", type: "electric_parallel", description: "Electric 2-jaw gripper", controlMethod: "IO-Link position control", actuationDelayMs: 450, maxPayloadKg: 4 },
  { id: "schunk-pgn-plus-80", name: "Schunk PGN-plus 80", type: "pneumatic_parallel", description: "Pneumatic 2-finger parallel gripper", controlMethod: "Double-acting DO valve", openPort: 0, closePort: 1, springReturn: false, actuationDelayMs: 350, maxPayloadKg: 2.8 },
  { id: "schunk-pgn-plus-100", name: "Schunk PGN-plus 100", type: "pneumatic_parallel", description: "Pneumatic 2-finger parallel gripper", controlMethod: "Double-acting DO valve", openPort: 0, closePort: 1, springReturn: false, actuationDelayMs: 400, maxPayloadKg: 4.3 },
  { id: "schunk-pgn-plus-125", name: "Schunk PGN-plus 125", type: "pneumatic_parallel", description: "Pneumatic 2-finger parallel gripper", controlMethod: "Double-acting DO valve", openPort: 0, closePort: 1, springReturn: false, actuationDelayMs: 450, maxPayloadKg: 6 },
  { id: "smc-mhz2-16d", name: "SMC MHZ2-16D", type: "pneumatic_parallel", description: "Compact pneumatic parallel gripper", controlMethod: "Double-acting DO valve", openPort: 0, closePort: 1, springReturn: false, actuationDelayMs: 300, maxPayloadKg: 0.8 },
  { id: "smc-mhz2-25d", name: "SMC MHZ2-25D", type: "pneumatic_parallel", description: "Compact pneumatic parallel gripper", controlMethod: "Double-acting DO valve", openPort: 0, closePort: 1, springReturn: false, actuationDelayMs: 350, maxPayloadKg: 1.8 },
  { id: "festo-dhws-25-a", name: "Festo DHWS-25-A", type: "pneumatic_parallel", description: "Pneumatic parallel gripper", controlMethod: "Double-acting DO valve", openPort: 0, closePort: 1, springReturn: false, actuationDelayMs: 350, maxPayloadKg: 1.6 },
  { id: "festo-dhps-20", name: "Festo DHPS-20", type: "pneumatic_parallel", description: "Pneumatic parallel gripper", controlMethod: "Double-acting DO valve", openPort: 0, closePort: 1, springReturn: false, actuationDelayMs: 350, maxPayloadKg: 1.2 },
  { id: "parker-p5g", name: "Parker P5G", type: "pneumatic_parallel", description: "Industrial pneumatic parallel gripper", controlMethod: "Double-acting DO valve", openPort: 0, closePort: 1, springReturn: false, actuationDelayMs: 400, maxPayloadKg: 2.5 },
  { id: "schunk-pgh-50", name: "Schunk PGH 50", type: "pneumatic_angular", description: "Pneumatic angular gripper", controlMethod: "Single or double-acting DO valve", openPort: 0, closePort: 1, springReturn: true, actuationDelayMs: 350, maxPayloadKg: 1.2 },
  { id: "festo-dhwa-20", name: "Festo DHWA-20", type: "pneumatic_angular", description: "Pneumatic angular gripper", controlMethod: "Single or double-acting DO valve", openPort: 0, closePort: 1, springReturn: true, actuationDelayMs: 300, maxPayloadKg: 0.9 },
  { id: "schmalz-scg-30", name: "Schmalz SCG 30", type: "vacuum", description: "Compact vacuum generator", controlMethod: "DO vacuum + DI vacuum reached", openPort: 0, closePort: 1, verifyPort: 2, springReturn: false, actuationDelayMs: 250, maxPayloadKg: 3 },
  { id: "piab-b15", name: "Piab B15", type: "vacuum", description: "Vacuum ejector", controlMethod: "DO vacuum + DI vacuum reached", openPort: 0, closePort: 1, verifyPort: 2, springReturn: false, actuationDelayMs: 250, maxPayloadKg: 2 },
  { id: "coval-lemcom", name: "Coval LEMCOM", type: "vacuum", description: "Communicating vacuum pump", controlMethod: "DO vacuum + sensor feedback", openPort: 0, closePort: 1, verifyPort: 2, springReturn: false, actuationDelayMs: 250, maxPayloadKg: 2.5 },
  { id: "goudsmit-magswitch", name: "Goudsmit EPM", type: "magnetic", description: "Electropermanent magnetic gripper", controlMethod: "DO energise/de-energise", openPort: 0, closePort: 1, springReturn: false, actuationDelayMs: 500, maxPayloadKg: 8 },
  { id: "custom", name: "Custom", type: "custom", description: "Manual gripper configuration", controlMethod: "User-defined I/O mapping", openPort: 0, closePort: 1, springReturn: false, actuationDelayMs: 350, maxPayloadKg: 1 },
];

export const DEFAULT_WORKCELL_CONFIG: WorkcellConfig = {
  gripperType: "pneumatic_parallel",
  gripperModelId: "schunk-pgn-plus-80",
  openPort: 0,
  closePort: 1,
  springReturn: false,
  actuationDelayMs: 350,
  maxPayloadKg: 2.8,
};

const STORAGE_KEY = "aurevix_workcell_config";

export function isPneumaticGripper(type: GripperType) {
  return type === "pneumatic_parallel" || type === "pneumatic_angular";
}

export function getGripperModel(id: string) {
  return GRIPPER_MODELS.find((model) => model.id === id) ?? GRIPPER_MODELS[0];
}

export function configFromModel(model: GripperModel): WorkcellConfig {
  return {
    gripperType: model.type,
    gripperModelId: model.id,
    openPort: model.openPort ?? 0,
    closePort: model.closePort ?? 1,
    verifyPort: model.verifyPort,
    springReturn: Boolean(model.springReturn),
    actuationDelayMs: model.actuationDelayMs,
    maxPayloadKg: model.maxPayloadKg,
  };
}

export function readWorkcellConfig(): WorkcellConfig {
  if (typeof window === "undefined") return DEFAULT_WORKCELL_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_WORKCELL_CONFIG;
    return { ...DEFAULT_WORKCELL_CONFIG, ...JSON.parse(raw) } as WorkcellConfig;
  } catch {
    return DEFAULT_WORKCELL_CONFIG;
  }
}

export function saveWorkcellConfig(config: WorkcellConfig) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}
