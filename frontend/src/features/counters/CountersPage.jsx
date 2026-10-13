import { useState } from "react";

import { counterApi } from "../../api/endpoints";
import {
  Button,
  Card,
  CardSkeleton,
  CounterBadge,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  useToast,
} from "../../components/ui";
import { useAuth } from "../../contexts/AuthContext";
import { invalidateQueries, useApiQuery } from "../../hooks/useApiQuery";

const STATUSES = [
  { key: "active", label: "Aktif" },
  { key: "break", label: "Istirahat" },
  { key: "inactive", label: "Nonaktif" },
];

export default function CountersPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [updating, setUpdating] = useState(null);

  const { data, loading, error, refetch } = useApiQuery(
    "counters:list",
    () => counterApi.list(),
    { staleTime: 15000 },
  );

  const updateStatus = async (counter, status) => {
    setUpdating(counter.id);
    try {
      await counterApi.update(counter.id, { status });
      invalidateQueries("counters:");
      refetch();
      toast.push(`Status ${counter.name} diperbarui.`, { type: "success" });
    } catch (err) {
      toast.push(err.message, { type: "danger" });
    } finally {
      setUpdating(null);
    }
  };

  const canManageStatus = (counter) =>
    user.role !== "agent" || user.counter_id === counter.id;

  return (
    <div>
      <PageHeader
        title="Konter Pemeriksaan"
        subtitle="Status dan petugas setiap konter"
        actions={
          user.role === "admin" ? (
            <Button onClick={() => setShowCreate(true)}>+ Tambah Konter</Button>
          ) : null
        }
      />

      {loading ? (
        <CardSkeleton count={3} />
      ) : error ? (
        <Card pad><p className="text-danger">{error.message}</p></Card>
      ) : !data?.length ? (
        <Card><EmptyState icon="◉" title="Belum ada konter" /></Card>
      ) : (
        <div className="grid grid--3">
          {data.map((counter) => {
            const isMine = counter.id === user.counter_id;
            return (
              <Card key={counter.id} pad>
                <div className="row row--between" style={{ marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>
                      {counter.name} {isMine && <span className="subtle" style={{ fontSize: 11 }}>(konter Anda)</span>}
                    </div>
                    <div className="muted" style={{ fontSize: 12 }}>{counter.location || "—"}</div>
                  </div>
                  <CounterBadge status={counter.status} />
                </div>
                <div className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>
                  Petugas aktif: {counter.active_agent_name || "—"}
                </div>
                {canManageStatus(counter) && (
                  <div className="row">
                    {STATUSES.map((s) => (
                      <button
                        key={s.key}
                        className="btn btn--ghost btn--sm"
                        style={{
                          flex: 1,
                          borderColor: counter.status === s.key ? "var(--color-primary)" : undefined,
                          color: counter.status === s.key ? "var(--color-primary)" : undefined,
                        }}
                        disabled={counter.status === s.key || updating === counter.id}
                        onClick={() => updateStatus(counter, s.key)}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <CreateCounterModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onDone={() => {
          setShowCreate(false);
          invalidateQueries("counters:");
          refetch();
          toast.push("Konter berhasil ditambahkan.", { type: "success" });
        }}
      />
    </div>
  );
}

function CreateCounterModal({ open, onClose, onDone }) {
  const [form, setForm] = useState({ name: "", location: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!form.name.trim()) {
      setError("Nama konter wajib diisi");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await counterApi.create(form);
      setForm({ name: "", location: "" });
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Tambah Konter"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>Batal</Button>
          <Button onClick={submit} loading={submitting}>Simpan</Button>
        </>
      }
    >
      {error && <div className="alert alert--error">{error}</div>}
      <Input label="Nama Konter" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Konter A-3" />
      <Input label="Lokasi" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder="Terminal 2 Internasional" />
    </Modal>
  );
}
