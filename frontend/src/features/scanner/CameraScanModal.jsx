import { useCallback, useEffect, useRef, useState } from "react";

import { passengerApi } from "../../api/endpoints";
import { Alert, Button, Modal } from "../../components/ui";

const MAX_FILE_BYTES = 8 * 1024 * 1024;

export function CameraScanModal({ open, onClose, onScanned }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [ready, setReady] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [camError, setCamError] = useState("");
  const [scanError, setScanError] = useState("");

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    setCamError("");
    setScanError("");
    setReady(false);

    if (!navigator.mediaDevices?.getUserMedia) {
      setCamError("Browser tidak mendukung akses kamera. Gunakan unggah foto manual.");
      return undefined;
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => setReady(true);
        }
      })
      .catch((err) => {
        setCamError(
          `Tidak dapat mengakses kamera (${err.message || "izin ditolak"}). Gunakan unggah foto manual.`,
        );
      });

    return stopStream;
  }, [open, stopStream]);

  const handleClose = () => {
    stopStream();
    onClose();
  };

  const upload = async (blob, filename) => {
    setScanning(true);
    setScanError("");
    try {
      const file = new File([blob], filename, { type: blob.type || "image/jpeg" });
      const result = await passengerApi.scanMrz(file);
      onScanned(result);
      handleClose();
    } catch (err) {
      setScanError(err.message || "Pemindaian gagal. Coba lagi.");
    } finally {
      setScanning(false);
    }
  };

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    canvas.toBlob((blob) => blob && upload(blob, "scan.jpg"), "image/jpeg", 0.92);
  };

  const handleFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setScanError("Ukuran gambar maksimal 8MB");
      return;
    }
    upload(file, file.name);
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Pindai MRZ Paspor"
      description="Posisikan dua baris MRZ di dalam kotak, lalu ambil foto."
      size="md"
    >
      {camError && <Alert type="warning">{camError}</Alert>}
      {scanError && <Alert type="error" onClose={() => setScanError("")}>{scanError}</Alert>}

      {!camError && (
        <div className="scanner-video">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ display: ready ? "block" : "none" }}
          />
          {!ready && <span>Membuka kamera…</span>}
          {ready && <div className="scanner-guide" />}
        </div>
      )}

      <div className="row" style={{ marginTop: 16 }}>
        <Button
          onClick={capture}
          loading={scanning}
          disabled={!ready || scanning}
          block
        >
          📸 Ambil Foto &amp; Pindai
        </Button>
        <Button variant="ghost" onClick={handleClose} disabled={scanning}>
          Batal
        </Button>
      </div>

      <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
        <label className="field__label" htmlFor="mrz-file">
          Kamera tidak tersedia? Unggah foto paspor
        </label>
        <input
          id="mrz-file"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFile}
          disabled={scanning}
        />
        <div className="field__hint">
          Format JPEG/PNG/WEBP, maksimal 8MB. Foto diproses di server, tidak dikirim ke pihak ketiga.
        </div>
      </div>

      <canvas ref={canvasRef} style={{ display: "none" }} />
    </Modal>
  );
}
