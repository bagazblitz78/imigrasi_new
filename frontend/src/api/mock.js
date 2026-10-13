// ─────────────────────────────────────────────────────────────────────────────
// DEMO / OFFLINE MODE
//
// Serves realistic static data so the UI can be explored without a backend or
// database. Enabled only when `VITE_USE_MOCK=true` (see .env.mock / `npm run
// dev:mock`). Nothing here runs in a normal production build.
// ─────────────────────────────────────────────────────────────────────────────

const now = Date.now();
const iso = (msAgo) => new Date(now - msAgo).toISOString();
const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

// ── State ────────────────────────────────────────────────────────────────────
const state = {
  currentUserId: 1, // 1 = admin (demo opens on the admin dashboard)
  loggedOut: false,
  counters: [
    { id: 1, name: "Konter A-1", location: "Terminal 2 Internasional", status: "active", created_at: iso(200 * DAY), active_agent_name: "Petugas Andi" },
    { id: 2, name: "Konter A-2", location: "Terminal 2 Internasional", status: "active", created_at: iso(200 * DAY), active_agent_name: "Petugas Sari" },
    { id: 3, name: "Konter B-1", location: "Terminal 3 Domestik", status: "break", created_at: iso(150 * DAY), active_agent_name: null },
    { id: 4, name: "Konter B-2", location: "Terminal 3 Domestik", status: "inactive", created_at: iso(150 * DAY), active_agent_name: null },
  ],
  users: [
    { id: 1, username: "admin", email: "admin@imigrasi.go.id", full_name: "Administrator Pusdatin", role: "admin", is_active: true, counter_id: null, created_at: iso(300 * DAY) },
    { id: 2, username: "supervisor1", email: "spv1@imigrasi.go.id", full_name: "Kepala Regu Budi", role: "supervisor", is_active: true, counter_id: null, created_at: iso(290 * DAY) },
    { id: 3, username: "agent1", email: "agent1@imigrasi.go.id", full_name: "Petugas Andi", role: "agent", is_active: true, counter_id: 1, created_at: iso(200 * DAY) },
    { id: 4, username: "agent2", email: "agent2@imigrasi.go.id", full_name: "Petugas Sari", role: "agent", is_active: true, counter_id: 2, created_at: iso(180 * DAY) },
    { id: 5, username: "agent3", email: "agent3@imigrasi.go.id", full_name: "Petugas Rudi", role: "agent", is_active: false, counter_id: null, created_at: iso(120 * DAY) },
  ],
  passengers: [],
  escalations: [],
  voa: [],
  blacklist: [
    { id: 1, passport_number: "XX1234567", full_name: "John Doe Suspect", nationality: "Unknown", type: "both", reason: "Tersangka tindak pidana penyelundupan", is_active: true, added_by: 1, created_at: iso(60 * DAY) },
    { id: 2, passport_number: "YY9876543", full_name: null, nationality: "Country X", type: "passport", reason: "Dokumen palsu", is_active: true, added_by: 1, created_at: iso(45 * DAY) },
    { id: 3, passport_number: null, full_name: "Jane Smith Banned", nationality: null, type: "name", reason: "Overstay > 6 bulan", is_active: true, added_by: 1, created_at: iso(30 * DAY) },
  ],
  notifications: [],
  audit: [],
};

let seq = { passenger: 100, escalation: 50, voa: 20, blacklist: 3, notification: 100, audit: 500, counter: 4, user: 5 };

// ── Seed passengers / escalations / VOA / audit ──────────────────────────────
const NAMES = [
  ["Budi Santoso", "Indonesia"], ["Siti Nurhaliza", "Indonesia"], ["John Smith", "United Kingdom"],
  ["Tanaka Kenji", "Japan"], ["Li Wei", "China"], ["Maria Garcia", "Spain"],
  ["Ahmed Al-Rashid", "United Arab Emirates"], ["Kim Min-jun", "South Korea"],
  ["Nguyen Van An", "Vietnam"], ["Somchai P.", "Thailand"], ["Asep Sunandar", "Indonesia"],
  ["Emily Watson", "United States"], ["Ravi Kumar", "India"], ["Fatima Zahra", "Morocco"],
  ["Peter Muller", "Germany"], ["Yuki Sato", "Japan"], ["Dewi Lestari", "Indonesia"],
  ["Mohamed Salah", "Egypt"], ["Anna Kowalski", "Poland"], ["Carlos Silva", "Brazil"],
];
const STATUSES = ["pending", "approved", "approved", "approved", "hold", "deported", "rejected", "approved"];
const VISA = ["Tourist", "Business", "VOA", "Social", null, "Transit"];

function makeName(i) {
  return NAMES[i % NAMES.length];
}

for (let i = 0; i < 46; i += 1) {
  const [name, nat] = makeName(i);
  const status = STATUSES[i % STATUSES.length];
  const direction = i % 3 === 0 ? "departure" : "arrival";
  const createdAgo = (i % 10) * 25 * MIN + (i % 4) * 40 * MIN;
  const blHit = name === "John Doe Suspect" ? "Tersangka tindak pidana penyelundupan" : null;
  const id = ++seq.passenger;
  state.passengers.push({
    id,
    full_name: name,
    passport_number: `P${String(1000000 + id)}`,
    nationality: nat,
    visa_type: VISA[i % VISA.length],
    flight_number: `${["GA", "SQ", "MH", "CX", "JL"][i % 5]}-${300 + i}`,
    direction,
    status: status === "pending" && blHit ? "hold" : status,
    blacklist_hit: blHit,
    notes: i % 7 === 0 ? "Pemeriksaan tambahan singkat" : null,
    agent_id: i % 2 === 0 ? 3 : 4,
    agent_name: i % 2 === 0 ? "Petugas Andi" : "Petugas Sari",
    counter_id: i % 2 === 0 ? 1 : 2,
    counter_name: i % 2 === 0 ? "Konter A-1" : "Konter A-2",
    processed_at: status === "pending" ? null : iso(createdAgo - 5 * MIN),
    created_at: iso(createdAgo),
  });
}

// Hold passengers get escalations
state.passengers
  .filter((p) => p.status === "hold")
  .forEach((p, idx) => {
    const id = ++seq.escalation;
    state.escalations.push({
      id,
      passenger_id: p.id,
      passenger_name: p.full_name,
      passenger_passport: p.passport_number,
      passenger_nationality: p.nationality,
      passenger_direction: p.direction,
      agent_id: p.agent_id,
      agent_name: p.agent_name,
      supervisor_id: null,
      reason: p.blacklist_hit || "Perlu verifikasi dokumen tambahan",
      decision: "pending",
      decision_notes: null,
      notified: true,
      created_at: iso(idx * 30 * MIN + 20 * MIN),
      resolved_at: null,
    });
  });

// A couple of decided escalations for history
for (let i = 0; i < 3; i += 1) {
  const p = state.passengers[i + 5];
  const id = ++seq.escalation;
  state.escalations.push({
    id,
    passenger_id: p.id,
    passenger_name: p.full_name,
    passenger_passport: p.passport_number,
    passenger_nationality: p.nationality,
    passenger_direction: p.direction,
    agent_id: p.agent_id,
    agent_name: p.agent_name,
    supervisor_id: 2,
    reason: "Verifikasi lanjutan",
    decision: i === 0 ? "approved" : i === 1 ? "deported" : "rejected",
    decision_notes: "Diputuskan oleh supervisor",
    notified: true,
    created_at: iso((i + 2) * DAY),
    resolved_at: iso((i + 2) * DAY - HOUR),
  });
}

// VOA applications
[7, 9, 12, 15, 22].forEach((pi, i) => {
  const p = state.passengers[pi];
  const id = ++seq.voa;
  state.voa.push({
    id,
    passenger_id: p.id,
    passenger_name: p.full_name,
    passenger_passport: p.passport_number,
    passenger_nationality: p.nationality,
    supervisor_id: i < 2 ? 2 : null,
    duration_days: [30, 30, 60, 14, 30][i],
    fee_paid: i !== 2,
    status: i < 2 ? "approved" : i === 2 ? "rejected" : "pending",
    rejection_reason: i === 2 ? "Biaya belum dibayar" : null,
    applied_at: iso(i * 6 * HOUR + HOUR),
    processed_at: i < 3 ? iso(i * 5 * HOUR) : null,
  });
});

// Audit log
const AUDIT_ACTIONS = ["LOGIN", "SCAN_PASSPORT", "APPROVE_PASSENGER", "HOLD_PASSENGER", "ESCALATION_APPROVED", "ADD_BLACKLIST", "LOGOUT", "CREATE_USER"];
for (let i = 0; i < 40; i += 1) {
  const u = [1, 2, 3, 4][i % 4];
  state.audit.push({
    id: ++seq.audit,
    user_id: u,
    user_name: state.users.find((x) => x.id === u)?.full_name || "Sistem",
    action: AUDIT_ACTIONS[i % AUDIT_ACTIONS.length],
    target_type: ["passenger", "blacklist", "user", null][i % 4],
    target_id: i % 4 === 3 ? null : (i % 20) + 1,
    detail: ["Login berhasil", "Paspor: A123***78 | BL: CLEAR", "Paspor: B987***11", "Alasan: Verifikasi dokumen"][i % 4],
    ip_address: `10.10.${i % 5}.${20 + (i % 30)}`,
    request_id: `demo-${i}`,
    created_at: iso(i * 22 * MIN),
  });
}

// Notifications for supervisor/admin
state.notifications = [
  { id: ++seq.notification, user_id: 1, type: "ESCALATION_CREATED", title: "Hold: John Doe Suspect", message: "Tersangka tindak pidana penyelundupan", severity: "danger", is_read: false, target_type: "escalation", target_id: 1, created_at: iso(20 * MIN) },
  { id: ++seq.notification, user_id: 1, type: "VOA_DECIDED", title: "VOA approved", message: "Li Wei", severity: "info", is_read: false, target_type: "voa", target_id: 2, created_at: iso(2 * HOUR) },
  { id: ++seq.notification, user_id: 1, type: "ESCALATION_CREATED", title: "Hold: Emily Watson", message: "Perlu verifikasi dokumen", severity: "danger", is_read: true, target_type: "escalation", target_id: 2, created_at: iso(3 * HOUR) },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
function json(status, data) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
function err(status, code, message) {
  return json(status, { error: { code, message, details: null, request_id: "demo" } });
}
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const normPassport = (v) => (v ? v.toUpperCase().replace(/[^A-Z0-9]/g, "") : null);
const normName = (v) => (v ? v.trim().toUpperCase().replace(/\s+/g, " ") : null);
const currentUser = () => state.users.find((u) => u.id === state.currentUserId);
const int = (params, key, def) => {
  const v = parseInt(params.get(key), 10);
  return Number.isFinite(v) ? v : def;
};

function paginate(list, params) {
  const page = int(params, "page", 1);
  const pageSize = int(params, "page_size", 25);
  const total = list.length;
  const pages = Math.ceil(total / pageSize) || 0;
  const start = (page - 1) * pageSize;
  return { items: list.slice(start, start + pageSize), total, page, page_size: pageSize, pages };
}

function sortList(list, params, keyMap, defaultKey, defaultOrder = "desc") {
  const sort = params.get("sort") || defaultKey;
  const order = params.get("order") || defaultOrder;
  const key = keyMap[sort] || defaultKey;
  return [...list].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (av == null) return 1;
    if (bv == null) return -1;
    const cmp = typeof av === "number" ? av - bv : String(av).localeCompare(String(bv));
    return order === "asc" ? cmp : -cmp;
  });
}

function passengerResponse(p) {
  return { ...p };
}

function addAudit(action, target_type, target_id, detail, user = currentUser()) {
  state.audit.unshift({
    id: ++seq.audit,
    user_id: user?.id ?? null,
    user_name: user?.full_name ?? "Sistem",
    action,
    target_type,
    target_id,
    detail,
    ip_address: "10.10.0.1",
    request_id: `demo-${seq.audit}`,
    created_at: new Date().toISOString(),
  });
}

function checkBlacklist(passport, name) {
  const p = normPassport(passport);
  const n = normName(name);
  return state.blacklist.find(
    (b) => b.is_active && ((p && normPassport(b.passport_number) === p) || (n && normName(b.full_name) === n)),
  );
}

// ── Router ───────────────────────────────────────────────────────────────────
export async function mockRequest(method, path, options = {}) {
  await delay(220 + Math.random() * 200);
  const [pathname, query] = path.split("?");
  const params = new URLSearchParams(query || "");
  const seg = pathname.split("/").filter(Boolean);
  const body = options.body || {};

  const routes = [
    ["auth", "login", "POST", () => authLogin(options)],
    ["auth", "refresh", "POST", () => (state.loggedOut ? err(401, "session_expired", "Sesi berakhir") : json(200, { access_token: "demo-token", token_type: "bearer", expires_in: 900 }))],
    ["auth", "logout", "POST", () => { state.loggedOut = true; return json(200, { message: "ok" }); }],
    ["auth", "me", "GET", () => json(200, currentUser())],
    ["auth", "change-password", "POST", () => json(200, { message: "ok" })],

    ["passengers", "dashboard", "agent", "GET", () => agentDashboard()],
    ["passengers", "scan-mrz", "POST", () => mrzResult()],

    ["escalations", "dashboard", "supervisor", "GET", () => supervisorDashboard()],

    ["reports", "audit-logs", "GET", () => listAudit(params)],
    ["reports", "passengers", "stats", "GET", () => stats()],
    ["reports", "dashboard", "admin", "GET", () => adminDashboard()],
    ["reports", "passengers", "export-csv", "GET", () => csvResponse()],

    ["notifications", "unread-count", "GET", () => json(200, { unread: myNotifications().filter((n) => !n.is_read).length })],
    ["notifications", "read-all", "POST", () => { myNotifications().forEach((n) => (n.is_read = true)); return json(200, { message: "ok" }); }],
    ["notifications", "stream-ticket", "POST", () => json(200, { ticket: "demo-ticket" })],
    ["notifications", "GET", () => json(200, myNotifications())],
  ];

  // static multi-segment routes first
  for (const route of routes) {
    const [rMethod, handler] = [route[route.length - 2], route[route.length - 1]];
    const rSeg = route.slice(0, -2);
    if (rMethod === method && rSeg.length === seg.length && rSeg.every((s, i) => s === seg[i])) {
      return handler();
    }
  }

  // dynamic routes
  if (method === "GET" && seg[0] === "passengers" && seg.length === 1) return listPassengers(params);
  if (method === "POST" && seg[0] === "passengers" && seg.length === 1) return createPassenger(body);
  if (method === "GET" && seg[0] === "passengers" && seg.length === 2) return getPassenger(seg[1]);
  if (method === "GET" && seg[0] === "passengers" && seg[3] === "history") return passengerHistory(seg[1]);
  if (method === "PATCH" && seg[0] === "passengers" && seg[2] === "status") return updateStatus(seg[1], body);
  if (method === "POST" && seg[0] === "passengers" && seg[2] === "approve") return approvePassenger(seg[1]);

  if (method === "GET" && seg[0] === "escalations" && seg.length === 1) return listEscalations(params);
  if (method === "POST" && seg[0] === "escalations" && seg.length === 1) return createEscalation(body);
  if (method === "PATCH" && seg[0] === "escalations" && seg[2] === "decide") return decideEscalation(seg[1], body);

  if (method === "GET" && seg[0] === "voa" && seg.length === 1) return listVoa(params);
  if (method === "POST" && seg[0] === "voa" && seg.length === 1) return createVoa(body);
  if (method === "PATCH" && seg[0] === "voa" && seg[2] === "decide") return decideVoa(seg[1], body);

  if (method === "GET" && seg[0] === "counters" && seg.length === 1) return json(200, state.counters);
  if (method === "POST" && seg[0] === "counters" && seg.length === 1) return createCounter(body);
  if (method === "PATCH" && seg[0] === "counters" && seg.length === 2) return updateCounter(seg[1], body);

  if (method === "GET" && seg[0] === "blacklist" && seg.length === 1) return listBlacklist(params);
  if (method === "POST" && seg[0] === "blacklist" && seg.length === 1) return createBlacklist(body);
  if (method === "PATCH" && seg[0] === "blacklist" && seg.length === 2) return updateBlacklist(seg[1], body);
  if (method === "DELETE" && seg[0] === "blacklist" && seg.length === 2) return removeBlacklist(seg[1]);

  if (method === "GET" && seg[0] === "users" && seg.length === 1) return listUsers(params);
  if (method === "POST" && seg[0] === "users" && seg.length === 1) return createUser(body);
  if (method === "PATCH" && seg[0] === "users" && seg.length === 2) return updateUser(seg[1], body);
  if (method === "DELETE" && seg[0] === "users" && seg.length === 2) return deactivateUser(seg[1]);
  if (method === "POST" && seg[0] === "users" && seg[2] === "reset-password") return json(200, { message: "ok" });

  if (method === "POST" && seg[0] === "notifications" && seg[2] === "read") {
    const n = state.notifications.find((x) => String(x.id) === seg[1]);
    if (n) n.is_read = true;
    return json(200, { message: "ok" });
  }

  return err(404, "not_found", `Rute demo tidak dikenal: ${method} ${path}`);
}

// ── Handlers ─────────────────────────────────────────────────────────────────
function authLogin(options) {
  const form = options.form;
  const username = form?.get?.("username") || "admin";
  const user =
    state.users.find((u) => u.username === username) ||
    state.users.find((u) => (username.includes("supervisor") ? u.role === "supervisor" : username.includes("agent") ? u.role === "agent" : u.role === "admin")) ||
    state.users[0];
  state.currentUserId = user.id;
  state.loggedOut = false;
  addAudit("LOGIN", null, null, "Login demo", user);
  return json(200, {
    access_token: `demo-token-${user.id}`,
    token_type: "bearer",
    expires_in: 900,
    user,
    csrf_token: "demo-csrf",
  });
}

function agentDashboard() {
  const user = currentUser();
  const mine = state.passengers.filter((p) => p.agent_id === user.id);
  const counter = state.counters.find((c) => c.id === user.counter_id);
  return json(200, {
    checked_today: mine.length,
    counter_status: counter?.status || null,
    counter_name: counter?.name || null,
    last_10_passengers: mine.slice(0, 10).map(passengerResponse),
  });
}

function supervisorDashboard() {
  const pending = state.escalations.filter((e) => e.decision === "pending");
  const holds = state.passengers.filter((p) => p.status === "hold");
  return json(200, {
    pending_escalations: pending.length,
    urgent_escalations: pending.length,
    active_counters: state.counters.filter((c) => c.status === "active").length,
    total_arrivals_today: state.passengers.filter((p) => p.direction === "arrival").length,
    total_departures_today: state.passengers.filter((p) => p.direction === "departure").length,
    pending_voa: state.voa.filter((v) => v.status === "pending").length,
    hold_today: holds.length,
    oldest_pending_escalation_minutes: pending.length ? Math.round((now - new Date(pending[0].created_at).getTime()) / MIN) : null,
  });
}

function adminDashboard() {
  return json(200, {
    total_users: state.users.length,
    active_users: state.users.filter((u) => u.is_active).length,
    total_blacklist: state.blacklist.length,
    active_blacklist: state.blacklist.filter((b) => b.is_active).length,
    audit_events_today: state.audit.length,
    total_passengers_today: state.passengers.length,
  });
}

function stats() {
  const byNat = {};
  state.passengers.forEach((p) => { byNat[p.nationality] = (byNat[p.nationality] || 0) + 1; });
  const count = (s) => state.passengers.filter((p) => p.status === s).length;
  return json(200, {
    total_today: state.passengers.length,
    arrivals_today: state.passengers.filter((p) => p.direction === "arrival").length,
    departures_today: state.passengers.filter((p) => p.direction === "departure").length,
    hold_today: count("hold"),
    approved_today: count("approved"),
    pending_today: count("pending"),
    deported_today: count("deported"),
    rejected_today: count("rejected"),
    by_nationality: byNat,
  });
}

function listPassengers(params) {
  let list = [...state.passengers];
  const user = currentUser();
  if (user.role === "agent") list = list.filter((p) => p.agent_id === user.id);
  const status = params.get("status");
  const direction = params.get("direction");
  const search = (params.get("search") || "").toLowerCase();
  if (status) list = list.filter((p) => p.status === status);
  if (direction) list = list.filter((p) => p.direction === direction);
  if (search) list = list.filter((p) => [p.full_name, p.passport_number, p.flight_number, p.nationality].some((v) => (v || "").toLowerCase().includes(search)));
  list = sortList(list, params, { created_at: "created_at", full_name: "full_name", passport_number: "passport_number", status: "status", nationality: "nationality" }, "created_at", "desc");
  return json(200, paginate(list, params));
}

function getPassenger(id) {
  const p = state.passengers.find((x) => String(x.id) === String(id));
  return p ? json(200, passengerResponse(p)) : err(404, "not_found", "Data penumpang tidak ditemukan");
}

function passengerHistory(id) {
  const rows = state.audit.filter((a) => a.target_type === "passenger" && String(a.target_id) === String(id)).slice(0, 20);
  return json(200, rows.map((a) => ({ id: a.id, action: a.action, detail: a.detail, user_id: a.user_id, created_at: a.created_at })));
}

function createPassenger(body) {
  const user = currentUser();
  const hit = checkBlacklist(body.passport_number, body.full_name);
  const id = ++seq.passenger;
  const passenger = {
    id,
    full_name: body.full_name,
    passport_number: (body.passport_number || "").toUpperCase(),
    nationality: body.nationality,
    visa_type: body.visa_type || null,
    flight_number: body.flight_number || null,
    direction: body.direction || "arrival",
    status: hit ? "hold" : "pending",
    blacklist_hit: hit ? hit.reason : null,
    notes: body.notes || null,
    agent_id: user.id,
    agent_name: user.full_name,
    counter_id: user.counter_id,
    counter_name: state.counters.find((c) => c.id === user.counter_id)?.name || null,
    processed_at: null,
    created_at: new Date().toISOString(),
  };
  state.passengers.unshift(passenger);
  addAudit("SCAN_PASSPORT", "passenger", id, `Paspor: ${passenger.passport_number} | BL: ${hit ? "HIT" : "CLEAR"}`);

  if (hit) {
    const escId = ++seq.escalation;
    state.escalations.unshift({
      id: escId,
      passenger_id: id,
      passenger_name: passenger.full_name,
      passenger_passport: passenger.passport_number,
      passenger_nationality: passenger.nationality,
      passenger_direction: passenger.direction,
      agent_id: user.id,
      agent_name: user.full_name,
      supervisor_id: null,
      reason: hit.reason,
      decision: "pending",
      decision_notes: null,
      notified: true,
      created_at: new Date().toISOString(),
      resolved_at: null,
    });
    notifySupervisors("ESCALATION_CREATED", `Blacklist hit: ${passenger.full_name}`, hit.reason, "escalation", escId);
  }
  return json(201, passengerResponse(passenger));
}

function updateStatus(id, body) {
  const p = state.passengers.find((x) => String(x.id) === String(id));
  if (!p) return err(404, "not_found", "Tidak ditemukan");
  p.status = body.status || p.status;
  if (body.notes !== undefined) p.notes = body.notes;
  p.processed_at = new Date().toISOString();
  addAudit(`UPDATE_STATUS_${String(p.status).toUpperCase()}`, "passenger", p.id);
  return json(200, passengerResponse(p));
}

function approvePassenger(id) {
  const p = state.passengers.find((x) => String(x.id) === String(id));
  if (!p) return err(404, "not_found", "Tidak ditemukan");
  if (p.blacklist_hit) return err(422, "validation_error", "Penumpang terdeteksi blacklist");
  p.status = "approved";
  p.processed_at = new Date().toISOString();
  addAudit("APPROVE_PASSENGER", "passenger", p.id, `Paspor: ${p.passport_number}`);
  return json(200, passengerResponse(p));
}

function listEscalations(params) {
  let list = [...state.escalations];
  const decision = params.get("decision");
  if (decision) list = list.filter((e) => e.decision === decision);
  list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return json(200, paginate(list, params));
}

function createEscalation(body) {
  const p = state.passengers.find((x) => x.id === body.passenger_id);
  if (!p) return err(404, "not_found", "Penumpang tidak ditemukan");
  p.status = "hold";
  const user = currentUser();
  const id = ++seq.escalation;
  const esc = {
    id, passenger_id: p.id, passenger_name: p.full_name, passenger_passport: p.passport_number,
    passenger_nationality: p.nationality, passenger_direction: p.direction,
    agent_id: user.id, agent_name: user.full_name, supervisor_id: null,
    reason: body.reason || null, decision: "pending", decision_notes: null,
    notified: true, created_at: new Date().toISOString(), resolved_at: null,
  };
  state.escalations.unshift(esc);
  addAudit("HOLD_PASSENGER", "escalation", id, `Alasan: ${body.reason || "-"}`);
  notifySupervisors("ESCALATION_CREATED", `Hold: ${p.full_name}`, body.reason, "escalation", id);
  return json(201, esc);
}

function decideEscalation(id, body) {
  const esc = state.escalations.find((x) => String(x.id) === String(id));
  if (!esc) return err(404, "not_found", "Eskalasi tidak ditemukan");
  esc.decision = body.decision;
  esc.decision_notes = body.decision_notes || null;
  esc.supervisor_id = currentUser().id;
  esc.resolved_at = new Date().toISOString();
  const p = state.passengers.find((x) => x.id === esc.passenger_id);
  if (p) {
    p.status = { approved: "approved", deported: "deported", rejected: "rejected" }[body.decision] || p.status;
    p.processed_at = new Date().toISOString();
  }
  addAudit(`ESCALATION_${String(body.decision).toUpperCase()}`, "passenger", esc.passenger_id, `Eskalasi #${id}`);
  return json(200, esc);
}

function listVoa(params) {
  let list = [...state.voa];
  const status = params.get("status");
  if (status) list = list.filter((v) => v.status === status);
  list.sort((a, b) => new Date(b.applied_at) - new Date(a.applied_at));
  return json(200, paginate(list, params));
}

function createVoa(body) {
  const p = state.passengers.find((x) => x.id === body.passenger_id);
  if (!p) return err(404, "not_found", "Penumpang tidak ditemukan");
  const id = ++seq.voa;
  const voa = {
    id, passenger_id: p.id, passenger_name: p.full_name, passenger_passport: p.passport_number,
    passenger_nationality: p.nationality, supervisor_id: null, duration_days: body.duration_days || 30,
    fee_paid: !!body.fee_paid, status: "pending", rejection_reason: null,
    applied_at: new Date().toISOString(), processed_at: null,
  };
  state.voa.unshift(voa);
  addAudit("APPLY_VOA", "voa", id);
  return json(201, voa);
}

function decideVoa(id, body) {
  const v = state.voa.find((x) => String(x.id) === String(id));
  if (!v) return err(404, "not_found", "VOA tidak ditemukan");
  v.status = body.status;
  v.rejection_reason = body.rejection_reason || null;
  v.supervisor_id = currentUser().id;
  v.processed_at = new Date().toISOString();
  addAudit(`VOA_${String(body.status).toUpperCase()}`, "voa", v.id);
  return json(200, v);
}

function createCounter(body) {
  const c = { id: ++seq.counter, name: body.name, location: body.location || null, status: "inactive", created_at: new Date().toISOString(), active_agent_name: null };
  state.counters.push(c);
  addAudit("CREATE_COUNTER", "counter", c.id);
  return json(201, c);
}

function updateCounter(id, body) {
  const c = state.counters.find((x) => String(x.id) === String(id));
  if (!c) return err(404, "not_found", "Konter tidak ditemukan");
  Object.assign(c, body);
  addAudit("UPDATE_COUNTER", "counter", c.id);
  return json(200, c);
}

function listBlacklist(params) {
  let list = [...state.blacklist];
  const active = params.get("is_active");
  const search = (params.get("search") || "").toLowerCase();
  if (active !== null && active !== "" && active !== undefined) list = list.filter((b) => String(b.is_active) === active);
  if (search) list = list.filter((b) => [b.full_name, b.passport_number, b.nationality].some((v) => (v || "").toLowerCase().includes(search)));
  list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return json(200, paginate(list, params));
}

function createBlacklist(body) {
  if (!body.passport_number && !body.full_name) return err(422, "validation_error", "Isi minimal paspor atau nama");
  const b = {
    id: ++seq.blacklist, passport_number: body.passport_number || null, full_name: body.full_name || null,
    nationality: body.nationality || null, type: body.type || "passport", reason: body.reason || null,
    is_active: true, added_by: currentUser().id, created_at: new Date().toISOString(),
  };
  state.blacklist.unshift(b);
  addAudit("ADD_BLACKLIST", "blacklist", b.id);
  return json(201, b);
}

function updateBlacklist(id, body) {
  const b = state.blacklist.find((x) => String(x.id) === String(id));
  if (!b) return err(404, "not_found", "Tidak ditemukan");
  Object.assign(b, body);
  addAudit("UPDATE_BLACKLIST", "blacklist", b.id);
  return json(200, b);
}

function removeBlacklist(id) {
  const b = state.blacklist.find((x) => String(x.id) === String(id));
  if (!b) return err(404, "not_found", "Tidak ditemukan");
  b.is_active = false;
  addAudit("REMOVE_BLACKLIST", "blacklist", b.id);
  return json(200, { message: "ok" });
}

function listUsers(params) {
  let list = [...state.users];
  const search = (params.get("search") || "").toLowerCase();
  const role = params.get("role");
  if (role) list = list.filter((u) => u.role === role);
  if (search) list = list.filter((u) => [u.username, u.full_name, u.email].some((v) => (v || "").toLowerCase().includes(search)));
  list.sort((a, b) => a.id - b.id);
  return json(200, paginate(list, params));
}

function createUser(body) {
  const u = { id: ++seq.user, username: body.username, email: body.email, full_name: body.full_name, role: body.role || "agent", is_active: true, counter_id: body.counter_id || null, created_at: new Date().toISOString() };
  state.users.push(u);
  addAudit("CREATE_USER", "user", u.id);
  return json(201, u);
}

function updateUser(id, body) {
  const u = state.users.find((x) => String(x.id) === String(id));
  if (!u) return err(404, "not_found", "User tidak ditemukan");
  Object.assign(u, body);
  addAudit("UPDATE_USER", "user", u.id);
  return json(200, u);
}

function deactivateUser(id) {
  const u = state.users.find((x) => String(x.id) === String(id));
  if (!u) return err(404, "not_found", "User tidak ditemukan");
  u.is_active = false;
  addAudit("DEACTIVATE_USER", "user", u.id);
  return json(200, { message: "ok" });
}

function listAudit(params) {
  let list = [...state.audit];
  const action = params.get("action");
  const userId = params.get("user_id");
  if (action) list = list.filter((a) => a.action.includes(action));
  if (userId) list = list.filter((a) => String(a.user_id) === userId);
  return json(200, paginate(list, params));
}

function mrzResult() {
  return json(200, {
    document_type: "passport",
    valid: true,
    errors: [],
    document_number: "A12345678",
    surname: "SANTOSO",
    given_names: "BUDI",
    nationality: "IDN",
    birth_date: "1990-05-14",
    sex: "M",
    expiry_date: "2030-05-14",
    raw_mrz: "P<IDNSANTOSO<<BUDI<<<<<<<<<<<<<<<<<<<<<<<<<<<\nA123456789IDN9005145M3005147<<<<<<<<<<<<<<02",
  });
}

function csvResponse() {
  const header = "ID,Nama Lengkap,No Paspor,Kebangsaan,Arah,Status,Blacklist Hit,Petugas,Dibuat\n";
  const rows = state.passengers
    .map((p) => [p.id, p.full_name, maskP(p.passport_number), p.nationality, p.direction, p.status, p.blacklist_hit ? "YA" : "TIDAK", p.agent_name, p.created_at].join(","))
    .join("\n");
  return new Response(header + rows, { status: 200, headers: { "Content-Type": "text/csv; charset=utf-8" } });
}
function maskP(v) {
  if (!v || v.length <= 5) return v || "";
  return `${v.slice(0, 4)}${"*".repeat(v.length - 6)}${v.slice(-2)}`;
}

function myNotifications() {
  const uid = currentUser().id;
  return state.notifications.filter((n) => n.user_id === uid).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function notifySupervisors(type, title, message, targetType, targetId) {
  state.users
    .filter((u) => u.role === "supervisor" || u.role === "admin")
    .forEach((u) => {
      state.notifications.unshift({
        id: ++seq.notification, user_id: u.id, type, title, message: message || null,
        severity: type === "ESCALATION_CREATED" ? "danger" : "info",
        is_read: false, target_type: targetType, target_id: targetId, created_at: new Date().toISOString(),
      });
    });
}
