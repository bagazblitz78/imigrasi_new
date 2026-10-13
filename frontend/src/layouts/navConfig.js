// Navigation is defined once and filtered by role, so lower-privilege users
// never see (and cannot navigate to) higher-privilege pages.
export const NAV_ITEMS = [
  { section: "Utama", to: "/", label: "Dashboard", icon: "▣", end: true, roles: ["agent", "supervisor", "admin"] },
  { section: "Operasional", to: "/scan", label: "Verifikasi Paspor", icon: "🛂", roles: ["agent"] },
  { section: "Operasional", to: "/passengers", label: "Data Penumpang", icon: "☰", roles: ["agent", "supervisor", "admin"] },
  { section: "Operasional", to: "/escalations", label: "Hold Desk", icon: "⚠", roles: ["supervisor"], badgeKey: "escalations" },
  { section: "Operasional", to: "/voa", label: "Visa On Arrival", icon: "🪪", roles: ["supervisor"], badgeKey: "voa" },
  { section: "Operasional", to: "/counters", label: "Konter", icon: "◉", roles: ["agent", "supervisor", "admin"] },
  { section: "Analitik", to: "/stats", label: "Statistik", icon: "📈", roles: ["supervisor"] },
  { section: "Manajemen", to: "/blacklist", label: "Daftar Cekal", icon: "⛔", roles: ["admin"] },
  { section: "Manajemen", to: "/users", label: "Manajemen User", icon: "👥", roles: ["admin"] },
  { section: "Manajemen", to: "/reports", label: "Laporan", icon: "📊", roles: ["admin"] },
  { section: "Sistem", to: "/audit", label: "Audit Log", icon: "📋", roles: ["admin"] },
];

export function navItemsForRole(role) {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}
