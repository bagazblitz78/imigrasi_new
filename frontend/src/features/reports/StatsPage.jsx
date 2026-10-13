import { Card, CardHeader, PageHeader, StatCard } from "../../components/ui";
import { reportApi } from "../../api/endpoints";
import { useApiQuery } from "../../hooks/useApiQuery";

export default function StatsPage() {
  const { data, loading } = useApiQuery("reports:stats", () => reportApi.stats(), {
    staleTime: 20000,
  });

  const byNationality = Object.entries(data?.by_nationality || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);
  const max = byNationality[0]?.[1] || 1;

  return (
    <div>
      <PageHeader title="Statistik Lapangan" subtitle="Ringkasan data penumpang hari ini" />

      <div className="grid grid--stats" style={{ marginBottom: 22 }}>
        <StatCard label="Total Hari Ini" value={loading ? "…" : data?.total_today ?? 0} icon="👥" />
        <StatCard label="Kedatangan" value={data?.arrivals_today ?? 0} icon="✈" accent="var(--success)" />
        <StatCard label="Keberangkatan" value={data?.departures_today ?? 0} icon="✈" accent="var(--info)" />
        <StatCard label="Ditahan" value={data?.hold_today ?? 0} icon="⛔" accent="var(--danger)" />
      </div>

      <Card>
        <CardHeader title="Penumpang per Negara Asal" />
        <div className="card__body">
          {byNationality.length === 0 ? (
            <p className="muted">Belum ada data.</p>
          ) : (
            <div className="stack" style={{ gap: 12 }}>
              {byNationality.map(([country, count]) => (
                <div key={country}>
                  <div className="row row--between" style={{ fontSize: 13 }}>
                    <span>{country}</span>
                    <span className="mono">{count}</span>
                  </div>
                  <div style={{ height: 8, background: "var(--surface-sunken)", borderRadius: 4, marginTop: 4 }}>
                    <div
                      style={{
                        width: `${(count / max) * 100}%`,
                        height: "100%",
                        borderRadius: 4,
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
    </div>
  );
}
