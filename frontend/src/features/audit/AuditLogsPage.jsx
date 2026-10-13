import { useMemo, useState } from "react";

import { reportApi } from "../../api/endpoints";
import { Card, DataTable, Input, PageHeader, Pagination } from "../../components/ui";
import { useApiQuery, useDebouncedValue } from "../../hooks/useApiQuery";
import { formatDateTime } from "../../utils/format";

const PAGE_SIZE = 50;

export default function AuditLogsPage() {
  const [action, setAction] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const debouncedAction = useDebouncedValue(action, 350);
  const params = useMemo(
    () => ({
      action: debouncedAction || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      page,
      page_size: PAGE_SIZE,
    }),
    [debouncedAction, dateFrom, dateTo, page],
  );
  const cacheKey = `audit:list:${JSON.stringify(params)}`;
  const { data, loading, error, refetch } = useApiQuery(
    cacheKey,
    (signal) => reportApi.auditLogs(params, { signal }),
    { staleTime: 8000, deps: [cacheKey] },
  );

  const columns = [
    { key: "id", header: "ID", render: (r) => <span className="mono">#{r.id}</span> },
    { key: "user_name", header: "Pengguna", render: (r) => r.user_name || (r.user_id ? `#${r.user_id}` : "Sistem") },
    { key: "action", header: "Aksi", render: (r) => <span className="mono" style={{ fontSize: 12 }}>{r.action}</span> },
    {
      key: "target",
      header: "Target",
      render: (r) => (r.target_type ? `${r.target_type}${r.target_id ? ` #${r.target_id}` : ""}` : "—"),
    },
    { key: "detail", header: "Detail", render: (r) => <span className="muted">{r.detail || "—"}</span> },
    { key: "ip_address", header: "IP", render: (r) => <span className="mono" style={{ fontSize: 12 }}>{r.ip_address || "—"}</span> },
    { key: "created_at", header: "Waktu", render: (r) => formatDateTime(r.created_at) },
  ];

  return (
    <div>
      <PageHeader title="Audit Log" subtitle="Jejak aktivitas seluruh pengguna sistem" />

      <div className="toolbar">
        <Input
          placeholder="Filter aksi (mis. LOGIN, APPROVE_PASSENGER)…"
          value={action}
          onChange={(e) => { setPage(1); setAction(e.target.value.toUpperCase()); }}
          aria-label="Filter aksi"
          style={{ minWidth: 260 }}
        />
        <Input type="date" value={dateFrom} onChange={(e) => { setPage(1); setDateFrom(e.target.value); }} aria-label="Dari tanggal" />
        <Input type="date" value={dateTo} onChange={(e) => { setPage(1); setDateTo(e.target.value); }} aria-label="Sampai tanggal" />
      </div>

      <Card>
        <DataTable columns={columns} rows={data?.items || []} loading={loading} error={error} onRetry={refetch} emptyTitle="Tidak ada aktivitas" />
        {data && (
          <Pagination page={data.page} pages={data.pages} total={data.total} pageSize={data.page_size} onPageChange={setPage} />
        )}
      </Card>
    </div>
  );
}
