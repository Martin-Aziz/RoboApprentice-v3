import { randomUUID } from "crypto";
import {
  toFanucKarel,
  toRapid,
  toRos2Python,
  toUrscript,
} from "./codegen";
import {
  evaluateRobotWaypoint,
  FeasibilityEngine,
  ROBOT_SPECIFICATIONS,
} from "./feasibility-engine";
import { createImportedTask, getTask } from "./task-store-db";
import { getPassport, savePassport } from "./passport-store";
import type {
  FixtureDesignOutput,
  GripperRecommendation,
  PassportExport,
  PassportImportResult,
  PassportSharingScope,
  PassportWorkcellConfig,
  QualityParameters,
  RobotModel,
  TaskIntent,
  TaskPolicy,
  TaskStep,
  UnreachableWaypoint,
  Waypoint,
} from "./types";

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function buildIntent(task: Awaited<ReturnType<typeof getTask>>): TaskIntent {
  if (!task) throw new Error("Task not found.");
  if (task.taskIntent) return deepClone(task.taskIntent);
  return {
    waypoints: task.steps.map((step) => deepClone(step.target)),
    intentSteps: task.steps.map((step) => ({
      id: step.id,
      order: step.order,
      description: step.description,
      action: step.action,
      target: deepClone(step.target),
      gripper: step.gripper,
      speed: step.speed,
      duration: step.duration,
      requiresVision: step.requiresVision,
      notes: step.notes,
    })),
    approximateSpeeds: task.steps.map((step) => step.speed),
    confidence: "HIGH",
    operationDelaysSeconds: task.steps
      .filter((step) => ["grip", "release", "wait"].includes(step.action))
      .reduce((sum, step) => sum + step.duration, 0),
    cycleTimeSeconds: task.policy?.estimatedCycleSeconds,
  };
}

function defaultQualityParameters(task: NonNullable<Awaited<ReturnType<typeof getTask>>>): QualityParameters {
  const feedback = task.feedback ?? [];
  const successes = feedback.filter((item) => item.verdict === "success").length;
  return {
    cycle_time_target_seconds: task.policy?.estimatedCycleSeconds ?? 0,
    acceptable_tolerance_mm: 2,
    success_rate_baseline: feedback.length ? successes / feedback.length : 0,
  };
}

function sanitizeFixtureSpec(spec: FixtureDesignOutput | null | undefined): FixtureDesignOutput | null {
  if (!spec) return null;
  return {
    fixture_id: spec.fixture_id,
    name: spec.name,
    interface_points: deepClone(spec.interface_points),
    tolerance_mm: spec.tolerance_mm,
    notes: spec.notes,
  };
}

export class PassportExportService {
  async create(input: {
    taskId: string;
    sourceOrgId: string;
    createdBy: string;
    sharingScope: PassportSharingScope;
    recipientOrgId?: string | null;
    sourceRobotModel?: string;
    fixtureSpec?: FixtureDesignOutput | null;
    gripperRecommendations?: GripperRecommendation[] | null;
  }): Promise<PassportExport> {
    const task = await getTask(input.taskId);
    if (!task) throw new Error("Task not found.");
    if (!task.steps.length) throw new Error("A deployed task with motion steps is required.");
    const sourceRobotModel =
      task.robotModel ?? task.targetRobotModels?.[0] ?? input.sourceRobotModel;
    if (!sourceRobotModel) throw new Error("Source robot model is required.");
    if (input.sharingScope === "ORGANISATION" && !input.recipientOrgId) {
      throw new Error("A recipient organisation is required for organisation sharing.");
    }

    const passport: PassportExport = {
      passport_id: randomUUID(),
      source_task_id: task.id,
      source_robot_model: sourceRobotModel,
      source_org_id: input.sourceOrgId,
      task_intent: buildIntent(task),
      fixture_spec: sanitizeFixtureSpec(input.fixtureSpec),
      gripper_recommendation: input.gripperRecommendations
        ? deepClone(input.gripperRecommendations)
        : null,
      quality_parameters: task.qualityParameters ?? defaultQualityParameters(task),
      created_at: new Date().toISOString(),
      created_by: input.createdBy,
      sharing_scope: input.sharingScope,
      recipient_org_id: input.recipientOrgId ?? null,
      share_token:
        input.sharingScope === "SHARED_LINK"
          ? randomUUID().replaceAll("-", "")
          : null,
    };
    await savePassport(passport);
    return passport;
  }
}

function translateWaypoint(point: Waypoint, workcell: PassportWorkcellConfig): Waypoint {
  const fixture = workcell.fixtureOffset ?? { x: 0, y: 0, z: 0 };
  return {
    ...point,
    x: point.x + workcell.origin.x + fixture.x,
    y: point.y + workcell.origin.y + fixture.y,
    z: point.z + workcell.origin.z + fixture.z,
  };
}

function codeTargetForRobot(robotModel: RobotModel) {
  if (robotModel.startsWith("UR")) return "urscript" as const;
  if (robotModel.startsWith("ABB")) return "rapid" as const;
  if (robotModel.startsWith("FANUC")) return "fanuc_karel" as const;
  return "ros2_python" as const;
}

function generateControllerProgram(
  target: ReturnType<typeof codeTargetForRobot>,
  policy: TaskPolicy,
  title: string,
) {
  if (target === "urscript") return toUrscript(policy, title);
  if (target === "rapid") return toRapid(policy, title);
  if (target === "fanuc_karel") return toFanucKarel(policy, title);
  return toRos2Python(policy, title);
}

export class PassportImportService {
  async import(input: {
    passportId: string;
    targetRobotModel: RobotModel;
    targetWorkcellConfig: PassportWorkcellConfig;
    targetFacilityId: string;
    targetOrganisationId: string;
    shareToken?: string | null;
  }): Promise<PassportImportResult> {
    const passport = await getPassport(input.passportId);
    if (!passport) throw new Error("Automation Passport not found.");
    if (
      passport.sharing_scope === "PRIVATE" &&
      passport.source_org_id !== input.targetOrganisationId
    ) {
      throw new Error("This private passport is not available to the target organisation.");
    }
    if (
      passport.sharing_scope === "ORGANISATION" &&
      passport.recipient_org_id !== input.targetOrganisationId &&
      passport.source_org_id !== input.targetOrganisationId
    ) {
      throw new Error("This passport was not shared with the target organisation.");
    }
    if (
      passport.sharing_scope === "SHARED_LINK" &&
      passport.share_token !== input.shareToken &&
      passport.source_org_id !== input.targetOrganisationId
    ) {
      throw new Error("The shared-link token is invalid.");
    }

    const immutableIntent = deepClone(passport.task_intent);
    const originalSnapshot = JSON.stringify(passport.task_intent);
    const sourceSteps = immutableIntent.intentSteps;
    if (!sourceSteps?.length) throw new Error("Passport task intent is missing action semantics.");

    const translatedSteps: TaskStep[] = sourceSteps.map((step) => ({
      ...deepClone(step),
      id: randomUUID(),
      target: translateWaypoint(step.target, input.targetWorkcellConfig),
    }));
    const unreachable: UnreachableWaypoint[] = [];
    translatedSteps.forEach((step, index) => {
      const evaluation = evaluateRobotWaypoint(
        input.targetRobotModel,
        step.target,
        input.targetWorkcellConfig.dimensions,
      );
      if (!evaluation.reachable) {
        unreachable.push({
          waypoint_index: index,
          description: step.description,
          reason: evaluation.reason,
          distance_from_base_m: Number(evaluation.distanceMeters.toFixed(3)),
          robot_reach_m: evaluation.reachMeters,
        });
      }
    });

    const feasibility = new FeasibilityEngine().simulate({
      task_intent: {
        ...immutableIntent,
        waypoints: translatedSteps.map((step) => step.target),
        intentSteps: translatedSteps,
      },
      robot_model: input.targetRobotModel,
      payload_kg: immutableIntent.payloadKg ?? 0,
      workcell_dimensions: input.targetWorkcellConfig.dimensions,
    });
    if (JSON.stringify(passport.task_intent) !== originalSnapshot) {
      throw new Error("Passport task intent mutation detected.");
    }
    if (unreachable.length || feasibility.verdict === "NOT_FEASIBLE") {
      return {
        passport_id: passport.passport_id,
        source_task_id: passport.source_task_id,
        source_robot_model: passport.source_robot_model,
        target_robot_model: input.targetRobotModel,
        new_task_id: null,
        adjusted_waypoint_count: translatedSteps.filter(
          (step, index) =>
            JSON.stringify(step.target) !== JSON.stringify(sourceSteps[index].target),
        ).length,
        unreachable_waypoints: unreachable,
        deployment_blocked: true,
        controller_program_target: null,
        message:
          unreachable.length > 0
            ? `${unreachable.length} waypoint(s) are unreachable. Deployment is blocked until the workcell or intent is reviewed.`
            : feasibility.blocking_reason ?? "Target robot feasibility failed.",
      };
    }

    const policy: TaskPolicy = {
      steps: translatedSteps,
      toolFrame: input.targetWorkcellConfig.toolFrame ?? "tcp_default",
      workspaceBounds: {
        xMin: Math.min(...translatedSteps.map((step) => step.target.x)),
        xMax: Math.max(...translatedSteps.map((step) => step.target.x)),
        yMin: Math.min(...translatedSteps.map((step) => step.target.y)),
        yMax: Math.max(...translatedSteps.map((step) => step.target.y)),
        zMin: Math.min(...translatedSteps.map((step) => step.target.z)),
        zMax: Math.max(...translatedSteps.map((step) => step.target.z)),
      },
      estimatedCycleSeconds: passport.quality_parameters.cycle_time_target_seconds,
    };
    const target = codeTargetForRobot(input.targetRobotModel);
    const title = `Imported task from ${passport.source_robot_model}`;
    const controllerProgram = generateControllerProgram(target, policy, title);
    const newTask = await createImportedTask({
      title,
      description: `Re-planned from Automation Passport ${passport.passport_id}.`,
      facilityId: input.targetFacilityId,
      organisationId: input.targetOrganisationId,
      robotModel: input.targetRobotModel,
      steps: translatedSteps,
      policy,
      taskIntent: immutableIntent,
      controllerProgram,
      controllerProgramTarget: target,
      qualityParameters: passport.quality_parameters,
      originPassportId: passport.passport_id,
      parentTaskId: passport.source_task_id,
    });
    return {
      passport_id: passport.passport_id,
      source_task_id: passport.source_task_id,
      source_robot_model: passport.source_robot_model,
      target_robot_model: input.targetRobotModel,
      new_task_id: newTask.id,
      adjusted_waypoint_count: translatedSteps.filter(
        (step, index) =>
          JSON.stringify(step.target) !== JSON.stringify(sourceSteps[index].target),
      ).length,
      unreachable_waypoints: [],
      deployment_blocked: false,
      controller_program_target: target,
      message: `Task re-planned from ${passport.source_robot_model} to ${input.targetRobotModel}. Review simulation before deploying.`,
    };
  }
}

export const SUPPORTED_PASSPORT_ROBOTS = Object.keys(
  ROBOT_SPECIFICATIONS,
) as RobotModel[];
