// k6 scenario-based load test.
//
//   k6 run -e BASE="https://domain/imigrasi/api/v1" -e USER=agent1 -e PASS=secret scripts/load_test.js
//
// Simulates realistic officer behaviour: login, list passengers, open dashboard,
// and create a passenger (which triggers the blacklist check + audit write).
import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate } from "k6/metrics";

const BASE = __ENV.BASE || "http://localhost:8000/api/v1";
const USER = __ENV.USER || "agent1";
const PASS = __ENV.PASS || "Agent123!";

const listLatency = new Trend("passenger_list_latency", true);
const createLatency = new Trend("passenger_create_latency", true);
const errors = new Rate("app_errors");

export const options = {
  // Tune stages to match the number of active counters.
  stages: [
    { duration: "30s", target: 5 },
    { duration: "1m", target: 20 },
    { duration: "1m", target: 20 },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<800"],
    app_errors: ["rate<0.01"],
  },
};

export function setup() {
  const res = http.post(
    `${BASE}/auth/login`,
    `username=${encodeURIComponent(USER)}&password=${encodeURIComponent(PASS)}`,
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
  );
  check(res, { "login ok": (r) => r.status === 200 });
  return { token: res.json("access_token") };
}

export default function (data) {
  const authHeaders = { headers: { Authorization: `Bearer ${data.token}` } };

  const list = http.get(`${BASE}/passengers/?page=1&page_size=25`, authHeaders);
  listLatency.add(list.timings.duration);
  errors.add(list.status >= 500);
  check(list, { "list 200": (r) => r.status === 200 });

  const dash = http.get(`${BASE}/passengers/dashboard/agent`, authHeaders);
  check(dash, { "dashboard 200": (r) => r.status === 200 });

  // Unique passport per iteration to avoid business-level dedupe noise.
  const passport = `LT${__VU}${__ITER}`.padEnd(10, "0").slice(0, 10);
  const create = http.post(
    `${BASE}/passengers/`,
    JSON.stringify({
      full_name: "Uji Beban",
      passport_number: passport,
      nationality: "Indonesia",
      direction: "arrival",
    }),
    { headers: { ...authHeaders.headers, "Content-Type": "application/json" } },
  );
  createLatency.add(create.timings.duration);
  errors.add(create.status >= 500);
  check(create, { "create 201/200": (r) => r.status === 201 || r.status === 200 });

  sleep(1);
}
