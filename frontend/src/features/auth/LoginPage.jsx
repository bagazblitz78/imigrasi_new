import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { Alert, Button, Input, PasswordInput } from "../../components/ui";
import { useAuth } from "../../contexts/AuthContext";

export default function LoginPage() {
  const { login, isAuthenticated, status } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (status === "authenticated" || isAuthenticated) {
    return <Navigate to={location.state?.from || "/"} replace />;
  }

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(username.trim(), password);
      navigate(location.state?.from || "/", { replace: true });
    } catch (err) {
      setError(err.message || "Login gagal");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login">
      <aside className="login__aside" aria-hidden="true">
        <div className="login__brand">
          <div className="login__brand-mark">🛂</div>
          <div>
            <strong style={{ letterSpacing: "0.08em" }}>IMIGRASI</strong>
            <div style={{ fontSize: 11, color: "#94a3b8", letterSpacing: "0.14em" }}>
              SISTEM INFORMASI
            </div>
          </div>
        </div>
        <div>
          <h1 className="login__headline">Sistem Pemeriksaan Imigrasi Bandara</h1>
          <p className="login__lead">
            Platform operasional untuk verifikasi paspor, pengawasan daftar cekal, dan
            penanganan penumpang di bandara internasional.
          </p>
          <ul className="login__points">
            <li>✓ Verifikasi MRZ paspor secara lokal &amp; aman</li>
            <li>✓ Notifikasi real-time untuk supervisor</li>
            <li>✓ Jejak audit lengkap setiap tindakan</li>
          </ul>
        </div>
        <div style={{ fontSize: 12, color: "#64748b" }}>
          Hanya untuk petugas berwenang. Semua aktivitas dicatat.
        </div>
      </aside>

      <section className="login__panel">
        <div className="login__card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h2 className="login__title">Masuk ke Sistem</h2>
              <p className="login__subtitle">Gunakan kredensial akun petugas Anda</p>
            </div>
          </div>

          <Alert type="error" onClose={() => setError("")}>
            {error}
          </Alert>

          <form onSubmit={submit} noValidate>
            <Input
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              autoFocus
              placeholder="Masukkan username"
            />
            <PasswordInput
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              placeholder="Masukkan password"
            />
            <Button type="submit" block loading={loading}>
              {loading ? "Memverifikasi…" : "Masuk"}
            </Button>
          </form>

          <p className="login__footer">
            Sesi otomatis berakhir setelah tidak ada aktivitas dalam 15 menit.
          </p>
        </div>
      </section>
    </div>
  );
}
