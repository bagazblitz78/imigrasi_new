import { useMemo, useState } from "react";

import { blacklistApi } from "../../api/endpoints";
import {
  Alert,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  Input,
  Modal,
  PageHeader,
  Pagination,
  Select,
  Textarea,
  useToast,
} from "../../components/ui";
import { BLACKLIST_TYPES } from "../../constants";
import { invalidateQueries, useApiQuery } from "../../hooks/useApiQuery";
import { formatDate } from "../../utils/format";

const PAGE_SIZE = 25;
const EMPTY = { type: "passport", passport_number: "", full_name: "", nationality: "", reason: "" };

export default function BlacklistPage() {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [toRemove, setToRemove] = useState(null);

  const params = useMemo(
    () => ({ search: search || undefined, is_active: true, page, page_size: PAGE_SIZE }),
    [search, page],
  );
  const cacheKey = `blacklist:list:${JSON.stringify(params)}`;
  const { data, loading, error, refetch } = useApiQuery(
    cacheKey,
    (signal) => blacklistApi.list(params, { signal }),
    { staleTime: 10000, deps: [cacheKey] },
  );

  const remove = async () => {
    await blacklistApi.remove(toRemove.id);
    invalidateQueries("blacklist:");
    refetch();
    toast.push("Entri cekal dinonaktifkan.", { type: "success" });
  };

  const columns = [
    { key: "passport_number", header: "No. Paspor", render: (r) => <span className="mono">{r.passport_number || "—"}</span> },
    { key: "full_name", header: "Nama", render: (r) => r.full_name || "—" },
    { key: "nationality", header: "Negara", render: (r) => r.nationality || "—" },
    { key: "type", header: "Tipe", render: (r) => BLACKLIST_TYPES[r.type] || r.type },
    { key: "reason", header: "Alasan", render: (r) => <span className="muted">{r.reason || "—"}</span> },
    { key: "created_at", header: "Ditambahkan", render: (r) => formatDate(r.created_at) },
    {
      key: "_action",
      header: "Aksi",
      render: (r) => (
        <Button variant="danger" size="sm" onClick={() => setToRemove(r)}>
          Nonaktifkan
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Daftar Cekal"
        subtitle="Manajemen blacklist paspor dan nama"
        actions={<Button onClick={() => setShowCreate(true)}>+ Tambah Cekal</Button>}
      />

      <div className="toolbar">
        <Input
          placeholder="Cari nama / paspor / negara…"
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
          aria-label="Cari daftar cekal"
          style={{ minWidth: 280 }}
        />
      </div>

      <Card>
        <DataTable
          columns={columns}
          rows={data?.items || []}
          loading={loading}
          error={error}
          onRetry={refetch}
          emptyTitle="Tidak ada data cekal"
        />
        {data && (
          <Pagination page={data.page} pages={data.pages} total={data.total} pageSize={data.page_size} onPageChange={setPage} />
        )}
      </Card>

      <CreateBlacklistModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onDone={() => {
          setShowCreate(false);
          invalidateQueries("blacklist:");
          refetch();
          toast.push("Entri cekal ditambahkan.", { type: "success" });
        }}
      />

      <ConfirmDialog
        open={Boolean(toRemove)}
        onClose={() => setToRemove(null)}
        onConfirm={remove}
        title="Nonaktifkan Entri Cekal"
        description="Entri ini tidak akan lagi memicu penahanan otomatis."
        confirmLabel="Nonaktifkan"
        variant="danger"
        details={
          toRemove && (
            <div className="callout callout--warning">
              {toRemove.full_name || "—"} — <span className="mono">{toRemove.passport_number || "—"}</span>
            </div>
          )
        }
      />
    </div>
  );
}

function CreateBlacklistModal({ open, onClose, onDone }) {
  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!form.passport_number.trim() && !form.full_name.trim()) {
      setError("Isi minimal nomor paspor atau nama lengkap");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await blacklistApi.create({
        type: form.type,
        passport_number: form.passport_number || null,
        full_name: form.full_name || null,
        nationality: form.nationality || null,
        reason: form.reason || null,
      });
      setForm(EMPTY);
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
      title="Tambah Daftar Cekal"
      description="Data ini digunakan untuk pengecekan otomatis saat pemrosesan penumpang."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>Batal</Button>
          <Button variant="danger" onClick={submit} loading={submitting}>Tambah Cekal</Button>
        </>
      }
    >
      {error && <Alert type="error" onClose={() => setError("")}>{error}</Alert>}
      <Select label="Tipe Cekal" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
        <option value="passport">Paspor</option>
        <option value="name">Nama</option>
        <option value="both">Keduanya</option>
      </Select>
      <Input label="Nomor Paspor" value={form.passport_number} onChange={(e) => setForm((f) => ({ ...f, passport_number: e.target.value }))} placeholder="Kosongkan jika berbasis nama" className="mono" />
      <Input label="Nama Lengkap" value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} />
      <Input label="Kewarganegaraan" value={form.nationality} onChange={(e) => setForm((f) => ({ ...f, nationality: e.target.value }))} />
      <Textarea label="Alasan Cekal" value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} />
    </Modal>
  );
}
