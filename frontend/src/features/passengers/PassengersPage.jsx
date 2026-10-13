import { useMemo, useState } from "react";

import { passengerApi } from "../../api/endpoints";
import {
  Card,
  DataTable,
  Input,
  Modal,
  PageHeader,
  Pagination,
  Select,
  StatusBadge,
} from "../../components/ui";
import { PASSENGER_STATUS, DIRECTIONS } from "../../constants";
import { useApiQuery, useDebouncedValue } from "../../hooks/useApiQuery";
import { formatDateTime } from "../../utils/format";

const PAGE_SIZE = 25;

export default function PassengersPage() {
  const [status, setStatus] = useState("");
  const [direction, setDirection] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("created_at");
  const [order, setOrder] = useState("desc");
  const [selectedId, setSelectedId] = useState(null);

  const debouncedSearch = useDebouncedValue(search, 350);

  const params = useMemo(
    () => ({
      status: status || undefined,
      direction: direction || undefined,
      search: debouncedSearch || undefined,
      page,
      page_size: PAGE_SIZE,
      sort,
      order,
    }),
    [status, direction, debouncedSearch, page, sort, order],
  );

  const cacheKey = `passengers:list:${JSON.stringify(params)}`;
  const { data, loading, error, refetch } = useApiQuery(
    cacheKey,
    (signal) => passengerApi.list(params, { signal }),
    { staleTime: 10000, deps: [cacheKey] },
  );

  const resetPage = (fn) => (value) => {
    setPage(1);
    fn(value);
  };

  const columns = [
    { key: "full_name", header: "Nama", sortable: true },
    {
      key: "passport_number",
      header: "No. Paspor",
      sortable: true,
      render: (r) => <span className="mono">{r.passport_number}</span>,
    },
    { key: "nationality", header: "Kewarganegaraan", sortable: true },
    {
      key: "direction",
      header: "Arah",
      render: (r) => DIRECTIONS[r.direction] || r.direction,
    },
    { key: "status", header: "Status", sortable: true, render: (r) => <StatusBadge status={r.status} /> },
    {
      key: "blacklist_hit",
      header: "Cekal",
      render: (r) =>
        r.blacklist_hit ? (
          <span className="text-danger" title={r.blacklist_hit}>
            ⚠ Ya
          </span>
        ) : (
          <span className="subtle">—</span>
        ),
    },
    { key: "agent_name", header: "Petugas", render: (r) => r.agent_name || "—" },
    { key: "created_at", header: "Waktu", sortable: true, render: (r) => formatDateTime(r.created_at) },
  ];

  return (
    <div>
      <PageHeader title="Data Penumpang" subtitle="Daftar penumpang yang telah diperiksa" />

      <div className="toolbar">
        <Input
          placeholder="Cari nama / paspor / penerbangan…"
          value={search}
          onChange={(e) => resetPage(setSearch)(e.target.value)}
          aria-label="Cari penumpang"
          style={{ minWidth: 260 }}
        />
        <Select
          value={direction}
          onChange={(e) => resetPage(setDirection)(e.target.value)}
          aria-label="Filter arah"
        >
          <option value="">Semua arah</option>
          <option value="arrival">Kedatangan</option>
          <option value="departure">Keberangkatan</option>
        </Select>
      </div>

      <div className="segmented" style={{ marginBottom: 16 }}>
        {["", ...Object.keys(PASSENGER_STATUS)].map((key) => (
          <button
            key={key || "all"}
            className={status === key ? "is-active" : ""}
            onClick={() => resetPage(setStatus)(key)}
          >
            {key ? PASSENGER_STATUS[key].label : "Semua"}
          </button>
        ))}
      </div>

      <Card>
        <DataTable
          columns={columns}
          rows={data?.items || []}
          loading={loading}
          error={error}
          onRetry={refetch}
          sort={sort}
          order={order}
          onSortChange={(key, nextOrder) => {
            setSort(key);
            setOrder(nextOrder);
          }}
          onRowClick={(row) => setSelectedId(row.id)}
          emptyTitle="Tidak ada data penumpang"
          emptyText="Ubah filter pencarian atau lakukan pemrosesan baru."
        />
        {data && (
          <Pagination
            page={data.page}
            pages={data.pages}
            total={data.total}
            pageSize={data.page_size}
            onPageChange={setPage}
          />
        )}
      </Card>

      <PassengerDetailModal passengerId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}

function PassengerDetailModal({ passengerId, onClose }) {
  const { data, loading, error } = useApiQuery(
    passengerId ? `passengers:detail:${passengerId}` : "passengers:detail:null",
    (signal) => passengerApi.get(passengerId, { signal }),
    { enabled: Boolean(passengerId), staleTime: 5000, deps: [passengerId] },
  );
  const { data: history } = useApiQuery(
    passengerId ? `passengers:history:${passengerId}` : "passengers:history:null",
    (signal) => passengerApi.history(passengerId, { signal }),
    { enabled: Boolean(passengerId), staleTime: 5000, deps: [passengerId] },
  );

  return (
    <Modal
      open={Boolean(passengerId)}
      onClose={onClose}
      title="Detail Penumpang"
      size="lg"
    >
      {loading ? (
        <p className="muted">Memuat…</p>
      ) : error ? (
        <p className="text-danger">{error.message}</p>
      ) : data ? (
        <>
          {data.blacklist_hit && (
            <div className="callout callout--danger" style={{ marginBottom: 16 }}>
              ⛔ Kena daftar cekal: {data.blacklist_hit}
            </div>
          )}
          <dl className="detail-list" style={{ marginBottom: 20 }}>
            <div className="detail-row"><dt>Nama</dt><dd>{data.full_name}</dd></div>
            <div className="detail-row"><dt>No. Paspor</dt><dd className="mono">{data.passport_number}</dd></div>
            <div className="detail-row"><dt>Kewarganegaraan</dt><dd>{data.nationality}</dd></div>
            <div className="detail-row"><dt>Jenis Visa</dt><dd>{data.visa_type || "—"}</dd></div>
            <div className="detail-row"><dt>Penerbangan</dt><dd>{data.flight_number || "—"}</dd></div>
            <div className="detail-row"><dt>Arah</dt><dd>{DIRECTIONS[data.direction]}</dd></div>
            <div className="detail-row"><dt>Status</dt><dd><StatusBadge status={data.status} /></dd></div>
            <div className="detail-row"><dt>Petugas</dt><dd>{data.agent_name || "—"}</dd></div>
            <div className="detail-row"><dt>Konter</dt><dd>{data.counter_name || "—"}</dd></div>
            <div className="detail-row"><dt>Waktu Proses</dt><dd>{formatDateTime(data.processed_at)}</dd></div>
            <div className="detail-row"><dt>Dibuat</dt><dd>{formatDateTime(data.created_at)}</dd></div>
            {data.notes && <div className="detail-row"><dt>Catatan</dt><dd>{data.notes}</dd></div>}
          </dl>

          <div className="card__title" style={{ marginBottom: 10 }}>
            Riwayat Aktivitas
          </div>
          {!history?.length ? (
            <p className="muted">Belum ada aktivitas tercatat.</p>
          ) : (
            <div className="stack" style={{ gap: 0 }}>
              {history.map((item) => (
                <div className="activity-item" key={item.id}>
                  <div className="activity-item__icon" aria-hidden="true">•</div>
                  <div>
                    <div className="activity-item__title">{item.action}</div>
                    <div className="activity-item__meta">
                      {item.detail || "—"} · {formatDateTime(item.created_at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : null}
    </Modal>
  );
}
