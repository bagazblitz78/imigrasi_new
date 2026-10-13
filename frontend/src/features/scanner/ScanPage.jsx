import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { escalationApi, passengerApi } from "../../api/endpoints";
import {
  Alert,
  Button,
  Card,
  ConfirmDialog,
  Input,
  PageHeader,
  Select,
  StatusBadge,
  Textarea,
  useToast,
} from "../../components/ui";
import { DIRECTIONS } from "../../constants";
import { invalidateQueries } from "../../hooks/useApiQuery";
import { toTitleCase } from "../../utils/format";
import { CameraScanModal } from "./CameraScanModal";

const EMPTY_FORM = {
  full_name: "",
  passport_number: "",
  nationality: "",
  visa_type: "",
  flight_number: "",
  direction: "arrival",
  notes: "",
};

export default function ScanPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [mrz, setMrz] = useState(null);
  const [showCamera, setShowCamera] = useState(false);

  const [approveOpen, setApproveOpen] = useState(false);
  const [escalateOpen, setEscalateOpen] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const validate = () => {
    const next = {};
    if (!form.full_name.trim()) next.full_name = "Nama lengkap wajib diisi";
    const passport = form.passport_number.replace(/[^A-Za-z0-9]/g, "");
    if (!passport) next.passport_number = "Nomor paspor wajib diisi";
    else if (passport.length < 3) next.passport_number = "Nomor paspor minimal 3 karakter";
    if (!form.nationality.trim()) next.nationality = "Kewarganegaraan wajib diisi";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setError("");
    try {
      const data = await passengerApi.create({
        ...form,
        passport_number: form.passport_number.replace(/[^A-Za-z0-9]/g, "").toUpperCase(),
      });
      setResult(data);
      invalidateQueries("passengers:");
      if (data.blacklist_hit) {
        toast.push("Penumpang terdeteksi daftar cekal — eskalasi otomatis dibuat.", { type: "warning" });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const onMrzScanned = (data) => {
    setMrz(data);
    setForm((f) => ({
      ...f,
      full_name: toTitleCase([data.given_names, data.surname].filter(Boolean).join(" ")) || f.full_name,
      passport_number: data.document_number || f.passport_number,
      nationality: data.nationality || f.nationality,
    }));
    setNotice("Data dari MRZ terisi otomatis. Periksa dan lengkapi sebelum verifikasi.");
  };

  const approve = async () => {
    await passengerApi.approve(result.id);
    setResult((prev) => ({ ...prev, status: "approved" }));
    invalidateQueries("passengers:");
    toast.push("Penumpang diizinkan masuk.", { type: "success" });
  };

  const escalate = async (reason) => {
    await escalationApi.create({ passenger_id: result.id, reason: reason || "Ditinjau supervisor" });
    setResult((prev) => ({ ...prev, status: "hold" }));
    invalidateQueries("passengers:");
    invalidateQueries("escalations:");
    toast.push("Penumpang ditahan dan diteruskan ke Supervisor.", { type: "warning" });
  };

  const reset = () => {
    setForm(EMPTY_FORM);
    setErrors({});
    setResult(null);
    setError("");
    setNotice("");
    setMrz(null);
  };

  const isBlacklisted = Boolean(result?.blacklist_hit);

  return (
    <div>
      <PageHeader
        title="Verifikasi Paspor"
        subtitle="Input dan periksa data penumpang"
        actions={
          <Button variant="secondary" onClick={() => setShowCamera(true)}>
            📷 Pindai MRZ
          </Button>
        }
      />

      <div className="grid" style={{ gridTemplateColumns: "minmax(0, 1fr) 360px", alignItems: "start" }}>
        <Card pad>
          {error && <Alert type="error" onClose={() => setError("")}>{error}</Alert>}
          {notice && <Alert type="success" onClose={() => setNotice("")}>{notice}</Alert>}

          {result ? (
            <div>
              <div className={`result-banner result-banner--${isBlacklisted ? "hit" : "clear"}`}>
                <div className="result-banner__title">
                  {isBlacklisted ? "⛔ Terdeteksi Daftar Cekal" : "✓ Aman — Tidak terdeteksi"}
                </div>
                {isBlacklisted ? (
                  <p style={{ margin: 0, fontSize: 13 }}>
                    Alasan: {result.blacklist_hit}. Penumpang otomatis ditahan untuk ditinjau Supervisor.
                  </p>
                ) : (
                  <p style={{ margin: 0, fontSize: 13 }}>Tidak ada kecocokan daftar cekal.</p>
                )}
              </div>

              <div className="data-grid" style={{ marginBottom: 20 }}>
                <DataItem label="Nama" value={result.full_name} />
                <DataItem label="No. Paspor" value={<span className="mono">{result.passport_number}</span>} />
                <DataItem label="Kewarganegaraan" value={result.nationality} />
                <DataItem label="Jenis Visa" value={result.visa_type || "—"} />
                <DataItem label="Penerbangan" value={result.flight_number || "—"} />
                <DataItem label="Arah" value={DIRECTIONS[result.direction]} />
                <DataItem label="Status" value={<StatusBadge status={result.status} />} />
                <DataItem label="Waktu" value={new Date(result.created_at).toLocaleString("id-ID")} />
              </div>

              <div className="row" style={{ flexWrap: "wrap" }}>
                {!isBlacklisted && result.status === "pending" && (
                  <Button variant="success" onClick={() => setApproveOpen(true)}>
                    ✓ Setujui Masuk
                  </Button>
                )}
                {!isBlacklisted && result.status === "pending" && (
                  <Button variant="danger" onClick={() => setEscalateOpen(true)}>
                    ⚠ Tahan / Eskalasi
                  </Button>
                )}
                {result.status === "approved" && (
                  <Alert type="success">Penumpang diizinkan masuk.</Alert>
                )}
                {result.status === "hold" && (
                  <Alert type="warning">Penumpang ditahan, menunggu keputusan Supervisor.</Alert>
                )}
                <Button variant="ghost" onClick={reset}>
                  Pindai Baru
                </Button>
                <Button variant="ghost" onClick={() => navigate("/passengers")}>
                  Lihat Data
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} noValidate>
              <div className="form-grid">
                <div className="span-2">
                  <Input
                    label="Nama Lengkap"
                    required
                    value={form.full_name}
                    onChange={set("full_name")}
                    error={errors.full_name}
                    placeholder="Sesuai paspor"
                  />
                </div>
                <Input
                  label="Nomor Paspor"
                  required
                  value={form.passport_number}
                  onChange={set("passport_number")}
                  error={errors.passport_number}
                  placeholder="Contoh: AB123456"
                  className="mono"
                />
                <Input
                  label="Kewarganegaraan"
                  required
                  value={form.nationality}
                  onChange={set("nationality")}
                  error={errors.nationality}
                  placeholder="Indonesia"
                />
                <Input
                  label="Jenis Visa"
                  value={form.visa_type}
                  onChange={set("visa_type")}
                  placeholder="Tourist, Business, dll"
                />
                <Input
                  label="Nomor Penerbangan"
                  value={form.flight_number}
                  onChange={set("flight_number")}
                  placeholder="GA-123"
                />
                <div className="span-2">
                  <Select label="Arah Perjalanan" value={form.direction} onChange={set("direction")}>
                    <option value="arrival">Kedatangan</option>
                    <option value="departure">Keberangkatan</option>
                  </Select>
                </div>
                <div className="span-2">
                  <Textarea label="Catatan" value={form.notes} onChange={set("notes")} placeholder="Catatan tambahan…" />
                </div>
              </div>
              <Button type="submit" block loading={loading}>
                {loading ? "Memverifikasi…" : "🔍 Verifikasi & Cek Daftar Cekal"}
              </Button>
            </form>
          )}
        </Card>

        <div className="stack">
          {mrz && (
            <Card pad>
              <div className="card__title" style={{ marginBottom: 12 }}>
                Hasil Pindai MRZ
              </div>
              <div className="data-grid" style={{ gridTemplateColumns: "1fr" }}>
                <DataItem label="Nomor Dokumen" value={mrz.document_number || "—"} />
                <DataItem label="Nama" value={`${mrz.given_names || ""} ${mrz.surname || ""}`.trim() || "—"} />
                <DataItem label="Kewarganegaraan" value={mrz.nationality || "—"} />
                <DataItem label="Tanggal Lahir" value={mrz.birth_date || "—"} />
                <DataItem label="Kedaluwarsa" value={mrz.expiry_date || "—"} />
              </div>
              {mrz.raw_mrz && (
                <pre className="mono" style={{ fontSize: 11, whiteSpace: "pre-wrap", marginTop: 12, color: "var(--text-muted)" }}>
                  {mrz.raw_mrz}
                </pre>
              )}
            </Card>
          )}

          <Card pad>
            <div className="card__title" style={{ marginBottom: 12 }}>
              Panduan
            </div>
            <div className="stack" style={{ gap: 12 }}>
              <GuideItem title="Aman" text="Tombol setujui muncul jika tidak ada catatan cekal." />
              <GuideItem title="Kena cekal" text="Sistem menahan penumpang dan meneruskan otomatis ke Supervisor." />
              <GuideItem title="MRZ" text="Gunakan pemindai MRZ, lalu koreksi manual bila perlu." />
            </div>
          </Card>
        </div>
      </div>

      <CameraScanModal open={showCamera} onClose={() => setShowCamera(false)} onScanned={onMrzScanned} />

      <ConfirmDialog
        open={approveOpen}
        onClose={() => setApproveOpen(false)}
        onConfirm={approve}
        title="Setujui Penumpang"
        description="Penumpang akan diizinkan masuk."
        confirmLabel="Setujui Masuk"
        variant="success"
        details={
          result && (
            <dl className="detail-list">
              <div className="detail-row"><dt>Nama</dt><dd>{result.full_name}</dd></div>
              <div className="detail-row"><dt>Paspor</dt><dd className="mono">{result.passport_number}</dd></div>
              <div className="detail-row"><dt>Kewarganegaraan</dt><dd>{result.nationality}</dd></div>
              <div className="detail-row"><dt>Arah</dt><dd>{DIRECTIONS[result.direction]}</dd></div>
            </dl>
          )
        }
      />

      <ConfirmDialog
        open={escalateOpen}
        onClose={() => setEscalateOpen(false)}
        onConfirm={escalate}
        title="Tahan & Eskalasi ke Supervisor"
        description="Penumpang akan ditahan dan Supervisor menerima notifikasi real-time."
        confirmLabel="Tahan & Eskalasi"
        variant="danger"
        reasonLabel="Alasan eskalasi"
        reasonRequired
        details={
          result && (
            <div className="callout callout--warning">
              {result.full_name} — <span className="mono">{result.passport_number}</span>
            </div>
          )
        }
      />
    </div>
  );
}

function DataItem({ label, value }) {
  return (
    <div className="data-item">
      <div className="data-item__label">{label}</div>
      <div className="data-item__value">{value}</div>
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
