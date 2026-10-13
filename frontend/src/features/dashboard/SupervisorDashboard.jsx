import { useNavigate } from "react-router-dom";

import { escalationApi, reportApi } from "../../api/endpoints";
import {
  Button,
  Card,
  CardHeader,
  PageHeader,
  StatCard,
} from "../../components/ui";
import { useApiQuery } from "../../hooks/useApiQuery";

export default function SupervisorDashboard() {
  const navigate = useNavigate();
  const { data, loading, refetch } = useApiQuery(
    "escalations:supervisor-dashboard",
    () => escalationApi.dashboard(),
    { staleTime: 15000 },
  );
  const { data: stats } = useApiQuery("reports:stats", () => reportApi.stats(), {
    staleTime: 30000,
  });

  const byNationality = Object.entries(stats?.by_nationality || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const maxNat = byNationality[0]?.[1] || 1;

  return (
    <div>
      <PageHeader
        title="Dashboard Supervisor"
        subtitle="Pantauan real-time kondisi lapangan"
        actions={
          <Button variant="ghost" onClick={() => refetch()}>
            Muat ulang
          </Button>
        }
      />

      {data?.pending_escalations > 0 && (
        <div className="callout callout--danger" style={{ marginBottom: 20 }}>
          <span aria-hidden="true">⚠</span>
          <span>
            {data.pending_escalations} eskalasi menunggu keputusan
            {data.oldest_pending_escalation_minutes != null
              ? ` — terlama ${data.oldest_pending_escalation_minutes} menit`
              : ""}
            .
          </span>
          <Button variant="danger" size="sm" style={{ marginLeft: "auto" }} onClick={() => navigate("/escalations")}>
            Tangani Sekarang
          </Button>
        </div>
      )}

      <div className="grid grid--stats" style={{ marginBottom: 22 }}>
        <StatCard label="Eskalasi Pending" value={loading ? "…" : data?.pending_escalations ?? 0} icon="⚠" accent="var(--danger)" />
        <StatCard label="VOA Pending" value={data?.pending_voa ?? 0} icon="🪪" accent="var(--warning)" />
        <StatCard label="Konter Aktif" value={data?.active_counters ?? 0} icon="◉" accent="var(--success)" />
        <StatCard label="Penahanan Hari Ini" value={data?.hold_today ?? 0} icon="⛔" accent="var(--hold)" />
        <StatCard label="Kedatangan Hari Ini" value={data?.total_arrivals_today ?? 0} icon="✈" accent="var(--info)" />
        <StatCard label="Keberangkatan Hari Ini" value={data?.total_departures_today ?? 0} icon="✈" accent="var(--deported)" />
      </div>

      <div className="grid grid--2">
        <Card>
          <CardHeader title="Penumpang per Negara Asal (hari ini)" />
          <div className="card__body">
            {byNationality.length === 0 ? (
              <p className="muted">Belum ada data.</p>
            ) : (
              <div className="stack" style={{ gap: 10 }}>
                {byNationality.map(([country, count]) => (
                  <div key={country}>
                    <div className="row row--between" style={{ fontSize: 13 }}>
                      <span>{country}</span>
                      <span className="mono">{count}</span>
                    </div>
                    <div style={{ height: 6, background: "var(--surface-sunken)", borderRadius: 3, marginTop: 4 }}>
                      <div
                        style={{
                          width: `${(count / maxNat) * 100}%`,
                          height: "100%",
                          borderRadius: 3,
                          background: "var(--color-primary)",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <div className="stack">
          <Card pad>
            <div className="card__title" style={{ marginBottom: 12 }}>
              Tindakan Prioritas
            </div>
            <div className="stack" style={{ gap: 10 }}>
              <Button variant="danger" block onClick={() => navigate("/escalations")}>
                ⚠ Buka Hold Desk ({data?.pending_escalations ?? 0})
              </Button>
              <Button variant="warning" block onClick={() => navigate("/voa")}>
                🪪 Proses VOA ({data?.pending_voa ?? 0})
              </Button>
              <Button variant="secondary" block onClick={() => navigate("/counters")}>
                ◉ Monitoring Konter
              </Button>
              <Button variant="ghost" block onClick={() => navigate("/stats")}>
                📈 Statistik Lapangan
              </Button>
            </div>
          </Card>

          <Card pad>
            <div className="card__title" style={{ marginBottom: 12 }}>
              Ringkasan Status Hari Ini
            </div>
            <dl className="detail-list">
              <div className="detail-row">
                <dt>Menunggu</dt>
                <dd>{stats?.pending_today ?? 0}</dd>
              </div>
              <div className="detail-row">
                <dt>Disetujui</dt>
                <dd className="text-success">{stats?.approved_today ?? 0}</dd>
              </div>
              <div className="detail-row">
                <dt>Ditahan</dt>
                <dd className="text-danger">{stats?.hold_today ?? 0}</dd>
              </div>
              <div className="detail-row">
                <dt>Deportasi</dt>
                <dd>{stats?.deported_today ?? 0}</dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
