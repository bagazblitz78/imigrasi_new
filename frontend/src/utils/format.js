export function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

export function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("id-ID", { dateStyle: "medium" });
}

export function formatTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

export function relativeTime(value) {
  if (!value) return "—";
  const d = new Date(value).getTime();
  if (Number.isNaN(d)) return "—";
  const diff = Date.now() - d;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "baru saja";
  if (mins < 60) return `${mins} menit lalu`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.round(hours / 24);
  return `${days} hari lalu`;
}

// Mask passport numbers for users without explicit permission.
export function maskPassport(value) {
  if (!value) return "—";
  if (value.length <= 5) return value[0] + "*".repeat(value.length - 1);
  return `${value.slice(0, 4)}${"*".repeat(value.length - 6)}${value.slice(-2)}`;
}

export function maskName(value) {
  if (!value) return "—";
  const parts = value.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0] + "*".repeat(Math.max(parts[0].length - 1, 0));
  return `${parts[0]} ${parts.slice(1).map((p) => `${p[0]}.`).join(" ")}`;
}

export function initials(name) {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function toTitleCase(value) {
  if (!value) return "";
  return value
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
