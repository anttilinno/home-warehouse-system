// k6 load test for the read-heavy dashboard + inventory-browse path.
// Run: mise run loadtest  (or: k6 run -e WS=<workspace-uuid> backend/tests/load/dashboard.js)
//
// Logs in once in setup(), then hammers the list/dashboard/analytics endpoints
// a real workspace serves on page load. Thresholds fail the run if p95 > 500ms
// or the error rate climbs above 1%.
//
// NOTE: meaningful at scale only with a volume-seeded workspace. The default
// dev seed is ~64 items, which exercises correctness/latency but not the
// seq-scan/index-gap behaviour that appears at 10k+ rows.
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE || 'http://localhost:8080';
const WS = __ENV.WS;
const EMAIL = __ENV.EMAIL || 'seeder@test.local';
const PASS = __ENV.PASS || 'password123';

export const options = {
  scenarios: {
    ramp: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '10s', target: 10 },
        { duration: '20s', target: 30 },
        { duration: '15s', target: 50 },
        { duration: '10s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
    'http_req_duration{name:dashboard}': ['p(95)<400'],
    'http_req_duration{name:list_items}': ['p(95)<400'],
  },
};

export function setup() {
  if (!WS) throw new Error('set WS=<workspace-uuid> (env)');
  const res = http.post(`${BASE}/auth/login`, JSON.stringify({ email: EMAIL, password: PASS }), {
    headers: { 'Content-Type': 'application/json' },
  });
  check(res, { 'login 200': (r) => r.status === 200 });
  return { token: res.json('token') };
}

export default function (data) {
  const headers = { Authorization: `Bearer ${data.token}` };
  const ws = `${BASE}/workspaces/${WS}`;
  const reqs = {
    list_items: { method: 'GET', url: `${ws}/items?limit=20`, params: { headers, tags: { name: 'list_items' } } },
    dashboard:  { method: 'GET', url: `${ws}/analytics/dashboard`, params: { headers, tags: { name: 'dashboard' } } },
    activity:   { method: 'GET', url: `${ws}/analytics/activity`, params: { headers, tags: { name: 'activity' } } },
    search:     { method: 'GET', url: `${ws}/items/search?q=widget`, params: { headers, tags: { name: 'search' } } },
    categories: { method: 'GET', url: `${ws}/analytics/categories`, params: { headers, tags: { name: 'categories' } } },
  };
  const res = http.batch(reqs);
  for (const k in res) check(res[k], { [`${k} ok`]: (r) => r.status === 200 });
  sleep(0.5);
}
