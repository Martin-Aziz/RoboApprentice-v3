"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { resetWorkspaceDb } from "@/lib/db";
import { getAllFacilities } from "@/lib/repositories/facilities";
import { listRecentExecutions } from "@/lib/repositories/executions";
import { getAllRobots } from "@/lib/repositories/robots";
import { createSkill, getAllSkills } from "@/lib/repositories/skills";
import type { Robot, Skill, SkillExecution } from "@/lib/types";

const EMPTY_FACILITY = {
  id: "loading",
  name: "Production Facility",
  owner_id: "",
  created_at: new Date(0).toISOString(),
  region: "Global",
};

/** Resets the local IndexedDB workspace after an explicit user confirmation/action. */
export async function resetDemoData() {
  await resetWorkspaceDb();
  window.location.reload();
}

/** React Query facade for workspace data retained under the old hook name for a narrow migration. */
export function useDemoData() {
  const queryClient = useQueryClient();
  const facilitiesQuery = useQuery({ queryKey: ["facilities"], queryFn: getAllFacilities });
  const robotsQuery = useQuery({ queryKey: ["robots"], queryFn: getAllRobots });
  const skillsQuery = useQuery({ queryKey: ["skills"], queryFn: getAllSkills });
  const executionsQuery = useQuery({ queryKey: ["executions", "recent"], queryFn: () => listRecentExecutions(120) });

  const addSkillMutation = useMutation({
    mutationFn: createSkill,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["skills"] });
    },
  });

  const robots = robotsQuery.data ?? [];
  const skills = skillsQuery.data ?? [];
  const executions = executionsQuery.data ?? [];

  const metrics = useMemo(() => buildMetrics(robots, skills), [robots, skills]);
  const highlightedRobotId = executions[0]?.robot_id ?? null;

  return {
    facility: facilitiesQuery.data?.[0] ?? EMPTY_FACILITY,
    robots,
    skills,
    executions,
    metrics,
    highlightedRobotId,
    addSkill: (skill: Skill) => addSkillMutation.mutateAsync(skill),
    isLoading: facilitiesQuery.isLoading || robotsQuery.isLoading || skillsQuery.isLoading || executionsQuery.isLoading,
  };
}

function buildMetrics(robots: Robot[], skills: Skill[]) {
  const totalCyclesToday = robots.reduce((sum, robot) => sum + (robot.metrics?.cycles_today ?? 0), 0);
  const successes = skills.reduce((sum, skill) => sum + skill.success_count, 0);
  const runs = skills.reduce((sum, skill) => sum + skill.run_count, 0);
  return {
    robotsOnline: robots.filter((robot) => ["idle", "busy", "running"].includes(robot.status)).length,
    skills: skills.length,
    driftAlerts: skills.filter((skill) => skill.drift_alert).length,
    totalCyclesToday,
    avgSuccessRate: runs ? successes / runs : 0,
    avgUptime: robots.length ? robots.reduce((sum, robot) => sum + (robot.metrics?.uptime_24h ?? 0), 0) / robots.length : 0,
  };
}
