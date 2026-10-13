import { useState } from "react";

import { voaApi } from "../../api/endpoints";
import {
  Button,
  Card,
  DataTable,
  Input,
  Modal,
  PageHeader,
  Pagination,
  Select,
  VoaBadge,
  useToast,
} from "../../components/ui";
import { invalidateQueries, useApiQuery } from "../../hooks/useApiQuery";
import { formatDate, formatDateTime } from "../../utils/format";

export default function VoaPage() {
  const toast = useToast();
  const [status, setStatus] = useState("pending");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);

  const params = { status: status || undefined, page, page_size: 25 };
  const cacheKey = `voa:list:${JSON.stringify(params)}`;
  const { data, loading, error, refetch } = useApiQuery(
    cacheKey,
    (signal) => voaApi.list(params, { signal }),
    { staleTime: 10000, deps: [cacheKey] },
  );

  const columns = [
    { key: "id", header: "ID", render: (r) => <span className="mono">#{r.id}</span> },
    { key: "passenger_name", header: "Penumpang" },
    { key: "passenger_passport", header: "No. Paspor", render: (r) => <span className="mono">{r.passenger_passport || "—"}</span> },
    { key: "duration_days", header: "Durasi", render: (r) => `${r.duration_days} hari` },
    {
      key: "fee_paid",
      header: "Biaya",
      render: (r) => (r.fee_paid ? <span className="text-success">Lunas</span> : <span className="text-danger">Belum</span>),
    },
    { key: "status", header: "Status", render: (r) => <VoaBadge status={r.status} /> },
    { key: "applied_at", header: "Diajukan", render: (r) => formatDate(r.applied_at) },
    {
      key: "_action",
      header: "Aksi",
      render: (r) =>
        r.status === "pending" ? (
          <Button size="sm" onClick={() => setSelected(r)}>
            Proses
          </Button>
        ) : (
          <span className="subtle">Selesai</span>
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Visa On Arrival"
        subtitle="Permohonan VOA yang memerlukan verifikasi"
        actions={
          <Button variant="ghost" onClick={() => refetch()}>
            Muat ulang
          </Button>
        }
      />

      <div className="segmented" style={{ marginBottom: 16 }}>
        {[["pending", "Menunggu"], ["approved", "Disetujui"], ["rejected", "Ditolak"], ["", "Semua"]].map(
          ([key, label]) => (
            <button
              key={key || "all"}
              className={status === key ? "is-active" : ""}
              onClick={() => {
                setPage(1);
                setStatus(key);
              }}
            >
              {label}
            </button>
          ),
        )}
      </div>

      <Card>
        <DataTable
          columns={columns}
          rows={data?.items || []}
          loading={loading}
          error={error}
          onRetry={refetch}
          emptyTitle="Tidak ada permohonan VOA"
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

      <VoaDecideModal
        voa={selected}
        onClose={() => setSelected(null)}
        onDone={(msg) => {
          setSelected(null);
          invalidateQueries("voa:");
          refetch();
          toast.push(msg, { type: "success" });
        }}
      />
    </div>
  );
}

function VoaDecideModal({ voa, onClose, onDone }) {
  const [form, setForm] = useState({ status: "approved", rejection_reason: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (form.status === "rejected" && !form.rejection_reason.trim()) {
      setError("Alasan penolakan wajib diisi");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await voaApi.decide(voa.id, {
        status: form.status,
        rejection_reason: form.status === "rejected" ? form.rejection_reason : null,
      });
      onDone(`VOA berhasil di${form.status === "approved" ? "setujui" : "tolak"}.`);
      setForm({ status: "approved", rejection_reason: "" });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={Boolean(voa)}
      onClose={onClose}
      title={`Proses VOA #${voa?.id ?? ""}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Batal
          </Button>
          <Button
            variant={form.status === "approved" ? "success" : "danger"}
            onClick={submit}
            loading={submitting}
          >
            Konfirmasi
          </Button>
        </>
      }
    >
      {error && <div className="alert alert--error">{error}</div>}
      {voa && (
        <>
          <dl className="detail-list" style={{ marginBottom: 16 }}>
            <div className="detail-row"><dt>Penumpang</dt><dd>{voa.passenger_name}</dd></div>
            <div className="detail-row"><dt>No. Paspor</dt><dd className="mono">{voa.passenger_passport}</dd></div>
            <div className="detail-row"><dt>Durasi</dt><dd>{voa.duration_days} hari</dd></div>
            <div className="detail-row"><dt>Biaya</dt><dd>{voa.fee_paid ? "Lunas" : "Belum lunas"}</dd></div>
            <div className="detail-row"><dt>Diajukan</dt><dd>{formatDateTime(voa.applied_at)}</dd></div>
          </dl>
          <Select
            label="Keputusan"
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
          >
            <option value="approved">Setujui VOA</option>
            <option value="rejected">Tolak VOA</option>
          </Select>
          {form.status === "rejected" && (
            <Input
              label="Alasan Penolakan"
              required
              value={form.rejection_reason}
              onChange={(e) => setForm((f) => ({ ...f, rejection_reason: e.target.value }))}
            />
          )}
        </>
      )}
    </Modal>
  );
}
