import { useMemo, useState } from "react";

import { escalationApi } from "../../api/endpoints";
import {
  Button,
  Card,
  DataTable,
  EscalationBadge,
  Modal,
  PageHeader,
  Pagination,
  Select,
  Textarea,
  useToast,
} from "../../components/ui";
import { ESCALATION_DECISIONS } from "../../constants";
import { invalidateQueries, useApiQuery } from "../../hooks/useApiQuery";
import { formatDateTime, relativeTime } from "../../utils/format";

export default function EscalationsPage() {
  const toast = useToast();
  const [decision, setDecision] = useState("pending");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);

  const params = { decision: decision || undefined, page, page_size: 25 };
  const cacheKey = `escalations:list:${JSON.stringify(params)}`;
  const { data, loading, error, refetch } = useApiQuery(
    cacheKey,
    (signal) => escalationApi.list(params, { signal }),
    { staleTime: 10000, deps: [cacheKey] },
  );

  const columns = [
    { key: "id", header: "ID", render: (r) => <span className="mono">#{r.id}</span> },
    { key: "passenger_name", header: "Penumpang" },
    { key: "passenger_passport", header: "No. Paspor", render: (r) => <span className="mono">{r.passenger_passport || "—"}</span> },
    { key: "reason", header: "Alasan", render: (r) => <span className="muted">{r.reason || "—"}</span> },
    { key: "decision", header: "Keputusan", render: (r) => <EscalationBadge decision={r.decision} /> },
    { key: "created_at", header: "Waktu", render: (r) => formatDateTime(r.created_at) },
    {
      key: "age",
      header: "Umur",
      render: (r) => <span className="muted">{relativeTime(r.created_at)}</span>,
    },
    {
      key: "_action",
      header: "Aksi",
      render: (r) =>
        r.decision === "pending" ? (
          <Button size="sm" onClick={() => setSelected(r)}>
            Putuskan
          </Button>
        ) : (
          <span className="subtle">Selesai</span>
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Hold Desk"
        subtitle="Penumpang yang ditahan dan memerlukan keputusan"
        actions={
          <Button variant="ghost" onClick={() => refetch()}>
            Muat ulang
          </Button>
        }
      />

      <div className="segmented" style={{ marginBottom: 16 }}>
        {[["pending", "Menunggu"], ...Object.entries(ESCALATION_DECISIONS).filter(([k]) => k !== "pending"), ["", "Semua"]].map(
          ([key, meta]) => (
            <button
              key={key || "all"}
              className={decision === key ? "is-active" : ""}
              onClick={() => {
                setPage(1);
                setDecision(key);
              }}
            >
              {typeof meta === "string" ? meta : meta.label}
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
          emptyTitle="Tidak ada eskalasi"
          emptyText="Semua penumpang yang ditahan akan muncul di sini."
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

      <DecideModal
        escalation={selected}
        onClose={() => setSelected(null)}
        onDone={(msg) => {
          setSelected(null);
          invalidateQueries("escalations:");
          refetch();
          toast.push(msg, { type: "success" });
        }}
      />
    </div>
  );
}

function DecideModal({ escalation, onClose, onDone }) {
  const [form, setForm] = useState({ decision: "approved", decision_notes: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const requiresReason = form.decision === "rejected" || form.decision === "deported";

  const submit = async () => {
    if (requiresReason && !form.decision_notes.trim()) {
      setError("Catatan/alasan wajib diisi untuk keputusan ini");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await escalationApi.decide(escalation.id, {
        decision: form.decision,
        decision_notes: form.decision_notes || null,
      });
      onDone(`Keputusan "${form.decision}" tersimpan.`);
      setForm({ decision: "approved", decision_notes: "" });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={Boolean(escalation)}
      onClose={onClose}
      title={`Keputusan Eskalasi #${escalation?.id ?? ""}`}
      description="Tinjau penumpang lalu tentukan keputusan final."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Batal
          </Button>
          <Button
            variant={form.decision === "approved" ? "success" : "danger"}
            onClick={submit}
            loading={submitting}
          >
            Konfirmasi Keputusan
          </Button>
        </>
      }
    >
      {error && <div className="alert alert--error">{error}</div>}
      {escalation && (
        <>
          <div className="callout callout--warning" style={{ marginBottom: 16 }}>
            {escalation.passenger_name} — <span className="mono">{escalation.passenger_passport}</span>
          </div>
          <dl className="detail-list" style={{ marginBottom: 16 }}>
            <div className="detail-row"><dt>Alasan Hold</dt><dd>{escalation.reason || "—"}</dd></div>
            <div className="detail-row"><dt>Petugas</dt><dd>{escalation.agent_name || "—"}</dd></div>
            <div className="detail-row"><dt>Diajukan</dt><dd>{formatDateTime(escalation.created_at)}</dd></div>
          </dl>
          <Select
            label="Keputusan"
            value={form.decision}
            onChange={(e) => setForm((f) => ({ ...f, decision: e.target.value }))}
          >
            <option value="approved">Loloskan — Izin Masuk</option>
            <option value="deported">Deportasi</option>
            <option value="rejected">Tolak Masuk</option>
          </Select>
          <Textarea
            label={requiresReason ? "Alasan Keputusan (wajib)" : "Catatan Keputusan"}
            value={form.decision_notes}
            onChange={(e) => setForm((f) => ({ ...f, decision_notes: e.target.value }))}
            placeholder="Tuliskan pertimbangan keputusan…"
            required={requiresReason}
          />
        </>
      )}
    </Modal>
  );
}
