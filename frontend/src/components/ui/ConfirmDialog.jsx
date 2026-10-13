import { useState } from "react";

import { Button } from "./Button";
import { Modal } from "./Modal";

// Confirmation dialog for destructive / high-impact operations. Requires an
// explicit action and optionally a typed reason.
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  details,
  confirmLabel = "Konfirmasi",
  variant = "danger",
  reasonLabel,
  reasonRequired = false,
}) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleConfirm = async () => {
    if (reasonRequired && !reason.trim()) {
      setError("Alasan wajib diisi");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await onConfirm(reason.trim() || undefined);
      setReason("");
      onClose();
    } catch (err) {
      setError(err?.message || "Gagal memproses");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Batal
          </Button>
          <Button variant={variant} onClick={handleConfirm} loading={submitting}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {details}
      {reasonLabel && (
        <div className="field" style={{ marginTop: details ? 16 : 0 }}>
          <label className="field__label" htmlFor="confirm-reason">
            {reasonLabel}
            {reasonRequired && <span className="req">*</span>}
          </label>
          <textarea
            id="confirm-reason"
            className="textarea"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Tuliskan alasan…"
          />
        </div>
      )}
      {error && <div className="alert alert--error">{error}</div>}
    </Modal>
  );
}
