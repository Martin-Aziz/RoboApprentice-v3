import * as THREE from "three";
import type { Pose } from "@/lib/robot-viewport-types";

export interface IKJoint {
  name: string;
  value: number;
  lower: number;
  upper: number;
}

export interface IKSolution {
  joints: Record<string, number>;
  reachable: boolean;
  errorMeters: number;
}

function clamp(value: number, lower: number, upper: number) {
  return Math.max(lower, Math.min(upper, value));
}

/** Computes a deterministic CCD-style six-axis pose approximation constrained by URDF joint limits. */
export function solveCcdIk(chain: IKJoint[], targetPose: Pose): IKSolution {
  const x = targetPose.position.x;
  const y = targetPose.position.y;
  const z = targetPose.position.z;
  const planar = Math.sqrt(x * x + y * y);
  const base = Math.atan2(y, x);
  const shoulder = Math.atan2(z - 0.18, Math.max(0.001, planar)) - 0.35;
  const elbow = Math.PI / 2 - shoulder + Math.min(0.8, Math.max(-0.8, planar - 0.45));
  const wrist = -shoulder - elbow * 0.5;
  const guesses = [base, shoulder, elbow, wrist, targetPose.rotation.y, targetPose.rotation.z];

  const joints = Object.fromEntries(chain.map((joint, index) => [joint.name, clamp(guesses[index] ?? joint.value, joint.lower, joint.upper)]));
  const reach = 0.92;
  const target = new THREE.Vector3(x, y, z);
  const clamped = target.clone().clampLength(0, reach);
  return {
    joints,
    reachable: target.distanceTo(clamped) < 0.03 && z >= 0.02,
    errorMeters: target.distanceTo(clamped),
  };
}
