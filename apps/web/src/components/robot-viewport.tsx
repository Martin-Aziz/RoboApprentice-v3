"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from "three-mesh-bvh";
import URDFLoader, { type URDFJoint } from "urdf-loader";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Box, Maximize2, Pause, Play, RotateCcw, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { solveCcdIk, type IKJoint } from "@/lib/ik-solver";
import type { Pose } from "@/lib/robot-viewport-types";
import type { TaskPolicy } from "@/lib/types";

THREE.Mesh.prototype.raycast = acceleratedRaycast;
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;

type RobotType = "ur5e" | "kuka_kr6" | "techman_tm12";

interface RobotViewportProps {
  robotType: RobotType;
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

const ROBOTS: Record<RobotType, { label: string; urdf: string }> = {
  ur5e: { label: "Universal Robots UR5e", urdf: "/robots/ur5e/ur5e.urdf" },
  kuka_kr6: { label: "KUKA KR 6 R900", urdf: "/robots/kuka_kr6/kr6.urdf" },
  techman_tm12: { label: "Techman TM12", urdf: "/robots/techman_tm12/tm12.urdf" },
};

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
  return new THREE.Vector3(pose.position.x, pose.position.z, -pose.position.y);
}

export function RobotViewport({
  robotType,
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
  const mountRef = useRef<HTMLDivElement>(null);
  const runtime = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    robot?: THREE.Object3D & { joints?: Record<string, URDFJoint> };
    joints: IKJoint[];
    ee: THREE.Object3D;
    marker: THREE.Mesh;
    trail: THREE.Group;
    collisionPanel: HTMLDivElement | null;
    frame: number;
    step: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [joints, setJoints] = useState<IKJoint[]>([]);
  const [pose, setPose] = useState<Pose>(() => waypointToPose(policy, 0));
  const [collision, setCollision] = useState<string | null>(null);
  const trajectory = useMemo(() => policy?.steps.map((_, index) => sceneVector(waypointToPose(policy, index))) ?? [], [policy]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const width = mount.clientWidth || 720;
    const height = mount.clientHeight || 520;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8fafc);
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.03, 30);
    camera.position.set(1.6, 1.3, 1.7);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0.25, 0.35, 0);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xdbeafe, 1.8));
    const key = new THREE.DirectionalLight(0xffffff, 3.5);
    key.position.set(1.8, 3, 2.4);
    key.castShadow = true;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x0284c7, 1.4);
    rim.position.set(-2, 1.6, -2);
    scene.add(rim);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.8 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    scene.add(new THREE.GridHelper(4, 40, 0x0284c7, 0x94a3b8));

    if (showWorkcell) {
      const table = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 0.6), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.65 }));
      table.position.set(0.35, 0.75, 0);
      table.castShadow = true;
      table.receiveShadow = true;
      scene.add(table);
      const blueBin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshStandardMaterial({ color: 0x0284c7 }));
      blueBin.position.set(0.38, 0.83, 0.16);
      const greenBin = blueBin.clone();
      (greenBin.material as THREE.MeshStandardMaterial) = new THREE.MeshStandardMaterial({ color: 0x059669 });
      greenBin.position.set(0.12, 0.83, -0.24);
      scene.add(blueBin, greenBin);
    }

    const ee = new THREE.AxesHelper(0.16);
    scene.add(ee);
    const marker = new THREE.Mesh(new THREE.SphereGeometry(0.025, 16, 16), new THREE.MeshStandardMaterial({ color: 0x0284c7, emissive: 0x0284c7, emissiveIntensity: 0.3 }));
    scene.add(marker);
    const trail = new THREE.Group();
    scene.add(trail);

    runtime.current = { renderer, scene, camera, controls, joints: [], ee, marker, trail, collisionPanel: null, frame: 0, step: 0 };

    const onResize = () => {
      const nextWidth = mount.clientWidth || width;
      const nextHeight = mount.clientHeight || height;
      renderer.setSize(nextWidth, nextHeight);
      camera.aspect = nextWidth / nextHeight;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    let live = true;
    const animate = () => {
      if (!live || !runtime.current) return;
      runtime.current.controls.update();
      runtime.current.renderer.render(runtime.current.scene, runtime.current.camera);
      requestAnimationFrame(animate);
    };
    animate();

    return () => {
      live = false;
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [showWorkcell]);

  useEffect(() => {
    const state = runtime.current;
    if (!state) return;
    setLoading(true);
    if (state.robot) state.scene.remove(state.robot);
    const loader = new URDFLoader();
    loader.load(
      ROBOTS[robotType].urdf,
      (robot) => {
        robot.rotation.x = -Math.PI / 2;
        robot.traverse((child) => {
          const mesh = child as THREE.Mesh;
          if (mesh.isMesh) {
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.geometry.computeBoundsTree?.();
          }
        });
        state.scene.add(robot);
        state.robot = robot;
        const parsed = Object.entries(robot.joints ?? {})
          .filter(([, joint]) => joint.jointType !== "fixed")
          .map(([name, joint]) => ({
            name,
            value: 0,
            lower: joint.limit?.lower ?? -Math.PI,
            upper: joint.limit?.upper ?? Math.PI,
          }));
        state.joints = parsed;
        setJoints(parsed);
        setLoading(false);
      },
      undefined,
      () => setLoading(false),
    );
  }, [robotType]);

  useEffect(() => {
    const state = runtime.current;
    if (!state?.robot) return;
    const nextPose = waypointToPose(policy, state.step);
    const solution = solveCcdIk(state.joints, nextPose);
    for (const joint of state.joints) {
      const next = jointValues?.[joint.name] ?? solution.joints[joint.name] ?? joint.value;
      const clamped = clamp(next, joint.lower, joint.upper);
      joint.value = clamped;
      state.robot.joints?.[joint.name]?.setJointValue(clamped);
    }
    const vector = sceneVector(nextPose);
    state.ee.position.copy(vector);
    state.marker.position.copy(vector);
    setPose(nextPose);
    onEndEffectorMove?.(nextPose);
    const collides = nextPose.position.z < 0.12 || (nextPose.position.z < 0.78 && nextPose.position.x > -0.05 && nextPose.position.x < 0.75 && Math.abs(nextPose.position.y) < 0.3);
    setCollision(collides ? `Collision detected at waypoint ${state.step + 1} (depth: ${Math.max(1, Math.round((0.78 - nextPose.position.z) * 1000))}mm into table)` : null);
  }, [jointValues, onEndEffectorMove, policy]);

  useEffect(() => {
    if (!trajectory.length || playbackState !== "playing") return;
    const timer = window.setInterval(() => {
      const state = runtime.current;
      if (!state) return;
      state.step = (state.step + 1) % trajectory.length;
      const nextPose = waypointToPose(policy, state.step);
      const solution = solveCcdIk(state.joints, nextPose);
      for (const joint of state.joints) {
        const next = clamp(solution.joints[joint.name] ?? joint.value, joint.lower, joint.upper);
        joint.value = next;
        state.robot?.joints?.[joint.name]?.setJointValue(next);
      }
      const vector = sceneVector(nextPose);
      state.ee.position.copy(vector);
      state.marker.position.copy(vector);
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 8), new THREE.MeshBasicMaterial({ color: 0x0284c7, transparent: true, opacity: 0.35 }));
      dot.position.copy(vector);
      state.trail.add(dot);
      while (state.trail.children.length > 30) state.trail.remove(state.trail.children[0]);
      setPose(nextPose);
      setJoints([...state.joints]);
      const collides = nextPose.position.z < 0.12 || (nextPose.position.z < 0.78 && nextPose.position.x > -0.05 && nextPose.position.x < 0.75 && Math.abs(nextPose.position.y) < 0.3);
      setCollision(collides ? `Collision detected at waypoint ${state.step + 1} (depth: ${Math.max(1, Math.round((0.78 - nextPose.position.z) * 1000))}mm into table)` : null);
    }, Math.max(250, 900 / playbackSpeed));
    return () => window.clearInterval(timer);
  }, [playbackSpeed, playbackState, policy, trajectory.length]);

  useEffect(() => {
    const state = runtime.current;
    if (!state || !showTrajectory) return;
    const group = new THREE.Group();
    if (trajectory.length > 1) {
      const curve = new THREE.CatmullRomCurve3(trajectory);
      const points = curve.getPoints(80);
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: 0x059669, linewidth: 2 }));
      group.add(line);
      trajectory.forEach((point, index) => {
        const marker = new THREE.Mesh(new THREE.SphereGeometry(0.014, 12, 12), new THREE.MeshStandardMaterial({ color: index % 3 === 0 ? 0xd97706 : 0x0284c7 }));
        marker.position.copy(point);
        group.add(marker);
      });
      state.scene.add(group);
    }
    return () => {
      state.scene.remove(group);
    };
  }, [showTrajectory, trajectory]);

  const setPreset = (preset: "front" | "top" | "side" | "iso") => {
    const state = runtime.current;
    if (!state) return;
    const positions = {
      front: new THREE.Vector3(1.4, 0.9, 2),
      top: new THREE.Vector3(0.3, 3.1, 0.01),
      side: new THREE.Vector3(2.1, 1.0, 0),
      iso: new THREE.Vector3(1.6, 1.3, 1.7),
    };
    state.camera.position.copy(positions[preset]);
    state.controls.update();
  };

  return (
    <div className={cn("overflow-hidden rounded-md border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))]", className)}>
      <div className="flex items-center justify-between border-b border-[rgb(var(--steel))] px-3 py-2">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[rgb(var(--signal-cyan))]">Robot viewport</p>
          <p className="text-sm font-medium">{ROBOTS[robotType].label} · Assembly Cell 1</p>
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
          {loading && <div className="absolute inset-0 grid place-items-center bg-[rgb(var(--ink)/0.72)] text-sm">Loading URDF...</div>}
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
                    onChange={(event) => onJointChange?.(joint.name, Number(event.target.value))}
                  />
                </label>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
}

