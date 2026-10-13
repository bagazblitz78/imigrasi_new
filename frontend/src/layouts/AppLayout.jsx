import { useCallback, useEffect, useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

import { USE_MOCK } from "../api/client";
import { authApi, escalationApi, voaApi } from "../api/endpoints";
import { Button, Modal, PasswordInput, useToast } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { useApiQuery } from "../hooks/useApiQuery";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { useSessionManager } from "../hooks/useSessionManager";
import { NotificationBell } from "../features/notifications/NotificationBell";
import { NAV_ITEMS } from "./navConfig";
import { Sidebar } from "./Sidebar";

function titleForPath(pathname) {
  const match = [...NAV_ITEMS]
    .filter((i) => (i.end ? pathname === i.to : pathname.startsWith(i.to)))
    .sort((a, b) => b.to.length - a.to.length)[0];
  return match?.label || "Dashboard";
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const online = useOnlineStatus();
  const navigate = useNavigate();
  const location = useLocation();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleExpire = useCallback(() => {
    logout();
  }, [logout]);

  const warning = useSessionManager({ enabled: true, onExpire: handleExpire });

  // Sidebar badges for supervisors (pending escalations / VOA).
  const isSupervisor = user.role === "supervisor" || user.role === "admin";
  const { data: supDash } = useApiQuery(
    "notifications:badges",
    () => escalationApi.dashboard(),
    { enabled: isSupervisor, staleTime: 20000 },
  );
  const { data: voaPage } = useApiQuery(
    "notifications:voa-pending",
    () => voaApi.list({ status: "pending", page: 1, page_size: 1 }),
    { enabled: user.role === "supervisor", staleTime: 20000 },
  );

  const badges = useMemo(
    () => ({
      escalations: supDash?.pending_escalations || 0,
      voa: voaPage?.total || 0,
    }),
    [supDash, voaPage],
  );

  useEffect(() => {
    setMobileOpen(false);
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Lewati ke konten
      </a>
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onNavigate={() => setMobileOpen(false)}
        badges={badges}
      />
      {mobileOpen && <div className="sidebar__scrim" onClick={() => setMobileOpen(false)} />}

      <div className={`main ${collapsed ? "main--collapsed" : ""}`}>
        <header className="topbar">
          <button
            className="icon-btn"
            onClick={() => {
              if (window.innerWidth <= 860) setMobileOpen((v) => !v);
              else setCollapsed((v) => !v);
            }}
            aria-label="Buka/tutup navigasi"
          >
            ☰
          </button>
          <div>
            <div className="topbar__title">{titleForPath(location.pathname)}</div>
            <div className="topbar__subtitle">
              {new Date().toLocaleDateString("id-ID", {
                weekday: "long",
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            </div>
          </div>
          <div className="topbar__spacer" />
          {USE_MOCK && <span className="badge badge--pending">MODE DEMO</span>}
          <span className="connection-status" title={online ? "Online" : "Offline"}>
            <span className={`connection-status__dot ${online ? "" : "connection-status__dot--off"}`} />
            {online ? "Online" : "Offline"}
          </span>
          {isSupervisor && <NotificationBell />}
          <div style={{ position: "relative" }}>
            <button
              className="icon-btn"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Menu pengguna"
              aria-expanded={menuOpen}
            >
              👤
            </button>
            {menuOpen && (
              <>
                <div
                  style={{ position: "fixed", inset: 0, zIndex: 250 }}
                  onClick={() => setMenuOpen(false)}
                  aria-hidden="true"
                />
                <div
                  className="notif-panel"
                  style={{ width: 260 }}
                  role="menu"
                  aria-label="Menu pengguna"
                >
                  <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
                    <div style={{ fontWeight: 600 }}>{user.full_name}</div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      @{user.username}
                    </div>
                  </div>
                  <button
                    className="notif-item"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      setShowPassword(true);
                    }}
                  >
                    Ubah Password
                  </button>
                  <button
                    className="notif-item"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      logout();
                    }}
                  >
                    Keluar
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        <main className="content" id="main-content">
          <Outlet />
        </main>
      </div>

      <ChangePasswordModal
        open={showPassword}
        onClose={() => setShowPassword(false)}
        onDone={() => {
          toast.push("Password diubah. Silakan login kembali.", { type: "success" });
          logout();
        }}
      />

      {warning && (
        <div className="toast toast--warning" style={{ position: "fixed", bottom: 22, right: 22, zIndex: 500 }}>
          Sesi akan berakhir dalam ~{warning.remainingMinutes} menit karena tidak ada aktivitas.
        </div>
      )}
    </div>
  );
}

function ChangePasswordModal({ open, onClose, onDone }) {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { user } = useAuth();

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await authApi.changePassword({ old_password: oldPassword, new_password: newPassword });
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Ubah Password"
      description={`Untuk akun @${user.username}`}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Batal
          </Button>
          <Button onClick={submit} loading={loading}>
            Simpan
          </Button>
        </>
      }
    >
      <form onSubmit={submit}>
        {error && <div className="alert alert--error">{error}</div>}
        <PasswordInput
          label="Password Lama"
          required
          value={oldPassword}
          onChange={(e) => setOldPassword(e.target.value)}
          autoComplete="current-password"
        />
        <PasswordInput
          label="Password Baru"
          required
          hint="Minimal 8 karakter, kombinasi huruf besar/kecil, angka, atau simbol."
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
        />
      </form>
    </Modal>
  );
}
