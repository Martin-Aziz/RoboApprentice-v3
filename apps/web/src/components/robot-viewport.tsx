"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { Box, Maximize2, Pause, Play, RotateCcw, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { solveCcdIk, type IKJoint } from "@/lib/ik-solver";
import type { GripperType } from "@/lib/workcell-config";
import type { Pose } from "@/lib/robot-viewport-types";
import type { GripperState, SceneMaterialHint, SceneObject, SceneObjectCategory, TaskPolicy, TaskStep } from "@/lib/types";
import {
  DESTINATION_ROLES,
  WORKPIECE_ROLES,
  classifyDestination,
  classifyWorkpiece,
  extractColorWord,
  findCarryPairs,
  resolveSceneForPolicy,
  sceneObjectForStep,
} from "@/lib/scene-model";
import {
  createBrushedMetalTexture,
  createContactShadow,
  createContactShadowTexture,
  createSceneComposer,
  createStudioBackground,
  createStudioEnvironment,
  type SceneComposer,
} from "@/lib/three-scene-kit";

type RobotType = "ur5e" | "abb_gofa" | "kuka_kr6" | "techman_tm12" | "fanuc_lr_mate" | "yaskawa_gp12";

interface RobotViewportProps {
  robotType: RobotType;
  gripperType?: GripperType;
  policy?: TaskPolicy;
  jointValues?: Record<string, number>;
  showTrajectory?: boolean;
  showCollisionGeometry?: boolean;
  showJointLimits?: boolean;
  showWorkcell?: boolean;
  playbackState?: "idle" | "playing" | "paused";
  playbackSpeed?: number;
  onJointChange?: (jointName: string, value: number) => void;
  onEndEffectorMove?: (pose: Pose) => void;
  className?: string;
}

interface CollisionResult {
  detected: boolean;
  depth: number;
  description: string;
}

interface WorkcellGeometry {
  tableTop: number;
  tableBox: THREE.Box3;
  floorY: number;
}

/** In-flight playback animation: persisted on the runtime ref so effect re-runs (e.g. when
 * `policy` gets a new reference mid-stream) resume the current segment instead of restarting it. */
interface PlaybackAnim {
  fromPose: Pose;
  toPose: Pose;
  toIndex: number;
  segmentSeconds: number;
  segmentElapsed: number;
}

const ROBOTS: Record<RobotType, { label: string }> = {
  ur5e: { label: "Universal Robots UR5e" },
  abb_gofa: { label: "ABB GoFa CRB 15000" },
  kuka_kr6: { label: "KUKA KR 6 R900" },
  techman_tm12: { label: "Techman TM12" },
  fanuc_lr_mate: { label: "FANUC LR Mate 200iD" },
  yaskawa_gp12: { label: "Yaskawa Motoman GP12" },
};

/**
 * Maps a fleet robot's brand/model string to a viewport visual profile.
 * Falls back to the UR5e rig for any unrecognised brand.
 */
export function robotTypeForModel(brand: string, model: string): RobotType {
  const text = `${brand} ${model}`.toLowerCase();
  if (text.includes("kuka")) return "kuka_kr6";
  if (text.includes("techman") || /\btm\d/.test(text)) return "techman_tm12";
  if (text.includes("abb") || text.includes("gofa")) return "abb_gofa";
  if (text.includes("fanuc")) return "fanuc_lr_mate";
  if (text.includes("yaskawa") || text.includes("motoman")) return "yaskawa_gp12";
  return "ur5e";
}

const GRIPPER_BADGES: Record<GripperType, { label: string; className: string }> = {
  electric_parallel: { label: "Electric", className: "border-[rgb(var(--signal-cyan)/0.35)] bg-[rgb(var(--signal-cyan)/0.1)] text-[rgb(var(--signal-cyan))]" },
  pneumatic_parallel: { label: "Pneumatic", className: "border-[rgb(var(--steel))] bg-[rgb(var(--ink-3))] text-[rgb(var(--bone-2))]" },
  pneumatic_angular: { label: "Pneumatic", className: "border-[rgb(var(--steel))] bg-[rgb(var(--ink-3))] text-[rgb(var(--bone-2))]" },
  vacuum: { label: "Vacuum", className: "border-[rgb(var(--signal-amber)/0.35)] bg-[rgb(var(--signal-amber)/0.1)] text-[rgb(var(--signal-amber))]" },
  magnetic: { label: "Magnetic", className: "border-[rgb(var(--signal-green)/0.35)] bg-[rgb(var(--signal-green)/0.1)] text-[rgb(var(--signal-green))]" },
  custom: { label: "Custom", className: "border-[rgb(var(--steel))] bg-[rgb(var(--ink-3))] text-[rgb(var(--bone-2))]" },
};

interface RobotVisualProfile {
  body: number;
  joint: number;
  accent: number;
  gripper: number;
  upperLen: number;
  foreLen: number;
  shoulderHeight: number;
  wristLift: number;
  linkScale: number;
  baseRadius: number;
  gripperStyle: "parallel" | "compact" | "pneumatic";
}

const ROBOT_VISUALS: Record<RobotType, RobotVisualProfile> = {
  ur5e: {
    body: 0xc8c8c8,
    joint: 0x1a1a2e,
    accent: 0x2f75b5,
    gripper: 0x2a2a2a,
    upperLen: 0.425,
    foreLen: 0.3922,
    shoulderHeight: 0.18,
    wristLift: 0.18,
    linkScale: 1,
    baseRadius: 0.085,
    gripperStyle: "parallel",
  },
  abb_gofa: {
    body: 0xf7f7f7,
    joint: 0x30343b,
    accent: 0xd71920,
    gripper: 0x4b5563,
    upperLen: 0.39,
    foreLen: 0.36,
    shoulderHeight: 0.2,
    wristLift: 0.16,
    linkScale: 0.92,
    baseRadius: 0.095,
    gripperStyle: "compact",
  },
  kuka_kr6: {
    body: 0xf97316,
    joint: 0x202020,
    accent: 0xf8fafc,
    gripper: 0x27272a,
    upperLen: 0.46,
    foreLen: 0.39,
    shoulderHeight: 0.22,
    wristLift: 0.19,
    linkScale: 1.12,
    baseRadius: 0.105,
    gripperStyle: "parallel",
  },
  techman_tm12: {
    body: 0xf8fafc,
    joint: 0x334155,
    accent: 0x059669,
    gripper: 0x1f2937,
    upperLen: 0.54,
    foreLen: 0.49,
    shoulderHeight: 0.22,
    wristLift: 0.2,
    linkScale: 1.18,
    baseRadius: 0.1,
    gripperStyle: "pneumatic",
  },
  fanuc_lr_mate: {
    body: 0xfbbf24,
    joint: 0x1c1c1c,
    accent: 0x18181b,
    gripper: 0x27272a,
    upperLen: 0.33,
    foreLen: 0.3,
    shoulderHeight: 0.16,
    wristLift: 0.14,
    linkScale: 0.8,
    baseRadius: 0.07,
    gripperStyle: "compact",
  },
  yaskawa_gp12: {
    body: 0x0033a0,
    joint: 0x1e293b,
    accent: 0xf1f5f9,
    gripper: 0x334155,
    upperLen: 0.48,
    foreLen: 0.44,
    shoulderHeight: 0.24,
    wristLift: 0.2,
    linkScale: 1.15,
    baseRadius: 0.105,
    gripperStyle: "parallel",
  },
};

const TABLE_TOP_Y = 0.75;
const ROBOT_BASE_Y = TABLE_TOP_Y;
const TABLE_THICKNESS = 0.05;
const TABLE_CENTER = { x: 0.35, z: 0 };
const TABLE_SIZE = { x: 0.8, z: 0.6 };
const FLOOR_Y = 0;

const UR5E_JOINTS: IKJoint[] = [
  { name: "shoulder_pan_joint", value: 0, lower: -Math.PI * 2, upper: Math.PI * 2 },
  { name: "shoulder_lift_joint", value: 0, lower: -Math.PI, upper: Math.PI },
  { name: "elbow_joint", value: 0, lower: -Math.PI, upper: Math.PI },
  { name: "wrist_1_joint", value: 0, lower: -Math.PI * 2, upper: Math.PI * 2 },
  { name: "wrist_2_joint", value: 0, lower: -Math.PI * 2, upper: Math.PI * 2 },
  { name: "wrist_3_joint", value: 0, lower: -Math.PI * 2, upper: Math.PI * 2 },
];

function clamp(value: number, lower: number, upper: number) {
  return Math.max(lower, Math.min(upper, value));
}

function waypointToPose(policy: TaskPolicy | undefined, index: number): Pose {
  const target = policy?.steps[index]?.target ?? { x: 0.36, y: 0, z: 0.34, rx: 0, ry: Math.PI / 2, rz: 0 };
  return {
    position: { x: target.x, y: target.y, z: target.z },
    rotation: { x: target.rx ?? 0, y: target.ry ?? Math.PI / 2, z: target.rz ?? 0 },
  };
}

function sceneVector(pose: Pose) {
  return new THREE.Vector3(pose.position.x, ROBOT_BASE_Y + pose.position.z, -pose.position.y);
}

function poseForIk(pose: Pose): Pose {
  return pose;
}

/** Smallest signed angular difference from `from` to `to`, wrapped to [-PI, PI]. */
function shortestAngleDelta(from: number, to: number) {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  else if (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

/** Maps a step's gripper state to a finger-spread fraction: 1 = fully open, 0 = closed around a part. */
function gripperOpenAmount(state: GripperState | undefined) {
  return state === "closed" ? 0 : 1;
}

/** Eases t in [0,1] with a smoothstep curve so motion accelerates then decelerates. */
function smoothstep(t: number) {
  const clamped = Math.min(Math.max(t, 0), 1);
  return clamped * clamped * (3 - 2 * clamped);
}

/** Interpolates between two poses, taking the shortest path for each rotation axis. */
function lerpPose(from: Pose, to: Pose, t: number): Pose {
  return {
    position: {
      x: from.position.x + (to.position.x - from.position.x) * t,
      y: from.position.y + (to.position.y - from.position.y) * t,
      z: from.position.z + (to.position.z - from.position.z) * t,
    },
    rotation: {
      x: from.rotation.x + shortestAngleDelta(from.rotation.x, to.rotation.x) * t,
      y: from.rotation.y + shortestAngleDelta(from.rotation.y, to.rotation.y) * t,
      z: from.rotation.z + shortestAngleDelta(from.rotation.z, to.rotation.z) * t,
    },
  };
}

/**
 * How long an in-between motion should take, based on the travel distance and the
 * destination step's programmed speed -- so careful approach/grip moves play out
 * slower than fast free-space transit, like the real demonstration. "wait" and
 * "inspect" steps instead dwell for their own programmed duration, since they
 * represent the robot holding position rather than travelling somewhere.
 */
function segmentDurationSeconds(from: Pose, to: Pose, policy: TaskPolicy | undefined, toIndex: number, playbackSpeed: number) {
  const step = policy?.steps[toIndex];
  if (step?.action === "wait" || step?.action === "inspect") {
    return clamp(step.duration, 1, 6) / Math.max(playbackSpeed, 0.1);
  }
  const dx = to.position.x - from.position.x;
  const dy = to.position.y - from.position.y;
  const dz = to.position.z - from.position.z;
  const linear = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const angular =
    Math.abs(shortestAngleDelta(from.rotation.x, to.rotation.x)) +
    Math.abs(shortestAngleDelta(from.rotation.y, to.rotation.y)) +
    Math.abs(shortestAngleDelta(from.rotation.z, to.rotation.z));
  const speed = Math.max(policy?.steps[toIndex]?.speed ?? 0.15, 0.03);
  const seconds = Math.max(linear / speed, angular / (speed * 4));
  return clamp(seconds, 0.5, 3.5) / Math.max(playbackSpeed, 0.1);
}

/** A prop mesh assigned to one pick-and-place pair, tracking its pickup/drop-off points. */
interface CarrySlot {
  pickIndex: number;
  placeIndex: number;
  propIndex: number;
  home: THREE.Vector3;
  place: THREE.Vector3;
  carrying: boolean;
}

/** Accent colours used to visually distinguish sequential pick-and-place pairs. */
const CARRY_PROP_COLORS = [0x0284c7, 0xd97706, 0x7c3aed, 0x059669];

// ---------------------------------------------------------------------------
// Procedural scene-object meshes
//
// The renderer no longer hardcodes one workpiece and four destination shapes.
// It builds a proxy mesh per interpreted `SceneObject` — category picks the
// geometry recipe, color/material/size hints refine it, and everything
// degrades to a neutral labelled proxy when hints are missing.
// ---------------------------------------------------------------------------

const COLOR_HEX: Record<string, number> = {
  black: 0x24282e, white: 0xe8eaee, gray: 0x6b7280, grey: 0x6b7280, silver: 0xb9c2cc,
  red: 0xb91c1c, orange: 0xd97706, amber: 0xd97706, yellow: 0xca8a04, green: 0x15803d,
  teal: 0x0f766e, cyan: 0x0e7490, blue: 0x1d4ed8, navy: 0x1e3a8a, purple: 0x6d28d9,
  violet: 0x6d28d9, brown: 0x8a5a3b, tan: 0xb08968, beige: 0xcfc4ae,
};

/** Resolves a scene-model color hint ("gray", "dark blue", "#3355aa") to a hex color. */
function parseColorHint(hint?: string): number | null {
  if (!hint) return null;
  const lower = hint.toLowerCase().trim();
  const hexMatch = lower.match(/#([0-9a-f]{6})\b/);
  if (hexMatch) return parseInt(hexMatch[1], 16);
  for (const [name, hex] of Object.entries(COLOR_HEX)) {
    if (new RegExp(`\\b${name}\\b`).test(lower)) return hex;
  }
  return null;
}

interface CategoryStyle {
  color: number;
  material: SceneMaterialHint;
  /** Default bounding size in meters, robot frame (z = vertical height). */
  size: { x: number; y: number; z: number };
}

const CATEGORY_STYLE: Record<SceneObjectCategory, CategoryStyle> = {
  tote: { color: 0x2563a8, material: "plastic", size: { x: 0.2, y: 0.15, z: 0.09 } },
  bin: { color: 0x525c66, material: "plastic", size: { x: 0.17, y: 0.13, z: 0.08 } },
  tray: { color: 0x8a929c, material: "plastic", size: { x: 0.2, y: 0.15, z: 0.03 } },
  surface: { color: 0x1f2937, material: "rubber", size: { x: 0.18, y: 0.13, z: 0.012 } },
  fixture: { color: 0x7c8896, material: "metal", size: { x: 0.12, y: 0.13, z: 0.08 } },
  station: { color: 0x8b95a1, material: "metal", size: { x: 0.15, y: 0.15, z: 0.02 } },
  box: { color: 0xb08968, material: "cardboard", size: { x: 0.1, y: 0.08, z: 0.08 } },
  cylinder: { color: 0x9aa4af, material: "metal", size: { x: 0.05, y: 0.05, z: 0.09 } },
  bracket: { color: 0xb9c2cc, material: "metal", size: { x: 0.09, y: 0.06, z: 0.05 } },
  machined_part: { color: 0xb9c2cc, material: "metal", size: { x: 0.074, y: 0.05, z: 0.07 } },
  unknown: { color: 0x94a3b8, material: "unknown", size: { x: 0.08, y: 0.08, z: 0.06 } },
};

function sceneObjectMaterial(color: number, hint: SceneMaterialHint, metalTexture: THREE.Texture): THREE.MeshStandardMaterial {
  switch (hint) {
    case "metal":
      return new THREE.MeshStandardMaterial({ color, metalness: 0.78, roughness: 0.35, roughnessMap: metalTexture, envMapIntensity: 1.05 });
    case "rubber":
      return new THREE.MeshStandardMaterial({ color, metalness: 0.02, roughness: 0.95 });
    case "wood":
      return new THREE.MeshStandardMaterial({ color, metalness: 0, roughness: 0.72 });
    case "cardboard":
      return new THREE.MeshStandardMaterial({ color, metalness: 0, roughness: 0.85 });
    case "plastic":
      return new THREE.MeshStandardMaterial({ color, metalness: 0.06, roughness: 0.55 });
    default:
      return new THREE.MeshStandardMaterial({ color, metalness: 0.15, roughness: 0.6 });
  }
}

function accentMaterial(accent: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: accent, metalness: 0.2, roughness: 0.5, emissive: accent, emissiveIntensity: 0.14 });
}

/** Scene-frame footprint/height for an object: robot-frame x/y → width/depth, z → height. */
function resolveObjectSize(
  object: SceneObject,
  bounds: { min: number; max: number; hMin: number; hMax: number },
): { w: number; d: number; h: number } {
  const style = CATEGORY_STYLE[object.category] ?? CATEGORY_STYLE.unknown;
  const size = object.sizeHint ?? style.size;
  const clampAxis = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
  return {
    w: clampAxis(size.x, bounds.min, bounds.max),
    d: clampAxis(size.y, bounds.min, bounds.max),
    h: clampAxis(size.z, bounds.hMin, bounds.hMax),
  };
}

function shadowed<T extends THREE.Mesh>(mesh: T): T {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Open-top container (tote/bin/tray): floor, four walls, rim lip, accent label. */
function buildContainerMesh(w: number, d: number, h: number, mat: THREE.Material, accent: number): THREE.Group {
  const group = new THREE.Group();
  const wall = Math.min(0.012, w * 0.08);
  const floorThickness = Math.min(0.012, h * 0.3);

  const floor = shadowed(new THREE.Mesh(new THREE.BoxGeometry(w, floorThickness, d), mat));
  floor.position.y = floorThickness / 2;
  group.add(floor);

  for (const sign of [-1, 1]) {
    const side = shadowed(new THREE.Mesh(new THREE.BoxGeometry(w, h, wall), mat));
    side.position.set(0, h / 2, sign * (d / 2 - wall / 2));
    group.add(side);
    const end = shadowed(new THREE.Mesh(new THREE.BoxGeometry(wall, h, d), mat));
    end.position.set(sign * (w / 2 - wall / 2), h / 2, 0);
    group.add(end);
  }

  // Rim lip: containers read as injection-moulded totes, not five planes.
  const rim = shadowed(new THREE.Mesh(new RoundedBoxGeometry(w + wall, wall * 0.9, d + wall, 2, wall * 0.3), mat));
  rim.position.y = h - wall * 0.45;
  group.add(rim);

  const label = new THREE.Mesh(new THREE.BoxGeometry(Math.min(0.06, w * 0.4), 0.003, Math.min(0.026, d * 0.25)), accentMaterial(accent));
  label.position.set(0, h + 0.002, -(d / 2 - wall / 2));
  group.add(label);
  return group;
}

/** Dark inspection pad with scan lines and corner registration marks. */
function buildInspectionSurfaceMesh(w: number, d: number, h: number, mat: THREE.Material, accent: number): THREE.Group {
  const group = new THREE.Group();
  const base = shadowed(new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(0.004, h * 0.3)), mat));
  base.position.y = h / 2;
  group.add(base);

  const lineMat = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.7 });
  for (const fraction of [-0.28, 0, 0.28]) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(w * 0.78, 0.002, 0.003), lineMat);
    line.position.set(0, h + 0.002, fraction * d);
    group.add(line);
  }
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const mark = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.002, 0.012), lineMat);
      mark.position.set(sx * (w / 2 - 0.014), h + 0.002, sz * (d / 2 - 0.014));
      group.add(mark);
    }
  }
  return group;
}

/** Slotted fixture: base plate, cradle rails, locating pins, accent inlay. */
function buildFixtureMesh(w: number, d: number, h: number, mat: THREE.Material, accent: number): THREE.Group {
  const group = new THREE.Group();
  const baseH = Math.min(0.028, h * 0.45);
  const base = shadowed(new THREE.Mesh(new RoundedBoxGeometry(w, baseH, d, 2, 0.004), mat));
  base.position.y = baseH / 2;
  group.add(base);

  const railH = Math.max(h - baseH, 0.02);
  for (const sign of [-1, 1]) {
    const rail = shadowed(new THREE.Mesh(new THREE.BoxGeometry(w, railH, Math.min(0.022, d * 0.18)), mat));
    rail.position.set(0, baseH + railH / 2, sign * d * 0.34);
    group.add(rail);
  }

  for (const sign of [-1, 1]) {
    const pin = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.02, 12), mat));
    pin.position.set(sign * w * 0.32, baseH + 0.01, 0);
    group.add(pin);
  }

  const inlay = new THREE.Mesh(new THREE.BoxGeometry(w, 0.004, d * 0.38), accentMaterial(accent));
  inlay.position.y = baseH + 0.002;
  inlay.receiveShadow = true;
  group.add(inlay);
  group.userData.surfaceY = baseH;
  return group;
}

/** Final placement station: chamfered base plate, nest ring, locating pegs. */
function buildStationMesh(w: number, d: number, h: number, mat: THREE.Material, accent: number): THREE.Group {
  const group = new THREE.Group();
  const radius = Math.max(w, d) / 2;
  const base = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.94, radius, h, 36), mat));
  base.position.y = h / 2;
  group.add(base);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.62, 0.004, 8, 36), accentMaterial(accent));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = h + 0.002;
  group.add(ring);

  for (const sign of [-1, 1]) {
    const peg = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.05, 16), mat));
    peg.position.set(sign * radius * 0.5, h + 0.025, 0);
    group.add(peg);
  }
  return group;
}

/** Closed carton/case with a tape stripe. */
function buildBoxMesh(w: number, d: number, h: number, mat: THREE.Material, accent: number): THREE.Group {
  const group = new THREE.Group();
  const body = shadowed(new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(0.006, h * 0.12)), mat));
  body.position.y = h / 2;
  group.add(body);
  const tape = new THREE.Mesh(new THREE.BoxGeometry(Math.min(0.03, w * 0.3), 0.002, d + 0.002), accentMaterial(accent));
  tape.position.y = h + 0.001;
  group.add(tape);
  return group;
}

/** Standing cylindrical part with a top chamfer cap. */
function buildCylinderMesh(w: number, d: number, h: number, mat: THREE.Material): THREE.Group {
  const group = new THREE.Group();
  const radius = Math.max(w, d) / 2;
  const body = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.96, radius, h, 28), mat));
  body.position.y = h / 2;
  group.add(body);
  const cap = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.7, radius * 0.9, h * 0.08, 28), mat));
  cap.position.y = h + h * 0.04;
  group.add(cap);
  return group;
}

/** L-shaped bracket with bolt bosses. */
function buildBracketMesh(w: number, d: number, h: number, mat: THREE.Material, accent: number): THREE.Group {
  const group = new THREE.Group();
  const flangeH = Math.min(0.016, h * 0.35);
  const base = shadowed(new THREE.Mesh(new THREE.BoxGeometry(w, flangeH, d), mat));
  base.position.y = flangeH / 2;
  group.add(base);
  const upright = shadowed(new THREE.Mesh(new THREE.BoxGeometry(w * 0.22, h, d), mat));
  upright.position.set(-w / 2 + w * 0.11, h / 2, 0);
  group.add(upright);
  const boltMat = accentMaterial(accent);
  for (const sign of [-1, 1]) {
    const boss = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, flangeH + 0.004, 12), boltMat));
    boss.position.set(w * 0.2, flangeH / 2, sign * d * 0.28);
    group.add(boss);
  }
  return group;
}

/** Machined block: body, chamfered shoulder, accent locating boss. */
function buildMachinedPartMesh(w: number, d: number, h: number, mat: THREE.Material, accent: number): THREE.Group {
  const group = new THREE.Group();
  const body = shadowed(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat));
  body.position.y = h / 2;
  group.add(body);
  const shoulder = shadowed(new THREE.Mesh(new THREE.BoxGeometry(w * 1.1, h * 0.2, d * 1.14), mat));
  shoulder.position.y = h * 0.1;
  group.add(shoulder);
  const boss = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(Math.min(0.013, w * 0.2), Math.min(0.013, w * 0.2), 0.016, 24), accentMaterial(accent)));
  boss.position.y = h + 0.008;
  group.add(boss);
  return group;
}

/** V-block fixture: base plate with two angled cheeks forming a V cradle. */
function buildVBlockMesh(w: number, d: number, h: number, mat: THREE.Material, accent: number): THREE.Group {
  const group = new THREE.Group();
  const baseH = Math.min(0.02, h * 0.35);
  const base = shadowed(new THREE.Mesh(new THREE.BoxGeometry(w, baseH, d), mat));
  base.position.y = baseH / 2;
  group.add(base);
  const cheekH = Math.max(h - baseH, 0.03);
  for (const sign of [-1, 1]) {
    const cheek = shadowed(new THREE.Mesh(new THREE.BoxGeometry(w, cheekH, d * 0.42), mat));
    cheek.position.set(0, baseH + cheekH / 2 - (cheekH / 2) * 0.3, sign * d * 0.26);
    cheek.rotation.x = sign * -Math.PI / 5;
    group.add(cheek);
  }
  const inlay = new THREE.Mesh(new THREE.BoxGeometry(w * 0.8, 0.003, 0.006), accentMaterial(accent));
  inlay.position.y = baseH + 0.002;
  group.add(inlay);
  group.userData.surfaceY = baseH + cheekH * 0.25;
  return group;
}

/** Linear rail fixture: base plate, two guide rails, end stops. */
function buildRailFixtureMesh(w: number, d: number, h: number, mat: THREE.Material, accent: number): THREE.Group {
  const group = new THREE.Group();
  const baseH = Math.min(0.014, h * 0.3);
  const base = shadowed(new THREE.Mesh(new THREE.BoxGeometry(w, baseH, d), mat));
  base.position.y = baseH / 2;
  group.add(base);
  const railH = Math.max(h - baseH, 0.015);
  for (const sign of [-1, 1]) {
    const rail = shadowed(new THREE.Mesh(new THREE.BoxGeometry(w * 0.96, railH, Math.min(0.012, d * 0.14)), mat));
    rail.position.set(0, baseH + railH / 2, sign * d * 0.3);
    group.add(rail);
  }
  for (const sign of [-1, 1]) {
    const stop = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.012, railH * 1.3, d * 0.72), accentMaterial(accent)));
    stop.position.set(sign * (w / 2 - 0.008), baseH + railH * 0.65, 0);
    group.add(stop);
  }
  group.userData.surfaceY = baseH;
  return group;
}

/** Peg fixture: base plate with a grid of locating pegs. */
function buildPegFixtureMesh(w: number, d: number, h: number, mat: THREE.Material, accent: number): THREE.Group {
  const group = new THREE.Group();
  const baseH = Math.min(0.016, h * 0.35);
  const base = shadowed(new THREE.Mesh(new RoundedBoxGeometry(w, baseH, d, 2, 0.003), mat));
  base.position.y = baseH / 2;
  group.add(base);
  const pegH = Math.max(h - baseH, 0.025);
  const pegMat = accentMaterial(accent);
  for (const fx of [-0.3, 0, 0.3]) {
    for (const fz of [-0.28, 0.28]) {
      const peg = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.006, pegH, 12), fx === 0 ? pegMat : mat));
      peg.position.set(fx * w, baseH + pegH / 2, fz * d);
      group.add(peg);
    }
  }
  group.userData.surfaceY = baseH;
  return group;
}

/** Short conveyor segment: side frames, rollers, and legs. */
function buildConveyorMesh(w: number, d: number, h: number, mat: THREE.Material, accent: number): THREE.Group {
  const group = new THREE.Group();
  const frameH = Math.min(0.02, h * 0.4);
  const bedY = Math.max(h - frameH, 0.02);
  for (const sign of [-1, 1]) {
    const frame = shadowed(new THREE.Mesh(new THREE.BoxGeometry(w, frameH, Math.min(0.014, d * 0.12)), mat));
    frame.position.set(0, bedY + frameH / 2, sign * (d / 2 - 0.007));
    group.add(frame);
    const leg = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.014, bedY, 0.014), mat));
    leg.position.set(sign * (w / 2 - 0.02), bedY / 2, sign * (d / 2 - 0.014));
    group.add(leg);
  }
  const rollerCount = Math.max(3, Math.floor(w / 0.035));
  const rollerMat = accentMaterial(accent);
  for (let i = 0; i < rollerCount; i += 1) {
    const roller = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, d * 0.82, 12), i === 0 ? rollerMat : mat));
    roller.rotation.x = Math.PI / 2;
    roller.position.set(-w / 2 + (w / (rollerCount - 1)) * i, bedY + frameH * 0.6, 0);
    group.add(roller);
  }
  group.userData.surfaceY = bedY + frameH * 0.6 + 0.008;
  return group;
}

/** Miniature pallet: deck boards over stringers. */
function buildPalletMesh(w: number, d: number, h: number, mat: THREE.Material): THREE.Group {
  const group = new THREE.Group();
  const stringerH = Math.min(h * 0.55, 0.03);
  const deckH = Math.min(h - stringerH, 0.008);
  for (const fz of [-0.4, 0, 0.4]) {
    const stringer = shadowed(new THREE.Mesh(new THREE.BoxGeometry(w, stringerH, Math.min(0.016, d * 0.14)), mat));
    stringer.position.set(0, stringerH / 2, fz * d);
    group.add(stringer);
  }
  const boardCount = 5;
  for (let i = 0; i < boardCount; i += 1) {
    const board = shadowed(new THREE.Mesh(new THREE.BoxGeometry(w / boardCount * 0.82, deckH, d), mat));
    board.position.set(-w / 2 + (w / boardCount) * (i + 0.5), stringerH + deckH / 2, 0);
    group.add(board);
  }
  group.userData.surfaceY = stringerH + deckH;
  return group;
}

/** Stack of two/three offset closed boxes. */
function buildBoxStackMesh(w: number, d: number, h: number, mat: THREE.Material, accent: number): THREE.Group {
  const group = new THREE.Group();
  const layers = h > 0.12 ? 3 : 2;
  const layerH = h / layers;
  for (let i = 0; i < layers; i += 1) {
    const shrink = 1 - i * 0.08;
    const box = shadowed(new THREE.Mesh(new RoundedBoxGeometry(w * shrink, layerH * 0.94, d * shrink, 2, 0.004), mat));
    box.position.set((i % 2 ? -1 : 1) * w * 0.03, layerH * (i + 0.5), (i % 2 ? 1 : -1) * d * 0.02);
    group.add(box);
  }
  const tape = new THREE.Mesh(new THREE.BoxGeometry(Math.min(0.024, w * 0.25), 0.002, d * (1 - (layers - 1) * 0.08)), accentMaterial(accent));
  tape.position.y = h + 0.001;
  group.add(tape);
  group.userData.surfaceY = h;
  return group;
}

/** Cylinder lying on its side (shaft/tube/roller at rest). */
function buildHorizontalCylinderMesh(w: number, d: number, h: number, mat: THREE.Material): THREE.Group {
  const group = new THREE.Group();
  const radius = Math.max(Math.min(d, h) / 2, 0.008);
  const length = Math.max(w, radius * 2.5);
  const body = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 24), mat));
  body.rotation.z = Math.PI / 2;
  body.position.y = radius;
  group.add(body);
  group.userData.surfaceY = radius * 2;
  return group;
}

/** Flat sheet/panel with slightly raised edge so it reads as a plate, not a decal. */
function buildFlatPanelMesh(w: number, d: number, h: number, mat: THREE.Material, accent: number): THREE.Group {
  const group = new THREE.Group();
  const thickness = Math.min(h, 0.015);
  const sheet = shadowed(new THREE.Mesh(new RoundedBoxGeometry(w, thickness, d, 2, thickness * 0.3), mat));
  sheet.position.y = thickness / 2;
  group.add(sheet);
  const corner = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.002, 0.012), accentMaterial(accent));
  corner.position.set(w / 2 - 0.012, thickness + 0.001, d / 2 - 0.012);
  group.add(corner);
  group.userData.surfaceY = thickness;
  return group;
}

/** Irregular unknown part: three intersecting offset blocks, deliberately asymmetric. */
function buildIrregularPartMesh(w: number, d: number, h: number, mat: THREE.Material, accent: number): THREE.Group {
  const group = new THREE.Group();
  const main = shadowed(new THREE.Mesh(new RoundedBoxGeometry(w * 0.8, h * 0.7, d * 0.9, 2, 0.004), mat));
  main.position.set(-w * 0.06, h * 0.35, 0);
  group.add(main);
  const lobe = shadowed(new THREE.Mesh(new RoundedBoxGeometry(w * 0.45, h * 0.95, d * 0.5, 2, 0.004), mat));
  lobe.position.set(w * 0.24, h * 0.48, -d * 0.14);
  lobe.rotation.y = 0.35;
  group.add(lobe);
  const nub = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(Math.min(w, d) * 0.14, Math.min(w, d) * 0.16, h * 0.4, 14), accentMaterial(accent)));
  nub.position.set(-w * 0.2, h * 0.85, d * 0.18);
  group.add(nub);
  group.userData.surfaceY = h;
  return group;
}

// Fidelity/confidence overlay colours for the 3D scene (Three.js material
// colours, not UI CSS): confirmed evidence, proxy geometry, needs-review.
const FIDELITY_RING_COLORS = { confirmed: 0x059669, proxy: 0x94a3b8, review: 0xd97706 } as const;

type FidelityState = keyof typeof FIDELITY_RING_COLORS;

/** Visual trust state of an object: drives the subtle base-ring overlay. */
function fidelityStateFor(object: SceneObject): FidelityState {
  if (object.reviewRequiredReason || object.confidence < 0.45) return "review";
  const grounded = Boolean(object.detectionLabel || object.trackId || object.maskId);
  if (grounded && object.confidence >= 0.6 && object.visualFidelity !== "proxy") return "confirmed";
  return "proxy";
}

/** Subtle flat ring under an object's footprint indicating evidence fidelity. */
function buildFidelityRing(object: SceneObject, w: number, d: number): THREE.Mesh {
  const state = fidelityStateFor(object);
  const radius = Math.max(w, d) * 0.62;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(radius * 0.9, radius, 36),
    new THREE.MeshBasicMaterial({
      color: FIDELITY_RING_COLORS[state],
      transparent: true,
      opacity: state === "confirmed" ? 0.4 : state === "review" ? 0.5 : 0.22,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.0015;
  ring.name = "fidelityRing";
  return ring;
}

/**
 * Refined shape family for an object, chosen from its label text and size
 * proportions when the coarse category is ambiguous. Returns null to use the
 * category's default recipe.
 */
function detectShapeFamily(object: SceneObject, size: { w: number; d: number; h: number }):
  | "v_block" | "rail" | "peg" | "conveyor" | "pallet" | "box_stack"
  | "horizontal_cylinder" | "flat_panel" | "irregular" | null {
  const text = `${object.label} ${object.detectionLabel ?? ""}`.toLowerCase();
  if (/\bv[- ]?block\b/.test(text)) return "v_block";
  if (/\brail\b/.test(text)) return "rail";
  if (/\bpeg\b/.test(text)) return "peg";
  if (/\b(conveyor|belt)\b/.test(text)) return "conveyor";
  if (/\bpallet\b/.test(text)) return "pallet";
  if (/\bstack\b/.test(text)) return "box_stack";
  if (/\b(sheet|panel|plate|pcb|board)\b/.test(text)) return "flat_panel";
  if (object.category === "cylinder" && size.w > size.h * 1.6) return "horizontal_cylinder";
  if (object.category === "unknown" && /\b(part|casting|housing|component)\b/.test(text)) return "irregular";
  if (object.category === "box" && size.h > Math.max(size.w, size.d) * 1.5) return "box_stack";
  return null;
}

/** Neutral proxy for unclassified objects: rounded block plus accent ring. */
function buildUnknownMesh(w: number, d: number, h: number, mat: THREE.Material, accent: number): THREE.Group {
  const group = new THREE.Group();
  const body = shadowed(new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(0.008, h * 0.2)), mat));
  body.position.y = h / 2;
  group.add(body);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(Math.min(w, d) * 0.28, 0.003, 8, 28), accentMaterial(accent));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = h + 0.003;
  group.add(ring);
  return group;
}

interface BuiltSceneMesh {
  group: THREE.Group;
  /** Local height (above the group's footprint origin) where a placed part rests. */
  surfaceY: number;
}

/**
 * Builds a procedural proxy mesh for an interpreted scene object. The group's
 * origin sits at the object's footprint centre on the supporting surface, and
 * `surfaceY` reports where a carried part comes to rest on/in this object.
 */
function buildSceneObjectMesh(object: SceneObject, accent: number, metalTexture: THREE.Texture): BuiltSceneMesh {
  const style = CATEGORY_STYLE[object.category] ?? CATEGORY_STYLE.unknown;
  const color = parseColorHint(object.colorHint) ?? style.color;
  const materialHint = object.materialHint && object.materialHint !== "unknown" ? object.materialHint : style.material;
  const { w, d, h } = resolveObjectSize(object, { min: 0.05, max: 0.4, hMin: 0.008, hMax: 0.3 });
  const mat = sceneObjectMaterial(color, materialHint, metalTexture);

  const withRing = (group: THREE.Group, surfaceY: number): BuiltSceneMesh => {
    group.add(buildFidelityRing(object, w, d));
    return { group, surfaceY };
  };

  // Refined shape families (v-block, rail, conveyor, pallet, ...) override the
  // coarse category recipe when the label/proportions identify one.
  const family = detectShapeFamily(object, { w, d, h });
  if (family) {
    const builders: Record<NonNullable<typeof family>, () => THREE.Group> = {
      v_block: () => buildVBlockMesh(w, d, h, mat, accent),
      rail: () => buildRailFixtureMesh(w, d, h, mat, accent),
      peg: () => buildPegFixtureMesh(w, d, h, mat, accent),
      conveyor: () => buildConveyorMesh(w, d, Math.max(h, 0.05), mat, accent),
      pallet: () => buildPalletMesh(w, d, Math.min(h, 0.05), mat),
      box_stack: () => buildBoxStackMesh(w, d, h, mat, accent),
      horizontal_cylinder: () => buildHorizontalCylinderMesh(w, d, h, mat),
      flat_panel: () => buildFlatPanelMesh(w, d, h, mat, accent),
      irregular: () => buildIrregularPartMesh(w, d, h, mat, accent),
    };
    const group = builders[family]();
    return withRing(group, (group.userData.surfaceY as number | undefined) ?? h);
  }

  switch (object.category) {
    case "tote":
    case "bin":
    case "tray": {
      const group = buildContainerMesh(w, d, h, mat, accent);
      return withRing(group, Math.min(0.012, h * 0.3));
    }
    case "surface":
      return withRing(buildInspectionSurfaceMesh(w, d, h, mat, accent), h);
    case "fixture": {
      const group = buildFixtureMesh(w, d, h, mat, accent);
      return withRing(group, (group.userData.surfaceY as number) ?? h * 0.4);
    }
    case "station":
      return withRing(buildStationMesh(w, d, Math.min(h, 0.03), mat, accent), Math.min(h, 0.03));
    case "box":
      return withRing(buildBoxMesh(w, d, h, mat, accent), h);
    case "cylinder":
      return withRing(buildCylinderMesh(w, d, h, mat), h);
    case "bracket":
      return withRing(buildBracketMesh(w, d, h, mat, accent), Math.min(0.016, h * 0.35));
    case "machined_part":
      return withRing(buildMachinedPartMesh(w, d, h, mat, accent), h);
    default:
      return withRing(buildUnknownMesh(w, d, h, mat, accent), h);
  }
}

/**
 * Builds the mesh for a carried workpiece from its interpreted scene object.
 * Origin is at the part's volumetric centre (so gripper attach logic and yaw
 * rotation behave like a plain mesh); returns the half-height for resting the
 * part on surfaces.
 */
function buildCarriedPartMesh(object: SceneObject, accent: number, metalTexture: THREE.Texture): { group: THREE.Group; halfHeight: number } {
  const style = CATEGORY_STYLE[object.category] ?? CATEGORY_STYLE.unknown;
  const color = parseColorHint(object.colorHint) ?? style.color;
  const materialHint = object.materialHint && object.materialHint !== "unknown" ? object.materialHint : style.material;
  const { w, d, h } = resolveObjectSize(object, { min: 0.02, max: 0.16, hMin: 0.015, hMax: 0.16 });
  const mat = sceneObjectMaterial(color, materialHint, metalTexture);

  let footprintGroup: THREE.Group;
  switch (object.category) {
    case "box":
      footprintGroup = buildBoxMesh(w, d, h, mat, accent);
      break;
    case "cylinder":
      footprintGroup = buildCylinderMesh(w, d, h, mat);
      break;
    case "bracket":
      footprintGroup = buildBracketMesh(w, d, h, mat, accent);
      break;
    case "tray": {
      // Flat panel/sheet part.
      const flat = new THREE.Group();
      flat.add(shadowed(new THREE.Mesh(new RoundedBoxGeometry(w, Math.min(h, 0.02), d, 2, 0.003), mat)));
      flat.children[0].position.y = Math.min(h, 0.02) / 2;
      footprintGroup = flat;
      break;
    }
    case "machined_part":
      footprintGroup = buildMachinedPartMesh(w, d, h, mat, accent);
      break;
    default:
      footprintGroup = buildUnknownMesh(w, d, h, mat, accent);
      break;
  }

  // Recenter: footprint-origin recipes get wrapped so the carried part's origin
  // sits at its centre, matching the gripper attach/seat logic.
  const wrapper = new THREE.Group();
  footprintGroup.position.y = -h / 2;
  wrapper.add(footprintGroup);
  return { group: wrapper, halfHeight: h / 2 };
}

/** Disposes all geometries/materials under a prop (shared textures excluded). */
function disposeObject3D(root: THREE.Object3D) {
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((material) => material?.dispose());
  });
}

/** Synthetic scene object for a pick step the scene model didn't cover. */
function synthesizeWorkpieceObject(step: TaskStep | undefined, index: number): SceneObject {
  const text = `${step?.description ?? ""} ${step?.notes ?? ""}`;
  const cls = classifyWorkpiece(text);
  return {
    id: `synth-workpiece-${index + 1}`,
    role: "workpiece",
    category: cls.category,
    label: cls.label,
    colorHint: extractColorWord(text),
    relatedStepIds: step ? [step.id] : [],
    confidence: 0.35,
  };
}

/** Synthetic scene object for a place step the scene model didn't cover. */
function synthesizeDestinationObject(step: TaskStep | undefined, index: number): SceneObject {
  const text = `${step?.description ?? ""} ${step?.notes ?? ""}`;
  const cls = classifyDestination(text);
  return {
    id: `synth-destination-${index + 1}`,
    role: cls.role,
    category: cls.category,
    label: cls.label,
    colorHint: extractColorWord(text),
    relatedStepIds: step ? [step.id] : [],
    confidence: 0.35,
  };
}

function buildRobotArm(robotType: RobotType): THREE.Group {
  const profile = ROBOT_VISUALS[robotType];
  const arm = new THREE.Group();
  arm.userData.visualProfile = profile;

  const brushedMetal = createBrushedMetalTexture();

  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: profile.body,
    metalness: 0.25,
    roughness: 0.42,
    clearcoat: 0.5,
    clearcoatRoughness: 0.2,
    envMapIntensity: 1.1,
  });
  const jointMat = new THREE.MeshStandardMaterial({
    color: profile.joint,
    metalness: 0.88,
    roughness: 0.35,
    roughnessMap: brushedMetal,
    envMapIntensity: 1.2,
  });
  const accentMat = new THREE.MeshPhysicalMaterial({
    color: profile.accent,
    metalness: 0.2,
    roughness: 0.28,
    clearcoat: 0.75,
    clearcoatRoughness: 0.12,
    emissive: profile.accent,
    emissiveIntensity: 0.1,
    envMapIntensity: 1.1,
  });
  const gripperMat = new THREE.MeshStandardMaterial({
    color: profile.gripper,
    metalness: 0.85,
    roughness: 0.3,
    roughnessMap: brushedMetal,
    envMapIntensity: 1.0,
  });

  const baseOuter = new THREE.Mesh(new THREE.CylinderGeometry(profile.baseRadius * 0.92, profile.baseRadius, 0.06, 32), bodyMat);
  baseOuter.position.y = 0.03;
  arm.add(baseOuter);

  const baseRing = new THREE.Mesh(new THREE.TorusGeometry(profile.baseRadius * 0.88, 0.006, 8, 32), accentMat);
  baseRing.rotation.x = Math.PI / 2;
  baseRing.position.y = 0.055;
  arm.add(baseRing);

  const j1Housing = new THREE.Group();
  j1Housing.name = "joint1";
  j1Housing.position.y = 0.1273;

  const j1Body = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.068, 0.095, 32), bodyMat);
  j1Housing.add(j1Body);

  const j1Cap = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.02, 32), jointMat);
  j1Cap.position.y = 0.057;
  j1Housing.add(j1Cap);

  arm.add(j1Housing);

  const upperArm = new THREE.Group();
  upperArm.name = "upperArm";
  j1Housing.add(upperArm);

  const shoulderSphere = new THREE.Mesh(new THREE.SphereGeometry(0.055, 24, 24), jointMat);
  shoulderSphere.position.y = 0.055;
  upperArm.add(shoulderSphere);

  const upperArmTube = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.044, profile.upperLen, 20), bodyMat);
  upperArmTube.rotation.z = Math.PI / 2;
  upperArmTube.position.set(profile.upperLen / 2, 0.055, 0);
  upperArm.add(upperArmTube);

  const upperArmCap = new THREE.Mesh(new THREE.SphereGeometry(0.042, 16, 16), jointMat);
  upperArmCap.position.set(profile.upperLen, 0.055, 0);
  upperArm.add(upperArmCap);

  const j2Housing = new THREE.Group();
  j2Housing.name = "joint2";
  j2Housing.position.set(profile.upperLen, 0.055, 0);
  upperArm.add(j2Housing);

  const j2Body = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.048, 0.08, 24), jointMat);
  j2Body.rotation.x = Math.PI / 2;
  j2Housing.add(j2Body);

  const foreArm = new THREE.Group();
  foreArm.name = "foreArm";
  j2Housing.add(foreArm);

  const foreArmTube = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.038, profile.foreLen, 20), bodyMat);
  foreArmTube.rotation.z = Math.PI / 2;
  foreArmTube.position.set(profile.foreLen / 2, 0, 0);
  foreArm.add(foreArmTube);

  const rib1 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.008, 0.044), accentMat);
  rib1.position.set(0.18, 0.036, 0);
  foreArm.add(rib1);

  const j3Housing = new THREE.Group();
  j3Housing.name = "joint3";
  j3Housing.position.set(profile.foreLen, 0, 0);
  foreArm.add(j3Housing);

  const j3Body = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.038, 0.1157, 24), bodyMat);
  j3Body.rotation.z = Math.PI / 2;
  j3Housing.add(j3Body);

  const j4Housing = new THREE.Group();
  j4Housing.name = "joint4";
  j4Housing.position.set(0.1157, 0, 0);
  j3Housing.add(j4Housing);

  const j4Body = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.034, 0.0922, 24), jointMat);
  j4Housing.add(j4Body);

  const w23link = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.0922, 20), bodyMat);
  w23link.rotation.z = Math.PI / 2;
  w23link.position.set(0.0922 / 2, 0, 0);
  j4Housing.add(w23link);

  const j5Housing = new THREE.Group();
  j5Housing.name = "joint5";
  j5Housing.position.set(0.0922, 0, 0);
  j4Housing.add(j5Housing);

  const j5Body = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.0952, 24), jointMat);
  j5Body.rotation.x = Math.PI / 2;
  j5Housing.add(j5Body);

  const toolFlange = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.012, 32), bodyMat);
  toolFlange.rotation.x = Math.PI / 2;
  toolFlange.position.set(0, 0, 0.0952);
  j5Housing.add(toolFlange);

  const gripperBase = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.068, 0.04), gripperMat);
  gripperBase.position.set(0, 0, 0.0952 + 0.02);
  j5Housing.add(gripperBase);

  const finger1 = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.014, 0.055), gripperMat);
  finger1.position.set(0.022, 0, 0.0952 + 0.04 + 0.0275);
  j5Housing.add(finger1);

  const finger2 = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.014, 0.055), gripperMat);
  finger2.position.set(-0.022, 0, 0.0952 + 0.04 + 0.0275);
  j5Housing.add(finger2);

  const tipMat = new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.95, metalness: 0.02 });
  const tip1 = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.012, 0.01), tipMat);
  tip1.position.set(0.022, 0, 0.0952 + 0.04 + 0.055 + 0.005);
  j5Housing.add(tip1);
  const tip2 = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.012, 0.01), tipMat);
  tip2.position.set(-0.022, 0, 0.0952 + 0.04 + 0.055 + 0.005);
  j5Housing.add(tip2);

  const axisLen = 0.06;
  const makeAxis = (color: number, dir: THREE.Vector3) => {
    const mat = new THREE.MeshBasicMaterial({ color });
    const geo = new THREE.CylinderGeometry(0.003, 0.003, axisLen, 8);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    mesh.position.copy(dir.clone().multiplyScalar(axisLen / 2));
    return mesh;
  };
  const eeFrame = new THREE.Group();
  eeFrame.name = "eeFrame";
  eeFrame.position.set(0, 0, 0.0952 + 0.04 + 0.055 + 0.01);
  j5Housing.add(eeFrame);
  eeFrame.add(makeAxis(0xff3333, new THREE.Vector3(1, 0, 0)));
  eeFrame.add(makeAxis(0x33ff33, new THREE.Vector3(0, 1, 0)));
  eeFrame.add(makeAxis(0x3333ff, new THREE.Vector3(0, 0, 1)));

  // The hidden hierarchy above preserves named UR5e joints for telemetry, while
  // this single visible rig is driven directly to the active tool target. This
  // keeps the demo honest visually: the gripper, not a waypoint overlay, reaches
  // the taught box/contact point.
  upperArm.visible = false;
  const targetRig = new THREE.Group();
  targetRig.name = "targetRig";
  arm.add(targetRig);

  const makeLink = (name: string, radius: number, material: THREE.Material) => {
    const link = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 1, 24), material);
    link.name = name;
    targetRig.add(link);
    return link;
  };
  makeLink("targetUpperLink", 0.042 * profile.linkScale, bodyMat);
  makeLink("targetForeLink", 0.036 * profile.linkScale, bodyMat);
  makeLink("targetWristLink", 0.026 * profile.linkScale, jointMat);

  const makeJoint = (name: string, radius: number, material: THREE.Material) => {
    const joint = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 24), material);
    joint.name = name;
    targetRig.add(joint);
    return joint;
  };
  makeJoint("targetShoulderJoint", 0.058 * profile.linkScale, jointMat);
  makeJoint("targetElbowJoint", 0.05 * profile.linkScale, jointMat);
  makeJoint("targetWristJoint", 0.04 * profile.linkScale, jointMat);

  const brandBand = new THREE.Mesh(new RoundedBoxGeometry(0.13 * profile.linkScale, 0.012, 0.034, 3, 0.0035), accentMat);
  brandBand.name = "targetBrandBand";
  brandBand.position.set(0.16, profile.shoulderHeight + 0.035, 0);
  targetRig.add(brandBand);

  const gripper = new THREE.Group();
  gripper.name = "targetGripper";
  targetRig.add(gripper);
  const wristCover = new THREE.Mesh(new THREE.CylinderGeometry(0.034 * profile.linkScale, 0.034 * profile.linkScale, 0.075, 24), jointMat);
  wristCover.rotation.x = Math.PI / 2;
  gripper.add(wristCover);
  const palmDepth = profile.gripperStyle === "compact" ? 0.046 : profile.gripperStyle === "pneumatic" ? 0.086 : 0.062;
  const palm = new THREE.Mesh(new RoundedBoxGeometry(0.078 * profile.linkScale, 0.036, palmDepth, 3, 0.006), gripperMat);
  palm.position.y = -0.04;
  gripper.add(palm);
  const fingerLength = profile.gripperStyle === "compact" ? 0.055 : profile.gripperStyle === "pneumatic" ? 0.095 : 0.08;
  const fingerSpread = profile.gripperStyle === "pneumatic" ? 0.034 : 0.026;
  const leftFinger = new THREE.Mesh(new THREE.BoxGeometry(0.014, fingerLength, 0.014), gripperMat);
  leftFinger.name = "targetLeftFinger";
  leftFinger.position.set(fingerSpread, -0.058 - fingerLength / 2, 0);
  gripper.add(leftFinger);
  const rightFinger = leftFinger.clone();
  rightFinger.name = "targetRightFinger";
  rightFinger.position.x = -fingerSpread;
  gripper.add(rightFinger);
  const leftTip = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.012, 0.018), tipMat);
  leftTip.name = "targetLeftTip";
  leftTip.position.set(fingerSpread, -0.064 - fingerLength, 0);
  gripper.add(leftTip);
  const rightTip = leftTip.clone();
  rightTip.name = "targetRightTip";
  rightTip.position.x = -fingerSpread;
  gripper.add(rightTip);
  arm.userData.fingerSpread = fingerSpread;

  if (profile.gripperStyle === "pneumatic") {
    const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.11, 20), accentMat);
    cylinder.rotation.z = Math.PI / 2;
    cylinder.position.set(0, -0.038, 0.04);
    gripper.add(cylinder);
  }

  arm.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });

  return arm;
}

function setSegment(mesh: THREE.Mesh, from: THREE.Vector3, to: THREE.Vector3) {
  const delta = to.clone().sub(from);
  const length = Math.max(delta.length(), 0.001);
  mesh.position.copy(from).addScaledVector(delta, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
  mesh.scale.set(1, length, 1);
}

function updateTargetDrivenArm(armGroup: THREE.Group, pose: Pose, gripOpen = 1) {
  const profile = (armGroup.userData.visualProfile ?? ROBOT_VISUALS.ur5e) as RobotVisualProfile;
  const shoulder = new THREE.Vector3(0, profile.shoulderHeight, 0);
  const target = new THREE.Vector3(pose.position.x, pose.position.z, -pose.position.y);
  const gripperRoot = target.clone().add(new THREE.Vector3(0, profile.wristLift * 0.8, 0));
  const wrist = target.clone().add(new THREE.Vector3(0, profile.wristLift, 0));
  const planar = new THREE.Vector3(gripperRoot.x - shoulder.x, 0, gripperRoot.z - shoulder.z);
  const planarLength = Math.max(planar.length(), 0.001);
  const horizontal = planar.clone().divideScalar(planarLength);
  const vertical = gripperRoot.y - shoulder.y;
  const upperLen = profile.upperLen;
  const foreLen = profile.foreLen;
  const reach = clamp(Math.hypot(planarLength, vertical), 0.08, upperLen + foreLen - 0.01);
  const cosShoulder = clamp((upperLen * upperLen + reach * reach - foreLen * foreLen) / (2 * upperLen * reach), -1, 1);
  const baseAngle = Math.atan2(vertical, planarLength);
  const shoulderAngle = baseAngle + Math.acos(cosShoulder);
  const elbow = shoulder
    .clone()
    .addScaledVector(horizontal, Math.cos(shoulderAngle) * upperLen)
    .add(new THREE.Vector3(0, Math.sin(shoulderAngle) * upperLen, 0));

  const upper = armGroup.getObjectByName("targetUpperLink") as THREE.Mesh | null;
  const fore = armGroup.getObjectByName("targetForeLink") as THREE.Mesh | null;
  const wristLink = armGroup.getObjectByName("targetWristLink") as THREE.Mesh | null;
  if (upper) setSegment(upper, shoulder, elbow);
  if (fore) setSegment(fore, elbow, wrist);
  if (wristLink) setSegment(wristLink, wrist, gripperRoot);

  armGroup.getObjectByName("targetShoulderJoint")?.position.copy(shoulder);
  armGroup.getObjectByName("targetElbowJoint")?.position.copy(elbow);
  armGroup.getObjectByName("targetWristJoint")?.position.copy(wrist);
  const brandBand = armGroup.getObjectByName("targetBrandBand");
  if (brandBand) {
    brandBand.position.copy(shoulder.clone().lerp(elbow, 0.42));
    brandBand.lookAt(elbow);
  }
  const gripper = armGroup.getObjectByName("targetGripper") as THREE.Group | null;
  if (gripper) {
    gripper.position.copy(gripperRoot);
    gripper.rotation.set(0, -(pose.rotation.z ?? 0), 0);
  }

  // Fingers slide together toward the centerline as the gripper closes (gripOpen -> 0)
  // and spread back out to their rest width when open (gripOpen -> 1).
  const restSpread = (armGroup.userData.fingerSpread as number | undefined) ?? 0.026;
  const spread = restSpread * (0.2 + 0.8 * clamp(gripOpen, 0, 1));
  const leftFinger = armGroup.getObjectByName("targetLeftFinger");
  const rightFinger = armGroup.getObjectByName("targetRightFinger");
  const leftTip = armGroup.getObjectByName("targetLeftTip");
  const rightTip = armGroup.getObjectByName("targetRightTip");
  if (leftFinger) leftFinger.position.x = spread;
  if (rightFinger) rightFinger.position.x = -spread;
  if (leftTip) leftTip.position.x = spread;
  if (rightTip) rightTip.position.x = -spread;
}

function applyJointAngles(armGroup: THREE.Group, angles: number[]) {
  const j1 = armGroup.getObjectByName("joint1") as THREE.Group;
  const upperArm = armGroup.getObjectByName("upperArm") as THREE.Group;
  const foreArm = armGroup.getObjectByName("foreArm") as THREE.Group;
  const j3 = armGroup.getObjectByName("joint3") as THREE.Group;
  const j4 = armGroup.getObjectByName("joint4") as THREE.Group;
  const j5 = armGroup.getObjectByName("joint5") as THREE.Group;

  if (j1) j1.rotation.y = angles[0];
  if (upperArm) upperArm.rotation.z = angles[1];
  if (foreArm) foreArm.rotation.z = angles[2];
  if (j3) j3.rotation.z = angles[3];
  if (j4) j4.rotation.x = angles[4];
  if (j5) j5.rotation.z = angles[5];
}

function buildTrajectoryLine(waypoints: THREE.Vector3[], velocities: number[]): THREE.Line {
  const curve = new THREE.CatmullRomCurve3(waypoints, false, "centripetal", 0.5);
  const points = curve.getPoints(Math.max(waypoints.length * 10, 2));
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const maxV = Math.max(...velocities, 0.001);
  const colors: number[] = [];

  points.forEach((_, i) => {
    const t = points.length > 1 ? i / (points.length - 1) : 0;
    const segIdx = Math.min(Math.floor(t * velocities.length), velocities.length - 1);
    const v = (velocities[segIdx] ?? maxV) / maxV;
    if (v < 0.5) {
      colors.push(v * 2, 1, 0);
    } else {
      colors.push(1, 1 - (v - 0.5) * 2, 0);
    }
  });

  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  return new THREE.Line(geometry, new THREE.LineBasicMaterial({ vertexColors: true, linewidth: 2 }));
}

function getJointWorldPositions(armGroup: THREE.Group) {
  armGroup.updateMatrixWorld(true);
  const names = ["joint1", "upperArm", "joint2", "foreArm", "joint3", "joint4", "joint5", "eeFrame"];
  return names.flatMap((name) => {
    const object = armGroup.getObjectByName(name);
    return object ? [object.getWorldPosition(new THREE.Vector3())] : [];
  });
}

function getEndEffectorPose(armGroup: THREE.Group): Pose | null {
  const eeFrame = armGroup.getObjectByName("eeFrame");
  if (!eeFrame) return null;
  armGroup.updateMatrixWorld(true);
  const worldPosition = eeFrame.getWorldPosition(new THREE.Vector3());
  const worldQuaternion = eeFrame.getWorldQuaternion(new THREE.Quaternion());
  const worldRotation = new THREE.Euler().setFromQuaternion(worldQuaternion);
  return {
    position: {
      x: worldPosition.x,
      y: -worldPosition.z,
      z: worldPosition.y - ROBOT_BASE_Y,
    },
    rotation: {
      x: worldRotation.x,
      y: worldRotation.y,
      z: worldRotation.z,
    },
  };
}

function isHomePosition(jointAngles: number[]) {
  return jointAngles.every((angle) => Math.abs(angle) < 0.0001);
}

function segmentTableDepth(a: THREE.Vector3, b: THREE.Vector3, tableBox: THREE.Box3, tableTop: number) {
  const samples = Math.max(8, Math.ceil(a.distanceTo(b) / 0.01));
  for (let i = 0; i <= samples; i += 1) {
    const point = a.clone().lerp(b, i / samples);
    if (tableBox.containsPoint(point) && point.y <= tableTop) {
      return tableTop - point.y;
    }
  }
  return 0;
}

function poseWithinTableFootprint(pose: Pose) {
  return (
    pose.position.x > TABLE_CENTER.x - TABLE_SIZE.x / 2 &&
    pose.position.x < TABLE_CENTER.x + TABLE_SIZE.x / 2 &&
    -pose.position.y > TABLE_CENTER.z - TABLE_SIZE.z / 2 &&
    -pose.position.y < TABLE_CENTER.z + TABLE_SIZE.z / 2
  );
}

function checkCollision(jointPositions: THREE.Vector3[], workcell: WorkcellGeometry, jointAngles: number[], activePose?: Pose): CollisionResult {
  // Robot is table-mounted: the table surface and robot base frame both sit at world Y=0.75m.
  // Policy target Z values are heights relative to the table/base surface, so z=0.08 means 80mm above the table.
  // Invariant: home position (all joints zero) never collides.
  // If collision is detected at home, the workcell coordinates are wrong.
  if (isHomePosition(jointAngles)) {
    return { detected: false, depth: 0, description: "" };
  }

  if (activePose && poseWithinTableFootprint(activePose) && activePose.position.z < -0.005) {
    const depth = Math.abs(activePose.position.z);
    return {
      detected: true,
      depth,
      description: `Tool target penetrates table surface (depth: ${(depth * 1000).toFixed(0)}mm)`,
    };
  }

  for (let i = 0; i < jointPositions.length - 1; i += 1) {
    const a = jointPositions[i];
    const b = jointPositions[i + 1];

    if (a.y > workcell.tableTop + 0.01 && b.y > workcell.tableTop + 0.01) {
      continue;
    }

    if (a.y < workcell.floorY && b.y < workcell.floorY) {
      continue;
    }

    const intersectionDepth = segmentTableDepth(a, b, workcell.tableBox, workcell.tableTop);
    if (intersectionDepth > 0.005 && activePose && activePose.position.z < -0.005) {
      return {
        detected: true,
        depth: intersectionDepth,
        description: `Link ${i + 1}-${i + 2} penetrates table surface (depth: ${(intersectionDepth * 1000).toFixed(0)}mm)`,
      };
    }
  }

  for (const pos of jointPositions) {
    if (pos.y < workcell.floorY - 0.005) {
      return {
        detected: true,
        depth: workcell.floorY - pos.y,
        description: `Joint position below floor (depth: ${((workcell.floorY - pos.y) * 1000).toFixed(0)}mm)`,
      };
    }
  }

  return { detected: false, depth: 0, description: "" };
}

function updateGhostTrail(trail: THREE.Group, position: THREE.Vector3) {
  const dot = new THREE.Mesh(
    new THREE.SphereGeometry(0.006, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0x2244ff, transparent: true, opacity: 0.6 }),
  );
  dot.position.copy(position);
  trail.add(dot);
  while (trail.children.length > 30) trail.remove(trail.children[0]);
  const count = Math.max(trail.children.length - 1, 1);
  trail.children.forEach((child, index) => {
    const material = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
    material.opacity = 0.05 + (index / count) * 0.55;
  });
}

export function RobotViewport({
  robotType,
  gripperType = "electric_parallel",
  policy,
  jointValues,
  showTrajectory = true,
  showCollisionGeometry = false,
  showJointLimits = true,
  showWorkcell = true,
  playbackState = "playing",
  playbackSpeed = 1,
  onJointChange,
  onEndEffectorMove,
  className,
}: RobotViewportProps) {
  const gripperBadge = GRIPPER_BADGES[gripperType];
  const mountRef = useRef<HTMLDivElement>(null);
  const runtime = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    robot: THREE.Group;
    joints: IKJoint[];
    ee: THREE.Object3D;
    marker: THREE.Mesh;
    trail: THREE.Group;
    workcell: WorkcellGeometry;
    frame: number;
    step: number;
    anim: PlaybackAnim | null;
    props: THREE.Object3D[];
    /** Half-heights of the carried props, for resting them on surfaces. */
    propHalfHeights: number[];
    fixtures: THREE.Object3D[];
    ambientProps: THREE.Object3D[];
    carrySlots: CarrySlot[];
    scanRing: THREE.Mesh | null;
    metalTexture: THREE.Texture | null;
    /** Signature of the last-built scene props, to skip no-op rebuilds while streaming. */
    sceneSignature: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [webglUnavailable, setWebglUnavailable] = useState(false);
  const [joints, setJoints] = useState<IKJoint[]>(() => UR5E_JOINTS.map((joint) => ({ ...joint })));
  const [pose, setPose] = useState<Pose>(() => waypointToPose(policy, 0));
  const [collision, setCollision] = useState<string | null>(null);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const trajectory = useMemo(() => policy?.steps.map((_, index) => sceneVector(waypointToPose(policy, index))) ?? [], [policy]);

  // Mirrors of fast-changing props, read fresh inside the rAF loop below so the
  // playback effect doesn't need to depend on them (and tear down/restart every
  // time `policy` gets a new object reference, e.g. while interpretation streams).
  const policyRef = useRef(policy);
  useEffect(() => {
    policyRef.current = policy;
  }, [policy]);

  const playbackSpeedRef = useRef(playbackSpeed);
  useEffect(() => {
    playbackSpeedRef.current = playbackSpeed;
  }, [playbackSpeed]);

  const onEndEffectorMoveRef = useRef(onEndEffectorMove);
  useEffect(() => {
    onEndEffectorMoveRef.current = onEndEffectorMove;
  }, [onEndEffectorMove]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const width = mount.clientWidth || 720;
    const height = mount.clientHeight || 520;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      setLoading(false);
      setWebglUnavailable(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = createStudioBackground();
    const environment = createStudioEnvironment(renderer);
    scene.environment = environment.texture;
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.03, 30);
    camera.position.set(1.6, 1.45, 1.7);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0.35, 0.92, 0);

    const ambient = new THREE.AmbientLight(0xffffff, 0.25);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xfff5e0, 1.4);
    keyLight.position.set(-2, 4, 2);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.radius = 3;
    keyLight.shadow.camera.near = 0.1;
    keyLight.shadow.camera.far = 20;
    keyLight.shadow.camera.left = -2;
    keyLight.shadow.camera.right = 2;
    keyLight.shadow.camera.top = 2;
    keyLight.shadow.camera.bottom = -2;
    keyLight.shadow.bias = -0.001;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xe8f0ff, 0.45);
    fillLight.position.set(3, 2, -1);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.35);
    rimLight.position.set(0, 1, -4);
    scene.add(rimLight);

    RectAreaLightUniformsLib.init();
    const softbox = new THREE.RectAreaLight(0xffffff, 5, 1.1, 0.7);
    softbox.position.set(0.1, TABLE_TOP_Y + 1.3, 0.55);
    softbox.lookAt(TABLE_CENTER.x, TABLE_TOP_Y + 0.25, 0);
    scene.add(softbox);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 6),
      new THREE.MeshPhysicalMaterial({ color: 0xe7ecf2, roughness: 0.4, metalness: 0.05, clearcoat: 0.12, clearcoatRoughness: 0.6, envMapIntensity: 0.6 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const grid = new THREE.GridHelper(6, 60, 0x0284c7, 0x94a3b8);
    const gridMaterial = grid.material as THREE.LineBasicMaterial;
    gridMaterial.transparent = true;
    gridMaterial.opacity = 0.16;
    scene.add(grid);

    const contactShadowTexture = createContactShadowTexture();
    const groundShadow = createContactShadow(0.85, contactShadowTexture);
    groundShadow.position.set(TABLE_CENTER.x, FLOOR_Y + 0.002, TABLE_CENTER.z);
    scene.add(groundShadow);

    const tableBox = new THREE.Box3(
      new THREE.Vector3(TABLE_CENTER.x - TABLE_SIZE.x / 2, TABLE_TOP_Y - TABLE_THICKNESS, TABLE_CENTER.z - TABLE_SIZE.z / 2),
      new THREE.Vector3(TABLE_CENTER.x + TABLE_SIZE.x / 2, TABLE_TOP_Y, TABLE_CENTER.z + TABLE_SIZE.z / 2),
    );
    const workcell = { tableTop: TABLE_TOP_Y, tableBox, floorY: FLOOR_Y };

    const sharedMetalTexture = createBrushedMetalTexture();
    let scanRing: THREE.Mesh | null = null;
    if (showWorkcell) {
      const tableMat = new THREE.MeshPhysicalMaterial({
        color: 0xf4f6f9,
        roughness: 0.3,
        metalness: 0.04,
        clearcoat: 0.4,
        clearcoatRoughness: 0.25,
        envMapIntensity: 0.9,
      });
      const table = new THREE.Mesh(new RoundedBoxGeometry(TABLE_SIZE.x, TABLE_THICKNESS, TABLE_SIZE.z, 4, 0.012), tableMat);
      table.position.set(TABLE_CENTER.x, TABLE_TOP_Y - TABLE_THICKNESS / 2, TABLE_CENTER.z);
      table.castShadow = true;
      table.receiveShadow = true;
      scene.add(table);

      const tableShadow = createContactShadow(0.42, contactShadowTexture);
      tableShadow.position.set(0, TABLE_TOP_Y + 0.001, 0);
      scene.add(tableShadow);

      const aluminumTexture = sharedMetalTexture;
      const mountPlate = new THREE.Mesh(
        new THREE.CylinderGeometry(0.13, 0.14, 0.018, 40),
        new THREE.MeshStandardMaterial({ color: 0x6b7888, metalness: 0.75, roughness: 0.32, roughnessMap: aluminumTexture, envMapIntensity: 1 }),
      );
      mountPlate.position.set(0, TABLE_TOP_Y + 0.009, 0);
      mountPlate.castShadow = true;
      mountPlate.receiveShadow = true;
      scene.add(mountPlate);
      const legMat = new THREE.MeshStandardMaterial({ color: 0x9aa6b5, metalness: 0.65, roughness: 0.35, roughnessMap: aluminumTexture, envMapIntensity: 1 });
      const legPositions = [
        [TABLE_CENTER.x - TABLE_SIZE.x / 2 + 0.06, TABLE_CENTER.z - TABLE_SIZE.z / 2 + 0.06],
        [TABLE_CENTER.x + TABLE_SIZE.x / 2 - 0.06, TABLE_CENTER.z - TABLE_SIZE.z / 2 + 0.06],
        [TABLE_CENTER.x - TABLE_SIZE.x / 2 + 0.06, TABLE_CENTER.z + TABLE_SIZE.z / 2 - 0.06],
        [TABLE_CENTER.x + TABLE_SIZE.x / 2 - 0.06, TABLE_CENTER.z + TABLE_SIZE.z / 2 - 0.06],
      ];
      legPositions.forEach(([x, z]) => {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.035, TABLE_TOP_Y - TABLE_THICKNESS, 0.035), legMat);
        leg.position.set(x, (TABLE_TOP_Y - TABLE_THICKNESS) / 2, z);
        leg.castShadow = true;
        leg.receiveShadow = true;
        scene.add(leg);
      });
      // Workcell props (carried parts, destination containers/fixtures, ambient
      // objects) are built per-policy by the scene-model effect below, from the
      // interpreted `WorkcellScene` rather than a fixed pool of shapes.

      // Pulsing ring shown under the gripper during "inspect" steps, to
      // visually distinguish a vision/inspection dwell from a plain move.
      scanRing = new THREE.Mesh(
        new THREE.RingGeometry(0.045, 0.065, 32),
        new THREE.MeshBasicMaterial({ color: 0x0284c7, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }),
      );
      scanRing.rotation.x = -Math.PI / 2;
      scanRing.visible = false;
      scene.add(scanRing);
    }

    const robot = buildRobotArm(robotType);
    robot.position.y = ROBOT_BASE_Y;
    scene.add(robot);

    const ee = new THREE.Object3D();
    scene.add(ee);
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.006, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0x2244ff, emissive: 0x2244ff, emissiveIntensity: 0.25, transparent: true, opacity: 0.5 }),
    );
    scene.add(marker);
    const trail = new THREE.Group();
    scene.add(trail);

    const composer: SceneComposer = createSceneComposer(renderer, scene, camera, width, height);

    const parsed = UR5E_JOINTS.map((joint) => ({ ...joint }));
    runtime.current = {
      renderer,
      scene,
      camera,
      controls,
      robot,
      joints: parsed,
      ee,
      marker,
      trail,
      workcell,
      frame: 0,
      step: 0,
      anim: null,
      props: [],
      propHalfHeights: [],
      fixtures: [],
      ambientProps: [],
      carrySlots: [],
      scanRing,
      metalTexture: sharedMetalTexture,
      sceneSignature: "",
    };
    setJoints(parsed);
    setLoading(false);

    const onResize = () => {
      const nextWidth = mount.clientWidth || width;
      const nextHeight = mount.clientHeight || height;
      renderer.setSize(nextWidth, nextHeight);
      composer.setSize(nextWidth, nextHeight);
      camera.aspect = nextWidth / nextHeight;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    let live = true;
    const animate = () => {
      if (!live || !runtime.current) return;
      runtime.current.controls.update();
      composer.render();
      requestAnimationFrame(animate);
    };
    animate();

    return () => {
      live = false;
      window.removeEventListener("resize", onResize);
      composer.dispose();
      environment.dispose();
      sharedMetalTexture.dispose();
      const background = scene.background;
      if (background instanceof THREE.Texture) background.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [robotType, showWorkcell]);

  // Rebuild the workcell props from the interpreted scene model whenever the
  // policy (or its scene) changes — e.g. as interpretation streams in new
  // steps. Each pick-and-place pair gets a carried-part mesh and a destination
  // mesh chosen from the scene objects the interpreter identified (tote, tray,
  // fixture, inspection surface, station, ...); pairs with identical
  // pickup/drop-off coordinates share a prop (the "same part, repeating cycle"
  // case). Scene objects not tied to a carry pair render as ambient props. A
  // signature guard keeps expensive mesh rebuilds out of no-op policy updates.
  useEffect(() => {
    const state = runtime.current;
    if (!state || !showWorkcell || !state.metalTexture) return;

    const steps = policy?.steps ?? [];
    const scene = resolveSceneForPolicy(policy);
    const pairs = findCarryPairs(steps).slice(0, 6);

    const signature = JSON.stringify({
      pairs: pairs.map((pair) => [steps[pair.pickIndex]?.target, steps[pair.placeIndex]?.target, steps[pair.placeIndex]?.description]),
      objects: scene.objects.map((o) => [o.id, o.role, o.category, o.colorHint, o.materialHint, o.sizeHint, o.poseHint, o.relatedStepIds, o.visualFidelity, o.confidence, o.trackId, o.reviewRequiredReason]),
    });
    if (signature === state.sceneSignature) return;
    state.sceneSignature = signature;

    const tableTop = state.workcell.tableTop;
    const metalTexture = state.metalTexture;
    const gripperGroup = state.robot.getObjectByName("targetGripper") as THREE.Group | null;
    const previousSlots = state.carrySlots;

    // Tear down the previous prop set completely; meshes are cheap to rebuild
    // at policy-change frequency and this keeps geometry/material leaks out of
    // long streaming sessions.
    for (const prop of [...state.props, ...state.fixtures, ...state.ambientProps]) {
      prop.parent?.remove(prop);
      disposeObject3D(prop);
    }
    state.props = [];
    state.propHalfHeights = [];
    state.fixtures = [];
    state.ambientProps = [];

    const claimed = new Set<string>();
    const propKeyToIndex = new Map<string, number>();
    const slots: CarrySlot[] = [];

    pairs.forEach((pair) => {
      const pickStep = steps[pair.pickIndex];
      const placeStep = steps[pair.placeIndex];
      const home = sceneVector(waypointToPose(policy, pair.pickIndex));
      const place = sceneVector(waypointToPose(policy, pair.placeIndex));
      const key = `${home.toArray().map((n) => n.toFixed(3)).join(",")}|${place.toArray().map((n) => n.toFixed(3)).join(",")}`;

      let propIndex = propKeyToIndex.get(key);
      if (propIndex === undefined) {
        propIndex = state.props.length;
        propKeyToIndex.set(key, propIndex);
        const accent = CARRY_PROP_COLORS[propIndex % CARRY_PROP_COLORS.length];

        const workpieceObject =
          sceneObjectForStep(scene, pickStep, WORKPIECE_ROLES, claimed) ??
          synthesizeWorkpieceObject(pickStep, propIndex);
        claimed.add(workpieceObject.id);
        const part = buildCarriedPartMesh(workpieceObject, accent, metalTexture);
        state.props.push(part.group);
        state.propHalfHeights.push(part.halfHeight);
        state.scene.add(part.group);

        const destinationObject =
          sceneObjectForStep(scene, placeStep, DESTINATION_ROLES, claimed) ??
          synthesizeDestinationObject(placeStep, propIndex);
        claimed.add(destinationObject.id);
        const destination = buildSceneObjectMesh(destinationObject, accent, metalTexture);
        destination.group.userData.surfaceY = destination.surfaceY;
        state.fixtures.push(destination.group);
        state.scene.add(destination.group);
      }

      const halfHeight = state.propHalfHeights[propIndex];
      const surfaceY = (state.fixtures[propIndex]?.userData.surfaceY as number | undefined) ?? 0;
      // Land the part on the destination's resting surface rather than at the
      // bare drop-off waypoint height, which is where the gripper releases.
      place.y = tableTop + surfaceY + halfHeight + 0.001;

      const previous = previousSlots.find((s) => s.propIndex === propIndex && s.carrying);
      slots.push({ pickIndex: pair.pickIndex, placeIndex: pair.placeIndex, propIndex, home, place, carrying: Boolean(previous) });
    });
    state.carrySlots = slots;

    // Position parts and destinations. A part mid-carry when the rebuild
    // happened re-attaches to the gripper so streaming updates don't visibly
    // drop the payload.
    const slotByProp = new Map(slots.map((slot) => [slot.propIndex, slot]));
    state.props.forEach((prop, index) => {
      const slot = slotByProp.get(index);
      if (!slot) return;
      if (slot.carrying && gripperGroup) {
        gripperGroup.updateWorldMatrix(true, false);
        const gripperWorld = gripperGroup.getWorldPosition(new THREE.Vector3());
        prop.position.set(gripperWorld.x, gripperWorld.y - 0.12, gripperWorld.z);
        gripperGroup.attach(prop);
      } else {
        // At rest before pickup the part sits on the table at its pickup spot.
        prop.position.set(slot.home.x, tableTop + state.propHalfHeights[index] + 0.001, slot.home.z);
        prop.rotation.set(0, 0, 0);
      }
    });
    state.fixtures.forEach((fixture, index) => {
      const slot = slotByProp.get(index);
      if (!slot) return;
      fixture.position.set(slot.place.x, tableTop, slot.place.z);
    });

    // Ambient scene objects: anything the interpreter saw that isn't already a
    // carried part or a carry destination (extra containers, standalone
    // inspection surfaces, fixtures in view), parked at their interpreted pose.
    const tableHalfX = TABLE_SIZE.x / 2 - 0.07;
    const tableHalfZ = TABLE_SIZE.z / 2 - 0.06;
    scene.objects
      .filter((object) => !claimed.has(object.id) && object.poseHint && object.role !== "tool")
      .slice(0, 5)
      .forEach((object, index) => {
        const built = buildSceneObjectMesh(object, CARRY_PROP_COLORS[(state.props.length + index) % CARRY_PROP_COLORS.length], metalTexture);
        const pose = object.poseHint as { x: number; y: number; z: number; yaw?: number };
        const x = clamp(pose.x, TABLE_CENTER.x - tableHalfX, TABLE_CENTER.x + tableHalfX);
        const z = clamp(-pose.y, TABLE_CENTER.z - tableHalfZ, TABLE_CENTER.z + tableHalfZ);
        // Keep clear of the robot base at the table origin.
        const fromBase = Math.hypot(x, z);
        const clearX = fromBase < 0.18 ? x + (x >= 0 ? 0.18 : -0.18) : x;
        built.group.position.set(clearX, tableTop, z);
        if (pose.yaw) built.group.rotation.y = -pose.yaw;
        state.ambientProps.push(built.group);
        state.scene.add(built.group);
      });
  }, [policy, robotType, showWorkcell]);

  useEffect(() => {
    const state = runtime.current;
    if (!state) return;
    // While the rAF playback loop below owns the pose, let it drive the scene --
    // re-snapping here on every `policy` reference change (e.g. each appended
    // step while interpretation streams) would fight the loop's interpolation
    // and show a one-frame jump back to the current waypoint.
    if (playbackState === "playing" && !jointValues) return;
    const nextPose = waypointToPose(policy, state.step);
    const solution = solveCcdIk(state.joints, poseForIk(nextPose));
    const angles: number[] = [];
    for (const joint of state.joints) {
      const next = jointValues?.[joint.name] ?? solution.joints[joint.name] ?? joint.value;
      const clamped = clamp(next, joint.lower, joint.upper);
      joint.value = clamped;
      angles.push(clamped);
    }
    applyJointAngles(state.robot, angles);
    const vector = sceneVector(nextPose);
    updateTargetDrivenArm(state.robot, nextPose, gripperOpenAmount(policy?.steps[state.step]?.gripper));
    state.ee.position.copy(vector);
    state.marker.position.copy(vector);
    setPose(nextPose);
    setJoints([...state.joints]);
    onEndEffectorMove?.(nextPose);
    const collisionResult = checkCollision(getJointWorldPositions(state.robot), state.workcell, angles, nextPose);
    setCollision(collisionResult.detected ? `Collision detected at waypoint ${state.step + 1}: ${collisionResult.description}` : null);
    setActiveStepIndex(state.step);
  }, [jointValues, onEndEffectorMove, playbackState, policy, robotType, showWorkcell]);

  useEffect(() => {
    const state = runtime.current;
    if (!state || playbackState !== "playing") return;

    let frameId = 0;
    let lastTime: number | null = null;
    let hudElapsed = 0;

    const tick = (now: number) => {
      const currentPolicy = policyRef.current;
      const length = currentPolicy?.steps.length ?? 0;
      if (length < 1) {
        frameId = requestAnimationFrame(tick);
        return;
      }

      // Lazily (re)establish the in-flight segment so resuming after a pause --
      // or `policy` simply changing reference mid-stream -- continues smoothly
      // instead of snapping back to the start of the current segment.
      let anim = state.anim;
      if (!anim) {
        const fromPose = waypointToPose(currentPolicy, state.step);
        const toIndex = (state.step + 1) % length;
        const toPose = waypointToPose(currentPolicy, toIndex);
        anim = {
          fromPose,
          toPose,
          toIndex,
          segmentSeconds: segmentDurationSeconds(fromPose, toPose, currentPolicy, toIndex, playbackSpeedRef.current),
          segmentElapsed: 0,
        };
        state.anim = anim;
      }

      if (lastTime === null) lastTime = now;
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      anim.segmentElapsed += dt;
      hudElapsed += dt;
      const t = anim.segmentSeconds > 0 ? Math.min(anim.segmentElapsed / anim.segmentSeconds, 1) : 1;
      const reachedEnd = t >= 1;
      const currentPose = lerpPose(anim.fromPose, anim.toPose, smoothstep(t));
      const fromGripper = currentPolicy?.steps[state.step]?.gripper;
      const toGripper = currentPolicy?.steps[anim.toIndex]?.gripper;
      const gripOpen = fromGripper === toGripper
        ? gripperOpenAmount(toGripper)
        : gripperOpenAmount(fromGripper) + (gripperOpenAmount(toGripper) - gripperOpenAmount(fromGripper)) * smoothstep(t);

      const solution = solveCcdIk(state.joints, poseForIk(currentPose));
      const angles: number[] = [];
      for (const joint of state.joints) {
        const next = clamp(solution.joints[joint.name] ?? joint.value, joint.lower, joint.upper);
        joint.value = next;
        angles.push(next);
      }
      applyJointAngles(state.robot, angles);
      const vector = sceneVector(currentPose);
      updateTargetDrivenArm(state.robot, currentPose, gripOpen);
      state.ee.position.copy(vector);
      state.marker.position.copy(vector);

      // Carry parts with the gripper: for each pick-and-place pair, pick up the
      // prop the instant the gripper finishes closing at its pickup waypoint,
      // and set it down the instant the gripper finishes opening at its
      // drop-off waypoint.
      const gripperGroup = state.robot.getObjectByName("targetGripper") as THREE.Group | null;
      if (gripperGroup && reachedEnd) {
        for (const slot of state.carrySlots) {
          const prop = state.props[slot.propIndex];
          if (!prop) continue;
          if (slot.pickIndex === anim.toIndex && !slot.carrying) {
            prop.position.copy(slot.home);
            gripperGroup.attach(prop);
            slot.carrying = true;
          } else if (slot.placeIndex === anim.toIndex && slot.carrying) {
            state.scene.attach(prop);
            prop.position.copy(slot.place);
            // Seat the part flat in the cradle, preserving only the net yaw it
            // was rotated through while carried (so a 90deg reorient still reads).
            const yaw = prop.rotation.y;
            prop.rotation.set(0, yaw, 0);
            slot.carrying = false;
          }
        }
      }

      // Pulse a scan ring under the gripper while the current/just-departed
      // waypoint is an "inspect" step -- visually distinct from moving, gripping,
      // or releasing.
      const toAction = currentPolicy?.steps[anim.toIndex]?.action;
      const fromAction = currentPolicy?.steps[state.step]?.action;
      const inspecting = toAction === "inspect" ? t > 0.5 : fromAction === "inspect" && t <= 0.5;
      if (state.scanRing) {
        state.scanRing.visible = inspecting;
        if (inspecting) {
          state.scanRing.position.set(vector.x, state.workcell.tableTop + 0.002, vector.z);
          state.scanRing.scale.setScalar(1 + 0.2 * Math.sin(now / 200));
        }
      }

      if (reachedEnd || hudElapsed >= 0.08) {
        hudElapsed = 0;
        updateGhostTrail(state.trail, vector);
        setPose(currentPose);
        setJoints([...state.joints]);
        const collisionResult = checkCollision(getJointWorldPositions(state.robot), state.workcell, angles, currentPose);
        setCollision(collisionResult.detected ? `Collision detected at waypoint ${anim.toIndex + 1}: ${collisionResult.description}` : null);
        onEndEffectorMoveRef.current?.(currentPose);
        setActiveStepIndex(anim.toIndex);
      }

      if (reachedEnd) {
        state.step = anim.toIndex;
        const nextPolicy = policyRef.current;
        const nextLength = Math.max(nextPolicy?.steps.length ?? length, 1);
        const nextToIndex = (state.step + 1) % nextLength;
        const nextToPose = waypointToPose(nextPolicy, nextToIndex);
        state.anim = {
          fromPose: anim.toPose,
          toPose: nextToPose,
          toIndex: nextToIndex,
          segmentSeconds: segmentDurationSeconds(anim.toPose, nextToPose, nextPolicy, nextToIndex, playbackSpeedRef.current),
          segmentElapsed: 0,
        };
      }

      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
    // robotType/showWorkcell are included because the mount effect above rebuilds
    // `runtime.current` (new robot, new scene) whenever either changes -- without
    // rebinding here, this loop keeps animating the disposed old robot while the
    // freshly built one sits frozen in its unposed, just-constructed state.
  }, [playbackState, robotType, showWorkcell]);

  useEffect(() => {
    const state = runtime.current;
    if (!state || !showTrajectory) return;
    const group = new THREE.Group();
    if (trajectory.length > 1) {
      const velocities = policy?.steps.map((step) => step.speed) ?? trajectory.map(() => 0.1);
      group.add(buildTrajectoryLine(trajectory, velocities));
      trajectory.forEach((point) => {
        const marker = new THREE.Mesh(
          new THREE.SphereGeometry(0.006, 12, 12),
          new THREE.MeshStandardMaterial({ color: 0x2244ff, emissive: 0x2244ff, emissiveIntensity: 0.25, transparent: true, opacity: 0.45 }),
        );
        marker.position.copy(point);
        group.add(marker);
      });
      state.scene.add(group);
    }
    return () => {
      state.scene.remove(group);
    };
  }, [policy?.steps, showTrajectory, trajectory]);

  const setPreset = (preset: "front" | "top" | "side" | "iso") => {
    const state = runtime.current;
    if (!state) return;
    const positions = {
      front: new THREE.Vector3(1.4, 1.15, 2),
      top: new THREE.Vector3(0.3, 3.1, 0.01),
      side: new THREE.Vector3(2.1, 1.15, 0),
      iso: new THREE.Vector3(1.6, 1.45, 1.7),
    };
    state.camera.position.copy(positions[preset]);
    state.controls.target.set(0.35, 0.92, 0);
    state.controls.update();
  };

  const updateJoint = (jointName: string, value: number) => {
    const state = runtime.current;
    if (!state) return;
    const joint = state.joints.find((item) => item.name === jointName);
    if (!joint) return;
    joint.value = clamp(value, joint.lower, joint.upper);
    const angles = state.joints.map((item) => item.value);
    applyJointAngles(state.robot, angles);
    const nextPose = getEndEffectorPose(state.robot);
    if (nextPose) {
      const vector = sceneVector(nextPose);
      updateTargetDrivenArm(state.robot, nextPose, gripperOpenAmount(policy?.steps[state.step]?.gripper));
      state.ee.position.copy(vector);
      state.marker.position.copy(vector);
      setPose(nextPose);
      onEndEffectorMove?.(nextPose);
    }
    const collisionResult = checkCollision(getJointWorldPositions(state.robot), state.workcell, angles, nextPose ?? undefined);
    setCollision(collisionResult.detected ? `Collision detected at manual pose: ${collisionResult.description}` : null);
    setJoints([...state.joints]);
    onJointChange?.(jointName, joint.value);
  };

  return (
    <div className={cn("overflow-hidden rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))]", className)}>
      <div className="flex items-center justify-between border-b border-[rgb(var(--steel))] px-3 py-2">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[rgb(var(--signal-cyan))]">Robot viewport</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">{ROBOTS[robotType].label} · Assembly Cell 1</p>
            <span className={cn("rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em]", gripperBadge.className)}>
              {gripperBadge.label}
            </span>
          </div>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" title="Viewport settings"><Settings className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" title="Fullscreen"><Maximize2 className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" title="Reset camera" onClick={() => setPreset("iso")}><RotateCcw className="h-4 w-4" /></Button>
        </div>
      </div>
      <div className="grid min-h-[520px] lg:grid-cols-[1fr_280px]">
        <div className="relative min-h-[420px]">
          <div ref={mountRef} className="h-full min-h-[420px]" />
          {webglUnavailable && (
            <div className="absolute inset-0 grid place-items-center bg-[rgb(var(--ink-3))] p-8 text-center">
              <div className="max-w-sm">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-[rgb(var(--signal-cyan))]">Robot policy replay</p>
                <p className="mt-3 text-2xl font-semibold">8 generated waypoints</p>
                <p className="mt-2 text-sm text-[rgb(var(--bone-2))]">Viewport running in capture-safe mode because WebGL is unavailable in this browser.</p>
              </div>
            </div>
          )}
          {loading && <div className="absolute inset-0 grid place-items-center bg-[rgb(var(--ink)/0.72)] text-sm">Loading robot...</div>}
          <div data-testid="ee-pose" className="absolute right-3 top-3 rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2)/0.92)] p-3 font-mono text-[11px] tabular">
            <p>End-effector pose</p>
            <p data-testid="ee-pose-x">X: {pose.position.x.toFixed(3)} m</p>
            <p>Y: {pose.position.y.toFixed(3)} m</p>
            <p>Z: {pose.position.z.toFixed(3)} m</p>
            <p>Rx: {Math.round((pose.rotation.x * 180) / Math.PI)} deg</p>
            <p>Ry: {Math.round((pose.rotation.y * 180) / Math.PI)} deg</p>
            <p>Rz: {Math.round((pose.rotation.z * 180) / Math.PI)} deg</p>
          </div>
          {collision && <div data-testid="collision-warning" className="absolute bottom-3 left-3 rounded-md bg-[rgb(var(--signal-red))] px-3 py-2 text-sm text-white">{collision}</div>}
        </div>
        <aside data-testid="joint-panel" className="border-l border-[rgb(var(--steel))] p-3">
          <div className="mb-3 flex gap-1">
            <Button size="sm" variant="outline" onClick={() => setPreset("front")}>Front</Button>
            <Button size="sm" variant="outline" onClick={() => setPreset("top")}>Top</Button>
            <Button size="sm" variant="outline" onClick={() => setPreset("side")}>Side</Button>
            <Button size="sm" variant="outline" onClick={() => setPreset("iso")}>Iso</Button>
          </div>
          <div className="mb-4 flex items-center gap-2 text-sm">
            {playbackState === "playing" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            <span>Speed {playbackSpeed.toFixed(1)}x</span>
            {showCollisionGeometry && <Box className="ml-auto h-4 w-4 text-[rgb(var(--signal-amber))]" />}
          </div>
          <h3 className="font-semibold">Joints</h3>
          <div className="mt-3 space-y-3">
            {joints.map((joint) => {
              const degrees = (joint.value * 180) / Math.PI;
              const nearLimit = showJointLimits && (Math.abs(joint.value - joint.lower) < Math.PI / 18 || Math.abs(joint.upper - joint.value) < Math.PI / 18);
              return (
                <label key={joint.name} className="block text-xs">
                  <span className={cn("flex justify-between gap-2", nearLimit && "text-[rgb(var(--signal-amber))]")}>
                    <span className="truncate">{joint.name}</span>
                    <span className="font-mono tabular">{degrees.toFixed(1)} deg</span>
                  </span>
                  <input
                    className="mt-1 w-full"
                    type="range"
                    min={joint.lower}
                    max={joint.upper}
                    step={0.01}
                    value={joint.value}
                    onChange={(event) => updateJoint(joint.name, Number(event.target.value))}
                  />
                </label>
              );
            })}
          </div>
        </aside>
      </div>
      {policy && policy.steps.length > 0 && (() => {
        const stepCount = policy.steps.length;
        const safeIndex = Math.min(activeStepIndex, stepCount - 1);
        const step = policy.steps[safeIndex];
        return (
          <div data-testid="step-intent" className="border-t border-[rgb(var(--steel))] px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[rgb(var(--signal-cyan))]">
                Interpreted intent · step {safeIndex + 1} / {stepCount}
              </p>
              <div className="flex items-center gap-2">
                <span className="rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-3))] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em]">
                  {step.action}
                </span>
                {step.gripper !== "unchanged" && (
                  <span className="rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-3))] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em]">
                    gripper {step.gripper}
                  </span>
                )}
                {step.requiresVision && (
                  <span className="rounded-md border border-[rgb(var(--signal-cyan))] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[rgb(var(--signal-cyan))]">
                    vision check
                  </span>
                )}
              </div>
            </div>
            <p data-testid="step-intent-description" className="mt-2 text-sm">
              {step.description}
            </p>
            {step.notes && <p className="mt-1 text-xs text-[rgb(var(--bone-2))]">Note: {step.notes}</p>}
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] tabular text-[rgb(var(--bone-2))]">
              <span>target x {step.target.x.toFixed(3)} m</span>
              <span>y {step.target.y.toFixed(3)} m</span>
              <span>z {step.target.z.toFixed(3)} m</span>
              <span>speed {step.speed.toFixed(2)} m/s</span>
              <span>duration {step.duration}s</span>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
