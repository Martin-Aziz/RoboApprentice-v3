/**
 * FORGE MIND — k6 Load Test: Authentication endpoints
 *
 * Usage:
 *   k6 run --vus 50 --duration 60s tests/load/auth.js
 *
 * Env vars:
 *   BASE_URL  — API base URL (default: http://localhost:8080)
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:8080";

// ─── Custom metrics ───────────────────────────────────────────────────────────
const registerErrors = new Counter("register_errors");
const loginErrors = new Counter("login_errors");
const loginSuccessRate = new Rate("login_success_rate");
const loginDuration = new Trend("login_duration_ms", true);

// ─── Test configuration ───────────────────────────────────────────────────────
export const options = {
  stages: [
    { duration: "15s", target: 20 },   // ramp up
    { duration: "30s", target: 50 },   // sustained load
    { duration: "15s", target: 0 },    // ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"],  // 95% of requests under 500ms
    http_req_failed: ["rate<0.01"],    // <1% error rate
    login_success_rate: ["rate>0.99"], // >99% login success rate
    login_duration_ms: ["p(95)<400"],  // 95th percentile login <400ms
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function randomEmail() {
  return `loadtest-${Math.random().toString(36).slice(2)}@forge-mind-load.dev`;
}

// ─── Main test scenario ───────────────────────────────────────────────────────
export default function () {
  const email = randomEmail();
  const password = "LoadTestPass123!";

  // 1. Register
  const registerRes = http.post(
    `${BASE_URL}/api/v1/auth/register`,
    JSON.stringify({ email, password, name: "Load Tester" }),
    {
      headers: { "Content-Type": "application/json" },
      tags: { name: "auth.register" },
    }
  );

  const registered = check(registerRes, {
    "register: status 200 or 201": (r) => r.status === 200 || r.status === 201,
  });
  if (!registered) {
    registerErrors.add(1);
    return;
  }

  sleep(0.5);

  // 2. Login
  const start = Date.now();
  const loginRes = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({ email, password }),
    {
      headers: { "Content-Type": "application/json" },
      tags: { name: "auth.login" },
    }
  );
  loginDuration.add(Date.now() - start);

  const loginOk = check(loginRes, {
    "login: status 200": (r) => r.status === 200,
    "login: access_token in body": (r) => {
      try {
        return JSON.parse(r.body).access_token !== undefined;
      } catch {
        return false;
      }
    },
  });
  loginSuccessRate.add(loginOk ? 1 : 0);
  if (!loginOk) {
    loginErrors.add(1);
    return;
  }

  sleep(1);

  // 3. Access protected route (me / profile)
  const token = JSON.parse(loginRes.body).access_token;
  const meRes = http.get(`${BASE_URL}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
    tags: { name: "auth.me" },
  });

  check(meRes, {
    "me: status 200": (r) => r.status === 200,
  });

  sleep(1);
}
