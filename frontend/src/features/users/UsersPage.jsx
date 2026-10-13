import { useMemo, useState } from "react";

import { userApi } from "../../api/endpoints";
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
  PasswordInput,
  RoleBadge,
  Select,
  useToast,
} from "../../components/ui";
import { invalidateQueries, useApiQuery } from "../../hooks/useApiQuery";
import { useDebouncedValue } from "../../hooks/useApiQuery";
import { formatDate } from "../../utils/format";

const PAGE_SIZE = 25;
const EMPTY = { username: "", email: "", full_name: "", password: "", role: "agent" };

export default function UsersPage() {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [resetUser, setResetUser] = useState(null);
  const [deactivateUser, setDeactivateUser] = useState(null);

  const debouncedSearch = useDebouncedValue(search, 350);
  const params = useMemo(
    () => ({ search: debouncedSearch || undefined, role: role || undefined, page, page_size: PAGE_SIZE }),
    [debouncedSearch, role, page],
  );
  const cacheKey = `users:list:${JSON.stringify(params)}`;
  const { data, loading, error, refetch } = useApiQuery(
    cacheKey,
    (signal) => userApi.list(params, { signal }),
    { staleTime: 10000, deps: [cacheKey] },
  );

  const toggleActive = async (user, nextActive) => {
    try {
      await userApi.update(user.id, { is_active: nextActive });
      invalidateQueries("users:");
      refetch();
      toast.push(`Akun ${user.username} ${nextActive ? "diaktifkan" : "dinonaktifkan"}.`, { type: "success" });
    } catch (err) {
      toast.push(err.message, { type: "danger" });
    }
  };

  const deactivate = async () => {
    await userApi.deactivate(deactivateUser.id);
    invalidateQueries("users:");
    refetch();
    toast.push("Akun dinonaktifkan.", { type: "success" });
  };

  const columns = [
    { key: "full_name", header: "Nama Lengkap" },
    { key: "username", header: "Username", render: (r) => <span className="mono">{r.username}</span> },
    { key: "email", header: "Email" },
    { key: "role", header: "Role", render: (r) => <RoleBadge role={r.role} /> },
    {
      key: "is_active",
      header: "Status",
      render: (r) => (
        <span className={`badge ${r.is_active ? "badge--approved" : "badge--neutral"}`}>
          {r.is_active ? "Aktif" : "Nonaktif"}
        </span>
      ),
    },
    { key: "created_at", header: "Dibuat", render: (r) => formatDate(r.created_at) },
    {
      key: "_action",
      header: "Aksi",
      render: (r) => (
        <div className="row" style={{ gap: 6 }}>
          <Button variant="ghost" size="sm" onClick={() => setEditUser(r)}>Edit</Button>
          <Button variant="ghost" size="sm" onClick={() => setResetUser(r)}>Reset Password</Button>
          {r.is_active ? (
            <Button variant="ghost" size="sm" onClick={() => setDeactivateUser(r)}>Nonaktifkan</Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => toggleActive(r, true)}>Aktifkan</Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Manajemen User"
        subtitle="Akun staf dan hak akses"
        actions={<Button onClick={() => setShowCreate(true)}>+ Tambah User</Button>}
      />

      <div className="toolbar">
        <Input
          placeholder="Cari nama / username / email…"
          value={search}
          onChange={(e) => { setPage(1); setSearch(e.target.value); }}
          aria-label="Cari user"
          style={{ minWidth: 260 }}
        />
        <Select value={role} onChange={(e) => { setPage(1); setRole(e.target.value); }} aria-label="Filter role">
          <option value="">Semua role</option>
          <option value="agent">Petugas</option>
          <option value="supervisor">Supervisor</option>
          <option value="admin">Administrator</option>
        </Select>
      </div>

      <Card>
        <DataTable columns={columns} rows={data?.items || []} loading={loading} error={error} onRetry={refetch} emptyTitle="Tidak ada user" />
        {data && (
          <Pagination page={data.page} pages={data.pages} total={data.total} pageSize={data.page_size} onPageChange={setPage} />
        )}
      </Card>

      <CreateUserModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onDone={() => { setShowCreate(false); invalidateQueries("users:"); refetch(); toast.push("User dibuat.", { type: "success" }); }}
      />
      <EditUserModal
        user={editUser}
        onClose={() => setEditUser(null)}
        onDone={() => { setEditUser(null); invalidateQueries("users:"); refetch(); toast.push("User diperbarui.", { type: "success" }); }}
      />
      <ResetPasswordModal
        user={resetUser}
        onClose={() => setResetUser(null)}
        onDone={() => { setResetUser(null); toast.push("Password berhasil direset.", { type: "success" }); }}
      />

      <ConfirmDialog
        open={Boolean(deactivateUser)}
        onClose={() => setDeactivateUser(null)}
        onConfirm={deactivate}
        title="Nonaktifkan Akun"
        description="User tidak dapat login dan semua sesinya akan dihentikan."
        confirmLabel="Nonaktifkan"
        variant="danger"
        details={deactivateUser && <div className="callout callout--warning">{deactivateUser.full_name} (@{deactivateUser.username})</div>}
      />
    </div>
  );
}

function CreateUserModal({ open, onClose, onDone }) {
  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    setSubmitting(true);
    setError("");
    try {
      await userApi.create(form);
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
      title="Tambah User Baru"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>Batal</Button>
          <Button onClick={submit} loading={submitting}>Simpan</Button>
        </>
      }
    >
      {error && <Alert type="error" onClose={() => setError("")}>{error}</Alert>}
      <Input label="Nama Lengkap" required value={form.full_name} onChange={set("full_name")} />
      <Input label="Username" required value={form.username} onChange={set("username")} autoComplete="off" />
      <Input label="Email" type="email" required value={form.email} onChange={set("email")} />
      <PasswordInput label="Password" required value={form.password} onChange={set("password")} hint="Minimal 8 karakter, kombinasi kuat." autoComplete="new-password" />
      <Select label="Role" value={form.role} onChange={set("role")}>
        <option value="agent">Petugas</option>
        <option value="supervisor">Supervisor</option>
        <option value="admin">Administrator</option>
      </Select>
    </Modal>
  );
}

function EditUserModal({ user, onClose, onDone }) {
  const [form, setForm] = useState({ full_name: "", email: "", role: "agent" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const key = user?.id;

  useMemo(() => {
    if (user) setForm({ full_name: user.full_name, email: user.email, role: user.role });
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    setSubmitting(true);
    setError("");
    try {
      await userApi.update(user.id, form);
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={Boolean(user)}
      onClose={onClose}
      title={`Edit User — ${user?.username ?? ""}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>Batal</Button>
          <Button onClick={submit} loading={submitting}>Simpan</Button>
        </>
      }
    >
      {error && <Alert type="error" onClose={() => setError("")}>{error}</Alert>}
      <Input label="Nama Lengkap" value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} />
      <Input label="Email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
      <Select label="Role" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
        <option value="agent">Petugas</option>
        <option value="supervisor">Supervisor</option>
        <option value="admin">Administrator</option>
      </Select>
    </Modal>
  );
}

function ResetPasswordModal({ user, onClose, onDone }) {
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setSubmitting(true);
    setError("");
    try {
      await userApi.resetPassword(user.id, password);
      setPassword("");
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={Boolean(user)}
      onClose={onClose}
      title={`Reset Password — ${user?.username ?? ""}`}
      description="Password lama tidak diperlukan. Sampaikan password baru lewat jalur aman."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>Tutup</Button>
          <Button onClick={submit} loading={submitting}>Reset Password</Button>
        </>
      }
    >
      {error && <Alert type="error" onClose={() => setError("")}>{error}</Alert>}
      <PasswordInput label="Password Baru" required value={password} onChange={(e) => setPassword(e.target.value)} />
    </Modal>
  );
}
