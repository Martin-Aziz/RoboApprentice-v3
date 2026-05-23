"use client";

import { useEffect, useMemo, useState } from "react";
import { DEMO_EXECUTIONS, DEMO_FACILITIES, DEMO_ROBOTS, DEMO_SKILLS } from "@/lib/demo-seed";
import type { Robot, Skill, SkillExecution } from "@/lib/types";

const SKILLS_KEY = "aurevix_v2_skills";
const EXECUTIONS_KEY = "aurevix_v2_executions";

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function resetDemoData() {
  localStorage.removeItem(SKILLS_KEY);
  localStorage.removeItem(EXECUTIONS_KEY);
  localStorage.removeItem("aurevix_teach_completed");
  window.location.reload();
}

export function useDemoData() {
  const [skills, setSkills] = useState<Skill[]>(DEMO_SKILLS);
  const [executions, setExecutions] = useState<SkillExecution[]>(DEMO_EXECUTIONS);
  const [robots, setRobots] = useState<Robot[]>(DEMO_ROBOTS);
  const [highlightedRobotId, setHighlightedRobotId] = useState<string | null>(null);

  useEffect(() => {
    setSkills(readJson(SKILLS_KEY, DEMO_SKILLS));
    setExecutions(readJson(EXECUTIONS_KEY, DEMO_EXECUTIONS));
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setExecutions((current) => {
        const robot = robots.find((item) => item.status === "running") ?? robots[0];
        const skill = skills.find((item) => item.id === robot.current_skill_id) ?? skills[0];
        const cycle = Math.round((skill.mean_cycle_ms ?? robot.metrics?.mean_cycle_ms ?? 4200) * (0.9 + Math.random() * 0.2));
        const entry: SkillExecution = {
          id: `exe-live-${Date.now()}`,
          skill_id: skill.id,
          robot_id: robot.id,
          status: Math.random() < skill.confidence ? "completed" : "failed",
          started_at: new Date(Date.now() - cycle).toISOString(),
          completed_at: new Date().toISOString(),
          parts_processed: 1,
          error_message: null,
          cycle_ms: cycle,
          quality_score: Math.min(0.99, skill.confidence + Math.random() * 0.04),
        };
        const next = [entry, ...current].slice(0, 80);
        localStorage.setItem(EXECUTIONS_KEY, JSON.stringify(next));
        setHighlightedRobotId(robot.id);
        window.setTimeout(() => setHighlightedRobotId(null), 1200);
        return next;
      });
      setRobots((current) =>
        current.map((robot) =>
          robot.status === "running"
            ? {
                ...robot,
                last_seen_at: new Date().toISOString(),
                metrics: {
                  uptime_24h: robot.metrics?.uptime_24h ?? 98,
                  mean_cycle_ms: robot.metrics?.mean_cycle_ms ?? 4200,
                  cycles_today: (robot.metrics?.cycles_today ?? 0) + 1,
                },
              }
            : robot,
        ),
      );
    }, 9000);
    return () => window.clearInterval(timer);
  }, [robots, skills]);

  const addSkill = (skill: Skill) => {
    setSkills((current) => {
      const next = current.some((item) => item.id === skill.id) ? current : [skill, ...current];
      localStorage.setItem(SKILLS_KEY, JSON.stringify(next));
      return next;
    });
  };

  const metrics = useMemo(() => {
    const totalCyclesToday = robots.reduce((sum, robot) => sum + (robot.metrics?.cycles_today ?? 0), 0);
    const successes = skills.reduce((sum, skill) => sum + skill.success_count, 0);
    const runs = skills.reduce((sum, skill) => sum + skill.run_count, 0);
    return {
      robotsOnline: robots.filter((robot) => ["idle", "busy", "running"].includes(robot.status)).length,
      skills: skills.length,
      driftAlerts: skills.filter((skill) => skill.drift_alert).length,
      totalCyclesToday,
      avgSuccessRate: runs ? successes / runs : 0,
      avgUptime: robots.reduce((sum, robot) => sum + (robot.metrics?.uptime_24h ?? 0), 0) / robots.length,
    };
  }, [robots, skills]);

  return {
    facility: DEMO_FACILITIES[0],
    robots,
    skills,
    executions,
    metrics,
    highlightedRobotId,
    addSkill,
  };
}

