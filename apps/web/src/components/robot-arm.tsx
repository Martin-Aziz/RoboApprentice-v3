"use client";

import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { cn } from "@/lib/utils";
import type { GripperState, RobotAction, TaskStep } from "@/lib/types";
import {
  HOME_WAYPOINT,
  ROBOT_KINEMATICS,
  TCP_OFFSET,
  calculateTrajectoryMetrics,
  evaluateReachability,
  solveArmPose,
  type ArmPose,
} from "@/lib/robot-kinematics";
import {
  Play,
  Pause,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Route,
  ShieldCheck,
  AlertTriangle,
  Gauge,
} from "lucide-react";

interface RobotArmProps {
  steps: TaskStep[];
  activeStepIndex?: number;
  onStepChange?: (index: number) => void;
  className?: string;
  /** When true the parent controls activeStepIndex; hide internal playback UI */
  controlled?: boolean;
}

const HOME_POSE = solveArmPose(HOME_WAYPOINT, "open");

const ACTION_COLOR_VAR: Record<RobotAction, string> = {
  home: "--signal-iris",
  approach: "--signal-cyan",
  move: "--bone-2",
  grip: "--signal-amber",
  release: "--signal-green",
  rotate: "--signal-iris",
  wait: "--bone-3",
  inspect: "--signal-cyan",
};

function actionCssColor(action: RobotAction | undefined): string {
  return `rgb(var(${ACTION_COLOR_VAR[action ?? "move"]}))`;
}

function cssColor(varName: string, fallback: string): THREE.Color {
  if (typeof window === "undefined") {
    const [r, g, b] = fallback.split(/\s+/).map(Number);
    return new THREE.Color(r / 255, g / 255, b / 255);
  }

  const raw =
    getComputedStyle(document.documentElement).getPropertyValue(varName).trim() ||
    fallback;
  const [r, g, b] = raw.split(/\s+/).map(Number);
  return new THREE.Color(r / 255, g / 255, b / 255);
}

function actionThreeColor(action: RobotAction | undefined): THREE.Color {
  const fallback: Record<RobotAction, string> = {
    home: "109 40 217",
    approach: "2 132 199",
    move: "71 85 105",
    grip: "217 119 6",
    release: "5 150 105",
    rotate: "109 40 217",
    wait: "148 163 184",
    inspect: "2 132 199",
  };
  const key = action ?? "move";
  return cssColor(ACTION_COLOR_VAR[key], fallback[key]);
}

function toSceneVector(target: { x: number; y: number; z: number }) {
  return new THREE.Vector3(target.x, target.z, -target.y);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function disposeMaterial(material: THREE.Material | THREE.Material[]) {
  if (Array.isArray(material)) {
    material.forEach((m) => m.dispose());
    return;
  }
  material.dispose();
}

function disposeChildren(group: THREE.Group) {
  group.traverse((child) => {
    const mesh = child as THREE.Mesh | THREE.Line | THREE.Points;
    if ("geometry" in mesh && mesh.geometry) mesh.geometry.dispose();
    if ("material" in mesh && mesh.material) disposeMaterial(mesh.material);
  });
  group.clear();
}

function makeLink(length: number, radiusTop: number, radiusBottom: number, mat: THREE.Material) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radiusTop, radiusBottom, length, 18),
    mat,
  );
  mesh.position.y = length / 2;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function updatePose(current: ArmPose, target: ArmPose, smooth: number) {
  current.baseYaw = lerp(current.baseYaw, target.baseYaw, smooth);
  current.shoulder = lerp(current.shoulder, target.shoulder, smooth);
  current.elbow = lerp(current.elbow, target.elbow, smooth);
  current.wrist = lerp(current.wrist, target.wrist, smooth);
  current.toolYaw = lerp(current.toolYaw, target.toolYaw, smooth);
  current.gripperGap = lerp(current.gripperGap, target.gripperGap, smooth);
}

function poseForStep(step: TaskStep | null): ArmPose {
  return step ? solveArmPose(step.target, step.gripper) : HOME_POSE;
}

export function RobotArm({
  steps,
  activeStepIndex: externalIndex = -1,
  onStepChange,
  className,
  controlled = false,
}: RobotArmProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    joints: {
      base: THREE.Object3D;
      shoulder: THREE.Object3D;
      elbow: THREE.Object3D;
      wrist: THREE.Object3D;
      toolYaw: THREE.Object3D;
      leftFinger: THREE.Mesh;
      rightFinger: THREE.Mesh;
      tcpMarker: THREE.Mesh;
    };
    waypointMarkers: THREE.Group[];
    waypointGroup: THREE.Group;
    trailGroup: THREE.Group;
    activeTargetGroup: THREE.Group;
    target: ArmPose;
    current: ArmPose;
  } | null>(null);

  const [initialized, setInitialized] = useState(false);
  const [internalIndex, setInternalIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const playTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeIndex = controlled ? externalIndex : internalIndex;
  const activeStep = steps[activeIndex] ?? null;
  const hasSteps = steps.length > 0;
  const showPlayback = hasSteps && !controlled;
  const metrics = useMemo(() => calculateTrajectoryMetrics(steps), [steps]);
  const activeReach = activeStep ? evaluateReachability(activeStep.target) : null;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth || 520;
    const height = mount.clientHeight || 380;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    mount.appendChild(renderer.domElement);

    const ink = cssColor("--bone", "15 23 42");
    const ink2 = cssColor("--ink-2", "255 255 255");
    const cyan = cssColor("--signal-cyan", "2 132 199");
    const amber = cssColor("--signal-amber", "217 119 6");
    const green = cssColor("--signal-green", "5 150 105");
    const red = cssColor("--signal-red", "220 38 38");
    const steel = cssColor("--steel-2", "148 163 184");

    const scene = new THREE.Scene();
    scene.background = ink.clone().multiplyScalar(0.62);
    scene.fog = new THREE.Fog(ink.clone().multiplyScalar(0.62), 9, 24);

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.05, 80);
    camera.position.set(4.3, 3.0, 4.9);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 2.6;
    controls.maxDistance = 9;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.target.set(0.15, 0.7, 0);
    controls.update();

    scene.add(new THREE.HemisphereLight(ink2, ink, 2.2));
    const key = new THREE.DirectionalLight(cyan, 4.6);
    key.position.set(4.5, 7, 3);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 24;
    scene.add(key);

    const rim = new THREE.DirectionalLight(amber, 1.6);
    rim.position.set(-4, 3, -4);
    scene.add(rim);

    const floorGeo = new THREE.PlaneGeometry(8.5, 8.5);
    const floorMat = new THREE.MeshStandardMaterial({
      color: ink.clone().multiplyScalar(0.44),
      roughness: 0.82,
      metalness: 0,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const grid = new THREE.GridHelper(
      8.5,
      34,
      cyan.clone().multiplyScalar(0.7),
      steel.clone().multiplyScalar(0.45),
    );
    grid.material.transparent = true;
    grid.material.opacity = 0.42;
    scene.add(grid);

    const reachRing = new THREE.Mesh(
      new THREE.TorusGeometry(ROBOT_KINEMATICS.workspace.xMax, 0.004, 8, 128),
      new THREE.MeshBasicMaterial({
        color: cyan,
        transparent: true,
        opacity: 0.38,
      }),
    );
    reachRing.rotation.x = Math.PI / 2;
    reachRing.position.y = ROBOT_KINEMATICS.minFloorClearance + 0.003;
    scene.add(reachRing);

    const workspace = ROBOT_KINEMATICS.workspace;
    const workspaceBox = new THREE.LineSegments(
      new THREE.EdgesGeometry(
        new THREE.BoxGeometry(
          workspace.xMax - workspace.xMin,
          workspace.zMax - workspace.zMin,
          workspace.yMax - workspace.yMin,
        ),
      ),
      new THREE.LineBasicMaterial({
        color: cyan,
        transparent: true,
        opacity: 0.24,
      }),
    );
    workspaceBox.position.set(
      (workspace.xMin + workspace.xMax) / 2,
      (workspace.zMin + workspace.zMax) / 2,
      -(workspace.yMin + workspace.yMax) / 2,
    );
    scene.add(workspaceBox);

    const axes = new THREE.Group();
    axes.add(new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0.025, 0), 0.75, red));
    axes.add(new THREE.ArrowHelper(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0.025, 0), 0.75, amber));
    axes.add(new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0.025, 0), 0.65, green));
    scene.add(axes);

    const armMat = new THREE.MeshStandardMaterial({
      color: cssColor("--bone-2", "71 85 105"),
      metalness: 0.78,
      roughness: 0.22,
    });
    const jointMat = new THREE.MeshStandardMaterial({
      color: cyan,
      metalness: 0.72,
      roughness: 0.16,
      emissive: cyan.clone().multiplyScalar(0.35),
      emissiveIntensity: 0.45,
    });
    const fingerMat = new THREE.MeshStandardMaterial({
      color: cyan.clone().lerp(ink2, 0.22),
      metalness: 0.7,
      roughness: 0.18,
      emissive: cyan.clone().multiplyScalar(0.42),
      emissiveIntensity: 0.58,
    });

    const base = new THREE.Object3D();
    const baseMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(
        ROBOT_KINEMATICS.baseRadius,
        ROBOT_KINEMATICS.baseRadius * 1.35,
        0.32,
        40,
      ),
      armMat,
    );
    baseMesh.position.y = 0.16;
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    const baseRing = new THREE.Mesh(
      new THREE.TorusGeometry(ROBOT_KINEMATICS.baseRadius * 1.12, 0.022, 10, 48),
      jointMat,
    );
    baseRing.rotation.x = Math.PI / 2;
    baseRing.position.y = 0.325;
    base.add(baseMesh, baseRing);
    scene.add(base);

    const shoulder = new THREE.Object3D();
    shoulder.position.y = ROBOT_KINEMATICS.shoulderHeight;
    const shoulderJoint = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 28, 18),
      jointMat,
    );
    shoulderJoint.castShadow = true;
    shoulder.add(shoulderJoint);
    shoulder.add(
      makeLink(
        ROBOT_KINEMATICS.upperArmLength,
        0.092,
        0.112,
        armMat,
      ),
    );
    base.add(shoulder);

    const elbow = new THREE.Object3D();
    elbow.position.y = ROBOT_KINEMATICS.upperArmLength;
    const elbowJoint = new THREE.Mesh(
      new THREE.SphereGeometry(0.165, 26, 16),
      jointMat,
    );
    elbowJoint.castShadow = true;
    elbow.add(elbowJoint);
    elbow.add(
      makeLink(
        ROBOT_KINEMATICS.lowerArmLength,
        0.074,
        0.092,
        armMat,
      ),
    );
    shoulder.add(elbow);

    const wrist = new THREE.Object3D();
    wrist.position.y = ROBOT_KINEMATICS.lowerArmLength;
    const wristJoint = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 22, 14),
      jointMat,
    );
    wristJoint.castShadow = true;
    wrist.add(wristJoint);
    wrist.add(makeLink(ROBOT_KINEMATICS.wristLength, 0.052, 0.07, armMat));
    elbow.add(wrist);

    const toolYaw = new THREE.Object3D();
    toolYaw.position.y = ROBOT_KINEMATICS.wristLength;
    wrist.add(toolYaw);

    const palm = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.08, 0.12),
      jointMat,
    );
    palm.position.y = 0.035;
    palm.castShadow = true;
    toolYaw.add(palm);

    const fingerGeo = new THREE.BoxGeometry(0.055, 0.25, 0.05);
    const leftFinger = new THREE.Mesh(fingerGeo, fingerMat);
    const rightFinger = new THREE.Mesh(fingerGeo, fingerMat);
    leftFinger.position.set(-0.1, ROBOT_KINEMATICS.gripperTcpOffset, 0);
    rightFinger.position.set(0.1, ROBOT_KINEMATICS.gripperTcpOffset, 0);
    leftFinger.castShadow = true;
    rightFinger.castShadow = true;
    toolYaw.add(leftFinger, rightFinger);

    const tcpMarker = new THREE.Mesh(
      new THREE.SphereGeometry(0.026, 14, 10),
      new THREE.MeshBasicMaterial({
        color: green,
        transparent: true,
        opacity: 0.92,
      }),
    );
    tcpMarker.position.y = ROBOT_KINEMATICS.gripperTcpOffset;
    toolYaw.add(tcpMarker);

    const gripLight = new THREE.PointLight(cyan, 1.1, 1.7);
    gripLight.position.y = TCP_OFFSET;
    wrist.add(gripLight);

    const waypointGroup = new THREE.Group();
    const trailGroup = new THREE.Group();
    const activeTargetGroup = new THREE.Group();
    scene.add(trailGroup, waypointGroup, activeTargetGroup);

    const joints = {
      base,
      shoulder,
      elbow,
      wrist,
      toolYaw,
      leftFinger,
      rightFinger,
      tcpMarker,
    };
    const target: ArmPose = { ...HOME_POSE };
    const current: ArmPose = { ...HOME_POSE };
    let animFrameId = 0;

    function animate() {
      animFrameId = requestAnimationFrame(animate);
      updatePose(current, target, 0.075);

      base.rotation.y = current.baseYaw;
      shoulder.rotation.z = -current.shoulder;
      elbow.rotation.z = -current.elbow;
      wrist.rotation.z = current.wrist;
      toolYaw.rotation.y = current.toolYaw;
      leftFinger.position.x = -0.052 - current.gripperGap * 0.07;
      rightFinger.position.x = 0.052 + current.gripperGap * 0.07;

      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    const resizeObserver = new ResizeObserver(() => {
      const w = mount.clientWidth || width;
      const h = mount.clientHeight || height;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
    resizeObserver.observe(mount);

    sceneRef.current = {
      renderer,
      scene,
      camera,
      controls,
      joints,
      waypointMarkers: [],
      waypointGroup,
      trailGroup,
      activeTargetGroup,
      target,
      current,
    };
    setInitialized(true);

    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(animFrameId);
      controls.dispose();
      disposeChildren(waypointGroup);
      disposeChildren(trailGroup);
      disposeChildren(activeTargetGroup);
      scene.traverse((child) => {
        const mesh = child as THREE.Mesh | THREE.Line | THREE.Points;
        if ("geometry" in mesh && mesh.geometry) mesh.geometry.dispose();
        if ("material" in mesh && mesh.material) disposeMaterial(mesh.material);
      });
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!sceneRef.current || !initialized) return;
    const { waypointGroup, trailGroup } = sceneRef.current;
    disposeChildren(waypointGroup);
    disposeChildren(trailGroup);

    if (steps.length === 0) {
      sceneRef.current.waypointMarkers = [];
      return;
    }

    const pathPoints = [HOME_WAYPOINT, ...steps.map((step) => step.target)].map(
      toSceneVector,
    );

    if (pathPoints.length > 1) {
      // Display smoothing only: the Catmull-Rom tube eases the eye between
      // waypoints but implies no planned arc or clearance — the planned path
      // is the straight per-step segments drawn below, and the HUD says so.
      const curve = new THREE.CatmullRomCurve3(pathPoints, false, "centripetal", 0.18);
      const tube = new THREE.Mesh(
        new THREE.TubeGeometry(curve, Math.max(24, steps.length * 14), 0.007, 8, false),
        new THREE.MeshBasicMaterial({
          color: cssColor("--signal-cyan", "2 132 199"),
          transparent: true,
          opacity: 0.14,
        }),
      );
      trailGroup.add(tube);

      steps.forEach((step, index) => {
        const start = index === 0 ? HOME_WAYPOINT : steps[index - 1].target;
        const segmentGeo = new THREE.BufferGeometry().setFromPoints([
          toSceneVector(start),
          toSceneVector(step.target),
        ]);
        const segment = new THREE.Line(
          segmentGeo,
          new THREE.LineBasicMaterial({
            color: actionThreeColor(step.action),
            transparent: true,
            opacity: 0.58,
          }),
        );
        trailGroup.add(segment);
      });
    }

    const markers: THREE.Group[] = [];
    steps.forEach((step, index) => {
      const marker = new THREE.Group();
      const reachable = evaluateReachability(step.target).reachable;
      const color = reachable
        ? actionThreeColor(step.action)
        : cssColor("--signal-red", "220 38 38");
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(index === activeIndex ? 0.062 : 0.045, 16, 12),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: index === activeIndex ? 1 : 0.68,
        }),
      );
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.08, 0.003, 6, 28),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: index === activeIndex ? 0.75 : 0.32,
        }),
      );
      ring.rotation.x = Math.PI / 2;
      marker.position.copy(toSceneVector(step.target));
      marker.add(sphere, ring);
      waypointGroup.add(marker);
      markers.push(marker);
    });
    sceneRef.current.waypointMarkers = markers;
  }, [steps, initialized, activeIndex]);

  useEffect(() => {
    if (!sceneRef.current || !initialized) return;
    const { waypointMarkers, activeTargetGroup } = sceneRef.current;

    waypointMarkers.forEach((marker, index) => {
      const step = steps[index];
      const reach = step ? evaluateReachability(step.target) : null;
      const color =
        reach?.reachable === false
          ? cssColor("--signal-red", "220 38 38")
          : actionThreeColor(step?.action);

      marker.children.forEach((child) => {
        const mesh = child as THREE.Mesh;
        const mat = mesh.material as THREE.MeshBasicMaterial;
        mat.color.copy(color);
        mat.opacity = index === activeIndex ? 1 : 0.46;
      });
      marker.scale.setScalar(index === activeIndex ? 1.55 : 1);
    });

    disposeChildren(activeTargetGroup);
    const step = steps[activeIndex];
    if (!step) return;

    const target = toSceneVector(step.target);
    const reachable = evaluateReachability(step.target).reachable;
    const color = reachable
      ? actionThreeColor(step.action)
      : cssColor("--signal-red", "220 38 38");

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.13, 0.004, 8, 48),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.92,
      }),
    );
    ring.position.copy(target);
    ring.rotation.x = Math.PI / 2;

    const vertical = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(target.x, ROBOT_KINEMATICS.minFloorClearance, target.z),
        target,
      ]),
      new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.42,
      }),
    );

    const start = activeIndex === 0 ? HOME_WAYPOINT : steps[activeIndex - 1].target;
    const activeSegment = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([toSceneVector(start), target]),
      new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 1,
      }),
    );

    activeTargetGroup.add(ring, vertical, activeSegment);
  }, [activeIndex, initialized, steps]);

  useEffect(() => {
    if (!sceneRef.current || !initialized) return;
    Object.assign(sceneRef.current.target, poseForStep(activeStep));
  }, [activeStep, initialized]);

  const stopPlayback = useCallback(() => {
    if (playTimerRef.current) {
      clearTimeout(playTimerRef.current);
      playTimerRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const advanceStep = useCallback(() => {
    setInternalIndex((previous) => {
      const next = previous + 1;
      if (next >= steps.length) {
        setIsPlaying(false);
        onStepChange?.(0);
        return 0;
      }
      onStepChange?.(next);
      return next;
    });
  }, [steps.length, onStepChange]);

  useEffect(() => {
    if (!isPlaying || steps.length === 0) return;

    const currentStep = steps[internalIndex] ?? steps[0];
    const durationMs = Math.max(800, (currentStep?.duration ?? 2) * 600);
    playTimerRef.current = setTimeout(advanceStep, durationMs);

    return () => {
      if (playTimerRef.current) clearTimeout(playTimerRef.current);
    };
  }, [advanceStep, internalIndex, isPlaying, steps]);

  function startPlayback() {
    if (steps.length === 0) return;
    if (internalIndex < 0 || internalIndex >= steps.length) {
      setInternalIndex(0);
      onStepChange?.(0);
    }
    setIsPlaying(true);
  }

  function handlePrev() {
    stopPlayback();
    setInternalIndex((previous) => {
      const next = Math.max(0, previous - 1);
      onStepChange?.(next);
      return next;
    });
  }

  function handleNext() {
    stopPlayback();
    setInternalIndex((previous) => {
      const next = Math.min(steps.length - 1, previous + 1);
      onStepChange?.(next);
      return next;
    });
  }

  function handleRestart() {
    stopPlayback();
    setInternalIndex(0);
    onStepChange?.(0);
  }

  useEffect(() => {
    if (controlled || externalIndex >= 0) setInternalIndex(externalIndex);
  }, [controlled, externalIndex]);

  return (
    <div
      ref={mountRef}
      className={cn("relative w-full overflow-hidden rounded-lg bg-[rgb(var(--bone))]", className)}
    >
      {hasSteps && (
        <div className="pointer-events-none absolute left-3 top-3 right-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded border border-[rgb(var(--ink-2)/0.12)] bg-[rgb(var(--bone)/0.74)] px-2 py-1 font-mono text-[10px] text-[rgb(var(--ink-2)/0.86)] backdrop-blur">
            <Route className="h-3 w-3 text-[rgb(var(--signal-cyan))]" />
            {metrics.pathLengthMeters.toFixed(2)} m path
          </span>
          <span className="inline-flex items-center gap-1.5 rounded border border-[rgb(var(--ink-2)/0.12)] bg-[rgb(var(--bone)/0.74)] px-2 py-1 font-mono text-[10px] text-[rgb(var(--ink-2)/0.86)] backdrop-blur">
            <Gauge className="h-3 w-3 text-[rgb(var(--signal-amber))]" />
            {metrics.averageTcpSpeed.toFixed(2)} m/s avg
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded border px-2 py-1 font-mono text-[10px] backdrop-blur",
              metrics.unreachableSteps > 0
                ? "border-[rgb(var(--signal-red)/0.35)] bg-[rgb(var(--signal-red)/0.16)] text-[rgb(var(--ink-2))]"
                : "border-[rgb(var(--signal-green)/0.3)] bg-[rgb(var(--signal-green)/0.16)] text-[rgb(var(--ink-2))]",
            )}
          >
            {metrics.unreachableSteps > 0 ? (
              <AlertTriangle className="h-3 w-3" />
            ) : (
              <ShieldCheck className="h-3 w-3" />
            )}
            {metrics.unreachableSteps > 0
              ? `${metrics.unreachableSteps} reach flag${metrics.unreachableSteps === 1 ? "" : "s"}`
              : "reach verified"}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded border border-[rgb(var(--ink-2)/0.12)] bg-[rgb(var(--bone)/0.74)] px-2 py-1 font-mono text-[10px] text-[rgb(var(--ink-2)/0.62)] backdrop-blur">
            solid lines = planned segments · faint tube = display smoothing
          </span>
        </div>
      )}

      {hasSteps && activeIndex >= 0 && activeStep && (
        <div className="absolute bottom-[52px] left-3 right-3 rounded-lg border border-[rgb(var(--ink-2)/0.12)] bg-[rgb(var(--bone)/0.78)] px-3 py-2 text-xs backdrop-blur">
          <div className="flex items-center gap-2">
            <span
              className="rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider"
              style={{
                color: actionCssColor(activeStep.action),
                background: `color-mix(in srgb, ${actionCssColor(activeStep.action)} 20%, transparent)`,
              }}
            >
              {activeStep.action}
            </span>
            <span className="min-w-0 flex-1 truncate font-semibold text-[rgb(var(--ink-2)/0.92)]">
              {activeStep.description}
            </span>
            <span
              className={cn(
                "shrink-0 font-mono text-[10px] tabular",
                activeReach?.reachable
                  ? "text-[rgb(var(--signal-green))]"
                  : "text-[rgb(var(--signal-red))]",
              )}
            >
              {activeReach?.reachable ? "within envelope" : activeReach?.reason}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] text-[rgb(var(--ink-2)/0.54)]">
            <span>
              TCP ({activeStep.target.x.toFixed(3)}, {activeStep.target.y.toFixed(3)}, {activeStep.target.z.toFixed(3)})
            </span>
            <span>{activeStep.speed.toFixed(2)} m/s</span>
            <span>{activeStep.duration}s</span>
            <span>gripper {activeStep.gripper}</span>
          </div>
        </div>
      )}

      {showPlayback && (
        <div className="absolute bottom-0 left-0 right-0 flex items-center gap-1 border-t border-[rgb(var(--ink-2)/0.12)] bg-[rgb(var(--bone)/0.86)] px-3 py-2 backdrop-blur">
          <button
            type="button"
            onClick={handleRestart}
            title="Restart"
            disabled={internalIndex <= 0}
            className="flex h-7 w-7 items-center justify-center rounded text-[rgb(var(--ink-2)/0.62)] transition-colors hover:bg-[rgb(var(--ink-2)/0.1)] hover:text-[rgb(var(--ink-2))] disabled:cursor-not-allowed disabled:opacity-30"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handlePrev}
            title="Previous step"
            disabled={internalIndex <= 0}
            className="flex h-7 w-7 items-center justify-center rounded text-[rgb(var(--ink-2)/0.62)] transition-colors hover:bg-[rgb(var(--ink-2)/0.1)] hover:text-[rgb(var(--ink-2))] disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={isPlaying ? stopPlayback : startPlayback}
            title={isPlaying ? "Pause" : "Play trajectory"}
            className="flex h-7 w-7 items-center justify-center rounded bg-[rgb(var(--signal-cyan))] text-[rgb(var(--ink-2))] shadow-sm transition-colors hover:bg-[rgb(var(--signal-cyan)/0.86)]"
          >
            {isPlaying ? (
              <Pause className="h-3.5 w-3.5" />
            ) : (
              <Play className="ml-0.5 h-3.5 w-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={handleNext}
            title="Next step"
            disabled={internalIndex >= steps.length - 1}
            className="flex h-7 w-7 items-center justify-center rounded text-[rgb(var(--ink-2)/0.62)] transition-colors hover:bg-[rgb(var(--ink-2)/0.1)] hover:text-[rgb(var(--ink-2))] disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="mx-2 flex-1">
            <input
              type="range"
              min={0}
              max={Math.max(0, steps.length - 1)}
              value={Math.max(0, internalIndex)}
              onChange={(event) => {
                stopPlayback();
                const index = Number(event.target.value);
                setInternalIndex(index);
                onStepChange?.(index);
              }}
              className="h-1 w-full cursor-pointer accent-[rgb(var(--signal-cyan))]"
            />
          </div>
          <span className="shrink-0 font-mono text-[10px] tabular-nums text-[rgb(var(--ink-2)/0.62)]">
            {internalIndex >= 0 ? internalIndex + 1 : "-"} / {steps.length}
          </span>
          <button
            type="button"
            onClick={() => {
              stopPlayback();
              setInternalIndex(steps.length - 1);
              onStepChange?.(steps.length - 1);
            }}
            title="Jump to last step"
            disabled={internalIndex >= steps.length - 1}
            className="flex h-7 w-7 items-center justify-center rounded text-[rgb(var(--ink-2)/0.62)] transition-colors hover:bg-[rgb(var(--ink-2)/0.1)] hover:text-[rgb(var(--ink-2))] disabled:cursor-not-allowed disabled:opacity-30"
          >
            <SkipForward className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {!hasSteps && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="font-mono text-sm text-[rgb(var(--ink-2)/0.56)]">
            awaiting trajectory data...
          </p>
        </div>
      )}
    </div>
  );
}
