import type { QueryClient } from "@tanstack/react-query";
import { createExecution } from "@/lib/repositories/executions";
import { getAllRobots, updateRobot } from "@/lib/repositories/robots";
import { getAllSkills, updateSkill } from "@/lib/repositories/skills";
import type { Robot, Skill, SkillExecution } from "@/lib/types";

function chooseRunningRobot(robots: Robot[]) {
  return robots.filter((robot) => robot.status === "running")[0] ?? robots[0];
}

function cycleFor(skill: Skill, robot: Robot) {
  const base = skill.mean_cycle_ms ?? robot.metrics?.mean_cycle_ms ?? 4200;
  return Math.round(base * (0.92 + Math.random() * 0.16));
}

/** Runs a real persisted execution stream while the browser app is open. */
export function startExecutionSimulator(queryClient: QueryClient) {
  let stopped = false;
  let timer: number | undefined;

  const tick = async () => {
    if (stopped) return;
    const [robots, skills] = await Promise.all([getAllRobots(), getAllSkills()]);
    const robot = chooseRunningRobot(robots);
    const skill = skills.find((item) => item.id === robot?.current_skill_id) ?? skills[0];
    if (robot && skill) {
      const cycle = cycleFor(skill, robot);
      const success = Math.random() <= skill.confidence;
      const execution: SkillExecution = {
        id: `exe-live-${crypto.randomUUID()}`,
        skill_id: skill.id,
        robot_id: robot.id,
        status: success ? "completed" : "failed",
        started_at: new Date(Date.now() - cycle).toISOString(),
        completed_at: new Date().toISOString(),
        parts_processed: success ? 1 : 0,
        error_message: success ? null : "Quality threshold missed during placement verification",
        cycle_ms: cycle,
        quality_score: Math.max(0.55, Math.min(0.99, skill.confidence + (Math.random() - 0.5) * 0.08)),
      };
      await createExecution(execution);
      await updateRobot(robot.id, {
        last_seen_at: new Date().toISOString(),
        metrics: {
          uptime_24h: robot.metrics?.uptime_24h ?? 98,
          mean_cycle_ms: robot.metrics?.mean_cycle_ms ?? cycle,
          cycles_today: (robot.metrics?.cycles_today ?? 0) + 1,
        },
      });
      await updateSkill(skill.id, {
        run_count: skill.run_count + 1,
        success_count: skill.success_count + (success ? 1 : 0),
        last_executed_at: new Date().toISOString(),
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["robots"] }),
        queryClient.invalidateQueries({ queryKey: ["skills"] }),
        queryClient.invalidateQueries({ queryKey: ["executions"] }),
      ]);
    }
    timer = window.setTimeout(tick, 8_000 + Math.random() * 17_000);
  };

  timer = window.setTimeout(tick, 4_000);
  return () => {
    stopped = true;
    if (timer) window.clearTimeout(timer);
  };
}
