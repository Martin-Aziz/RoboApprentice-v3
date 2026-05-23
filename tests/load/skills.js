/**
 * FORGE MIND — k6 Load Test: Skills CRUD endpoints
 *
 * Usage:
 *   k6 run --vus 30 --duration 60s tests/load/skills.js
 *
 * Env vars:
 *   BASE_URL        — API base URL (default: http://localhost:8080)
 *   SEEDED_TOKEN    — Pre-issued JWT to skip registration overhead (optional)
 *   SEEDED_FACILITY — Pre-created facility UUID (optional)
 */

import http from "k6/http";
import { check, group, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:8080";

// ─── Custom metrics ───────────────────────────────────────────────────────────
const skillCreateErrors = new Counter("skill_create_errors");
const skillListOkRate = new Rate("skill_list_ok_rate");
const skillSearchDuration = new Trend("skill_search_duration_ms", true);

// ─── Test configuration ───────────────────────────────────────────────────────
export const options = {
  stages: [
    { duration: "10s", target: 10 },
    { duration: "40s", target: 30 },
    { duration: "10s", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<600"],
    http_req_failed: ["rate<0.01"],
    skill_list_ok_rate: ["rate>0.99"],
    skill_search_duration_ms: ["p(95)<800"],
  },
};

// ─── Setup: register + create facility once per VU ───────────────────────────
export function setup() {
  if (__ENV.SEEDED_TOKEN && __ENV.SEEDED_FACILITY) {
    return { token: __ENV.SEEDED_TOKEN, facilityId: __ENV.SEEDED_FACILITY };
  }

  const email = `skills-load-${Date.now()}@forge-mind-load.dev`;
  const password = "LoadTestPass123!";

  const regRes = http.post(
    `${BASE_URL}/api/v1/auth/register`,
    JSON.stringify({ email, password, name: "Skills Load" }),
    { headers: { "Content-Type": "application/json" } }
  );
  check(regRes, { "setup: register ok": (r) => r.status === 200 || r.status === 201 });

  const loginRes = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({ email, password }),
    { headers: { "Content-Type": "application/json" } }
  );
  check(loginRes, { "setup: login ok": (r) => r.status === 200 });
  const token = JSON.parse(loginRes.body).access_token;

  const facRes = http.post(
    `${BASE_URL}/api/v1/facilities`,
    JSON.stringify({ name: "Load Test Plant", location: "Virtual" }),
    { headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } }
  );
  check(facRes, { "setup: facility ok": (r) => r.status === 200 || r.status === 201 });
  const facilityId = JSON.parse(facRes.body).id;

  return { token, facilityId };
}

// ─── Main test scenario ───────────────────────────────────────────────────────
export default function ({ token, facilityId }) {
  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  group("skill create + list", () => {
    // Create a skill
    const createRes = http.post(
      `${BASE_URL}/api/v1/facilities/${facilityId}/skills`,
      JSON.stringify({
        name: `Skill-${Math.random().toString(36).slice(2)}`,
        description: "Load test skill",
      }),
      { headers: authHeaders, tags: { name: "skills.create" } }
    );

    const created = check(createRes, {
      "create skill: 200 or 201": (r) => r.status === 200 || r.status === 201,
    });
    if (!created) {
      skillCreateErrors.add(1);
      return;
    }

    sleep(0.2);

    // List skills
    const listRes = http.get(
      `${BASE_URL}/api/v1/facilities/${facilityId}/skills`,
      { headers: authHeaders, tags: { name: "skills.list" } }
    );
    skillListOkRate.add(listRes.status === 200 ? 1 : 0);
    check(listRes, { "list skills: 200": (r) => r.status === 200 });
  });

  sleep(0.5);

  group("skill similarity search", () => {
    const start = Date.now();
    const searchRes = http.get(
      `${BASE_URL}/api/v1/facilities/${facilityId}/skills/similar?q=pick+up+bracket&limit=5`,
      { headers: authHeaders, tags: { name: "skills.similar" } }
    );
    skillSearchDuration.add(Date.now() - start);
    check(searchRes, { "similar search: 200": (r) => r.status === 200 });
  });

  sleep(1);
}
