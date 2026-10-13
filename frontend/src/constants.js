// Centralised enums/labels so terminology is defined once (i18n-ready).

export const ROLES = {
  agent: "Petugas",
  supervisor: "Supervisor",
  admin: "Administrator",
};

export const PASSENGER_STATUS = {
  pending: { label: "Menunggu", tone: "pending" },
  approved: { label: "Diizinkan", tone: "approved" },
  hold: { label: "Ditahan", tone: "hold" },
  deported: { label: "Deportasi", tone: "deported" },
  rejected: { label: "Ditolak", tone: "rejected" },
};

export const DIRECTIONS = {
  arrival: "Kedatangan",
  departure: "Keberangkatan",
};

export const COUNTER_STATUS = {
  active: { label: "Aktif", tone: "approved" },
  break: { label: "Istirahat", tone: "pending" },
  inactive: { label: "Nonaktif", tone: "neutral" },
};

export const ESCALATION_DECISIONS = {
  pending: { label: "Menunggu", tone: "pending" },
  approved: { label: "Diloloskan", tone: "approved" },
  deported: { label: "Deportasi", tone: "deported" },
  rejected: { label: "Ditolak", tone: "rejected" },
};

export const VOA_STATUS = {
  pending: { label: "Menunggu", tone: "pending" },
  approved: { label: "Disetujui", tone: "approved" },
  rejected: { label: "Ditolak", tone: "rejected" },
};

export const BLACKLIST_TYPES = {
  passport: "Paspor",
  name: "Nama",
  both: "Keduanya",
};

export function statusMeta(map, value) {
  return map[value] || { label: value || "—", tone: "neutral" };
}
