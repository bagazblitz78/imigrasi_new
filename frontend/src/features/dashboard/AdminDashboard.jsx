import { useNavigate } from "react-router-dom";

import { reportApi } from "../../api/endpoints";
import { Card, CardSkeleton, PageHeader, StatCard } from "../../components/ui";
import { useApiQuery } from "../../hooks/useApiQuery";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useApiQuery(
    "reports:admin-dashboard",
    () => reportApi.adminDashboard(),
    { staleTime: 20000 },
  );

  const cards = [
    { id: "users", icon: "👥", title: "Manajemen User", desc: "Kelola akun staf dan hak akses" },
    { id: "blacklist", icon: "⛔", title: "Daftar Cekal", desc: "Kelola blacklist paspor & nama" },
    { id: "audit", icon: "📋", title: "Audit Log", desc: "Jejak aktivitas seluruh pengguna" },
    { id: "reports", icon: "📊", title: "Laporan & Ekspor", desc: "Rekapitulasi pelintas batas" },
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard Administrator"
        subtitle="Ringkasan kondisi sistem dan operasional"
        actions={<button className="btn btn--ghost" onClick={() => refetch()}>Muat ulang</button>}
      />

      {loading ? (
        <CardSkeleton count={4} />
      ) : error ? (
        <Card pad>
          <p className="text-danger">{error.message}</p>
        </Card>
      ) : (
        <div className="grid grid--stats" style={{ marginBottom: 24 }}>
          <StatCard label="Total Staf" value={data?.total_users ?? 0} icon="👥" />
          <StatCard label="Staf Aktif" value={data?.active_users ?? 0} icon="✓" accent="var(--success)" />
          <StatCard label="Cekal Aktif" value={data?.active_blacklist ?? 0} icon="⛔" accent="var(--danger)" />
          <StatCard label="Total Cekal" value={data?.total_blacklist ?? 0} icon="🚫" accent="var(--deported)" />
          <StatCard label="Aktivitas Audit Hari Ini" value={data?.audit_events_today ?? 0} icon="📋" accent="var(--info)" />
          <StatCard label="Penumpang Hari Ini" value={data?.total_passengers_today ?? 0} icon="✈" accent="var(--warning)" />
        </div>
      )}

      <div className="grid grid--2">
        {cards.map((item) => (
          <button key={item.id} className="card card--pad" style={{ textAlign: "left", cursor: "pointer", display: "flex", gap: 16, alignItems: "center" }} onClick={() => navigate(`/${item.id === "audit" ? "audit" : item.id}`)}>
            <span style={{ fontSize: 26 }} aria-hidden="true">{item.icon}</span>
            <span>
              <span style={{ display: "block", fontWeight: 600 }}>{item.title}</span>
              <span className="muted" style={{ fontSize: 13 }}>{item.desc}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
