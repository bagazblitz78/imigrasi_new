import { api, downloadFile } from "./client";

const qs = (params = {}) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") search.append(key, value);
  });
  const str = search.toString();
  return str ? `?${str}` : "";
};

export const authApi = {
  me: (options) => api.get("/auth/me", options),
  changePassword: (payload) => api.post("/auth/change-password", payload),
  refreshStreamTicket: () => api.post("/notifications/stream-ticket"),
};

export const passengerApi = {
  dashboard: () => api.get("/passengers/dashboard/agent"),
  list: (params, options) => api.get(`/passengers/${qs(params)}`, options),
  get: (id, options) => api.get(`/passengers/${id}`, options),
  history: (id, options) => api.get(`/passengers/${id}/history`, options),
  create: (payload) => api.post("/passengers/", payload),
  updateStatus: (id, payload) => api.patch(`/passengers/${id}/status`, payload),
  approve: (id) => api.post(`/passengers/${id}/approve`),
  scanMrz: (file) => {
    const form = new FormData();
    form.append("file", file, file.name || "scan.jpg");
    return api.post("/passengers/scan-mrz", undefined, { form });
  },
};

export const escalationApi = {
  dashboard: () => api.get("/escalations/dashboard/supervisor"),
  list: (params, options) => api.get(`/escalations/${qs(params)}`, options),
  create: (payload) => api.post("/escalations/", payload),
  decide: (id, payload) => api.patch(`/escalations/${id}/decide`, payload),
};

export const voaApi = {
  list: (params, options) => api.get(`/voa/${qs(params)}`, options),
  create: (payload) => api.post("/voa/", payload),
  decide: (id, payload) => api.patch(`/voa/${id}/decide`, payload),
};

export const counterApi = {
  list: (options) => api.get("/counters/", options),
  create: (payload) => api.post("/counters/", payload),
  update: (id, payload) => api.patch(`/counters/${id}`, payload),
};

export const blacklistApi = {
  list: (params, options) => api.get(`/blacklist/${qs(params)}`, options),
  create: (payload) => api.post("/blacklist/", payload),
  update: (id, payload) => api.patch(`/blacklist/${id}`, payload),
  remove: (id) => api.del(`/blacklist/${id}`),
};

export const userApi = {
  list: (params, options) => api.get(`/users/${qs(params)}`, options),
  create: (payload) => api.post("/users/", payload),
  update: (id, payload) => api.patch(`/users/${id}`, payload),
  deactivate: (id) => api.del(`/users/${id}`),
  resetPassword: (id, newPassword) =>
    api.post(`/users/${id}/reset-password`, { new_password: newPassword }),
};

export const reportApi = {
  auditLogs: (params, options) => api.get(`/reports/audit-logs${qs(params)}`, options),
  stats: (params, options) => api.get(`/reports/passengers/stats${qs(params)}`, options),
  adminDashboard: (options) => api.get("/reports/dashboard/admin", options),
  exportCsv: (params = {}) =>
    downloadFile(
      `/reports/passengers/export-csv${qs(params)}`,
      `imigrasi_laporan_${new Date().toISOString().slice(0, 10)}.csv`,
    ),
};

export const notificationApi = {
  list: (options) => api.get("/notifications/", options),
  unreadCount: (options) => api.get("/notifications/unread-count", options),
  markRead: (id) => api.post(`/notifications/${id}/read`),
  markAllRead: () => api.post("/notifications/read-all"),
};
