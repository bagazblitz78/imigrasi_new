import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { passengerApi } from "../../api/endpoints";
import {
  Button,
  Card,
  CardHeader,
  CounterBadge,
  DataTable,
  EmptyState,
  PageHeader,
  StatCard,
  StatusBadge,
} from "../../components/ui";
import { useApiQuery } from "../../hooks/useApiQuery";
import { DIRECTIONS } from "../../constants";
import { formatTime } from "../../utils/format";

function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div style={{ textAlign: "right" }}>
      <div className="mono" style={{ fontSize: 20, fontWeight: 700 }}>
        {now.toLocaleTimeString("id-ID", { hour12: false })}
      </div>
      <div className="subtle" style={{ fontSize: 11 }}>
        Waktu setempat
      </div>
    </div>
  );
}

export default function AgentDashboard() {
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useApiQuery(
    "passengers:agent-dashboard",
    () => passengerApi.dashboard(),
    { staleTime: 10000 },
  );

  const columns = [
    { key: "full_name", header: "Nama" },
    { key: "passport_number", header: "No. Paspor", render: (r) => <span className="mono">{r.passport_number}</span> },
    { key: "nationality", header: "Kewarganegaraan" },
    { key: "direction", header: "Arah", render: (r) => DIRECTIONS[r.direction] || r.direction },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "created_at", header: "Waktu", render: (r) => formatTime(r.created_at) },
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard Petugas"
        subtitle="Ringkasan aktivitas konter Anda hari ini"
        actions={
          <>
            <LiveClock />
            <Button onClick={() => navigate("/scan")}>+ Verifikasi Paspor</Button>
          </>
        }
      />

      <div className="grid grid--stats" style={{ marginBottom: 22 }}>
        <StatCard
          label="Diperiksa Hari Ini"
          value={loading ? "…" : data?.checked_today ?? 0}
          icon="👤"
        />
        <StatCard
          label="Status Konter"
          value={<CounterBadge status={data?.counter_status} />}
          sub={data?.counter_name || "Belum ditugaskan"}
          accent="var(--success)"
          icon="◉"
        />
        <StatCard
          label="Pemindaian Terakhir"
          value={
            <span className="mono" style={{ fontSize: 18 }}>
              {data?.last_10_passengers?.[0]?.passport_number || "—"}
            </span>
          }
          icon="🛂"
          accent="var(--warning)"
        />
      </div>

      <div className="grid grid--2">
        <Card>
          <CardHeader
            title="Aktivitas Pemrosesan Terbaru"
            actions={
              <Button variant="ghost" size="sm" onClick={() => refetch()}>
                Muat ulang
              </Button>
            }
          />
          <DataTable
            columns={columns}
            rows={data?.last_10_passengers || []}
            loading={loading}
            error={error}
            onRetry={refetch}
            emptyTitle="Belum ada pemrosesan"
            emptyText="Mulai dengan memverifikasi paspor penumpang."
          />
        </Card>

        <div className="stack">
          <Card pad>
            <div className="card__title" style={{ marginBottom: 12 }}>
              Aksi Cepat
            </div>
            <div className="stack" style={{ gap: 10 }}>
              <Button block onClick={() => navigate("/scan")}>
                🛂 Verifikasi Paspor Baru
              </Button>
              <Button variant="secondary" block onClick={() => navigate("/passengers")}>
                ☰ Lihat Riwayat Penumpang
              </Button>
              <Button variant="secondary" block onClick={() => navigate("/counters")}>
                ◉ Kelola Status Konter
              </Button>
            </div>
          </Card>

          <Card pad>
            <div className="card__title" style={{ marginBottom: 12 }}>
              Panduan Cepat
            </div>
            <div className="stack" style={{ gap: 12 }}>
              <GuideItem title="Data aman" text="Tombol setujui muncul untuk penumpang tanpa catatan cekal." />
              <GuideItem title="Kena cekal" text="Sistem otomatis menahan penumpang dan meneruskan ke Supervisor." />
              <GuideItem title="MRZ" text="Pindai 2 baris MRZ di bawah paspor, lalu periksa hasilnya sebelum simpan." />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function GuideItem({ title, text }) {
  return (
    <div>
      <div style={{ fontWeight: 600, fontSize: 13 }}>{title}</div>
      <div className="muted" style={{ fontSize: 12.5 }}>{text}</div>
    </div>
  );
}
