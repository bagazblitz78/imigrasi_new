// Centralised API client.
// - Keeps the short-lived access token in memory only (never localStorage).
// - Uses the HttpOnly refresh cookie + CSRF double-submit to renew sessions.
// - Normalises errors, supports cancellation/timeout and single 401 retry.

export const API_BASE = import.meta.env.VITE_API_BASE || "/imigrasi/api/v1";
export const CSRF_COOKIE_NAME = "imigrasi_csrf";
export const CSRF_HEADER = "X-CSRF-Token";
// Demo/offline mode: serve static fixtures instead of hitting the backend.
export const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";

let accessToken = null;
let onUnauthorized = () => {};
let refreshPromise = null;

export function setAccessToken(token) {
  accessToken = token;
}
export function getAccessToken() {
  return accessToken;
}
export function setOnUnauthorized(fn) {
  onUnauthorized = fn;
}

export function readCookie(name) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export class ApiError extends Error {
  constructor(message, { status = 0, code = "error", details = null } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function parseError(res) {
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON error body */
  }
  const message =
    data?.error?.message || data?.detail || `Permintaan gagal (${res.status})`;
  return new ApiError(message, {
    status: res.status,
    code: data?.error?.code || "error",
    details: data?.error?.details || null,
  });
}

function buildSignal(externalSignal, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException("timeout", "TimeoutError")), timeoutMs);
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener("abort", () => controller.abort(), { once: true });
  }
  return { signal: controller.signal, cleanup: () => clearTimeout(timer) };
}

async function rawRequest(method, path, options = {}) {
  if (USE_MOCK) {
    const { mockRequest } = await import("./mock");
    return mockRequest(method, path, options);
  }

  const {
    body,
    form,
    signal: externalSignal,
    timeoutMs = 30000,
    auth = true,
    headers: extraHeaders = {},
  } = options;

  const headers = { ...extraHeaders };
  if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let requestBody;
  if (form instanceof FormData) {
    requestBody = form;
  } else if (form instanceof URLSearchParams) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    requestBody = form;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    requestBody = JSON.stringify(body);
  }

  const { signal, cleanup } = buildSignal(externalSignal, timeoutMs);
  try {
    return await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: requestBody,
      credentials: "include",
      signal,
    });
  } finally {
    cleanup();
  }
}

async function performRefresh() {
  const csrf = readCookie(CSRF_COOKIE_NAME);
  const res = await rawRequest("POST", "/auth/refresh", {
    auth: false,
    headers: csrf ? { [CSRF_HEADER]: csrf } : {},
  });
  if (!res.ok) throw await parseError(res);
  const data = await res.json();
  accessToken = data.access_token;
  return accessToken;
}

export async function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = performRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export async function apiRequest(method, path, options = {}) {
  let res;
  try {
    res = await rawRequest(method, path, options);
  } catch (err) {
    if (err?.name === "AbortError" || err?.name === "TimeoutError") throw err;
    throw new ApiError("Tidak dapat menghubungi server. Periksa koneksi Anda.", {
      status: 0,
      code: "network_error",
    });
  }

  if (res.status === 401 && options.auth !== false && !options._retried) {
    try {
      await refreshSession();
    } catch {
      onUnauthorized();
      throw new ApiError("Sesi berakhir. Silakan login kembali.", { status: 401, code: "session_expired" });
    }
    return apiRequest(method, path, { ...options, _retried: true });
  }

  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return null;
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return res.json();
  return res.text();
}

export const api = {
  get: (path, options) => apiRequest("GET", path, options),
  post: (path, body, options) => apiRequest("POST", path, { ...options, body }),
  patch: (path, body, options) => apiRequest("PATCH", path, { ...options, body }),
  del: (path, options) => apiRequest("DELETE", path, options),
};

export async function login(username, password) {
  const form = new URLSearchParams();
  form.append("username", username);
  form.append("password", password);
  const res = await rawRequest("POST", "/auth/login", { auth: false, form });
  if (!res.ok) throw await parseError(res);
  const data = await res.json();
  accessToken = data.access_token;
  return data;
}

export async function logout() {
  const csrf = readCookie(CSRF_COOKIE_NAME);
  try {
    await rawRequest("POST", "/auth/logout", {
      auth: false,
      headers: csrf ? { [CSRF_HEADER]: csrf } : {},
    });
  } catch {
    /* best-effort */
  } finally {
    accessToken = null;
  }
}

// Download an authenticated binary file (CSV) safely via fetch + blob.
export async function downloadFile(path, filename, options = {}) {
  const res = await rawRequest("GET", path, options);
  if (!res.ok) throw await parseError(res);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
