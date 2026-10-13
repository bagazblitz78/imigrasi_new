import { useState } from "react";

import { reportApi } from "../../api/endpoints";
import {
  Button,
  Card,
  CardHeader,
  Input,
  PageHeader,
  StatCard,
  useToast,
} from "../../components/ui";
import { useApiQuery } from "../../hooks/useApiQuery";

export default function ReportsPage() {
  const toast = useToast();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [exporting, setExporting] = useState(false);

  const params = { start_date: dateFrom || undefined, end_date: dateTo || undefined };
  const cacheKey = `reports:stats:${JSON.stringify(params)}`;
  const { data, loading } = useApiQuery(
    cacheKey,
    (signal) => reportApi.stats(params, { signal }),
    { staleTime: 20000, deps: [cacheKey] },
  );

  const exportCsv = async (direction) => {
    setExporting(true);
    try {
      await reportApi.exportCsv({ ...params, direction });
      toast.push("Berkas CSV berhasil diunduh.", { type: "success" });
    } catch (err) {
      toast.push(err.message, { type: "danger" });
    } finally {
      setExporting(false);
    }
  };

  const statusRows = [
    ["Menunggu", data?.pending_today, "var(--pending)"],
    ["Disetujui", data?.approved_today, "var(--success)"],
    ["Ditahan", data?.hold_today, "var(--hold)"],
    ["Deportasi", data?.deported_today, "var(--deported)"],
    ["Ditolak", data?.rejected_today, "var(--rejected)"],
  ];

  return (
    <div>
      <PageHeader title="Laporan & Ekspor" subtitle="Rekapitulasi pelintas batas" />

      <div className="toolbar">
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} aria-label="Dari tanggal" />
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} aria-label="Sampai tanggal" />
      </div>

      <div className="grid grid--stats" style={{ marginBottom: 22 }}>
        <StatCard label="Total" value={loading ? "…" : data?.total_today ?? 0} icon="👥" />
        <StatCard label="Kedatangan" value={data?.arrivals_today ?? 0} icon="✈" accent="var(--success)" />
        <StatCard label="Keberangkatan" value={data?.departures_today ?? 0} icon="✈" accent="var(--info)" />
        <StatCard label="Disetujui" value={data?.approved_today ?? 0} icon="✓" accent="var(--warning)" />
      </div>

      <div className="grid grid--2">
        <Card>
          <CardHeader title="Ekspor Laporan" />
          <div className="card__body stack" style={{ gap: 10 }}>
            <p className="muted" style={{ fontSize: 13 }}>
              Unduh data rekapitulasi penumpang dalam format CSV. Data sensitif dimasking sesuai kewenangan.
            </p>
            <Button variant="success" onClick={() => exportCsv()} loading={exporting}>
              ↓ Ekspor CSV (Semua)
            </Button>
            <Button variant="secondary" onClick={() => exportCsv("arrival")} disabled={exporting}>
              ↓ Ekspor CSV (Kedatangan)
            </Button>
            <Button variant="secondary" onClick={() => exportCsv("departure")} disabled={exporting}>
              ↓ Ekspor CSV (Keberangkatan)
            </Button>
          </div>
        </Card>

        <Card>
          <CardHeader title="Ringkasan per Status" />
          <div className="card__body">
            <dl className="detail-list">
              {statusRows.map(([label, value, color]) => (
                <div className="detail-row" key={label}>
                  <dt>{label}</dt>
                  <dd style={{ color }}>{value ?? 0}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Card>
      </div>
    </div>
  );
}
