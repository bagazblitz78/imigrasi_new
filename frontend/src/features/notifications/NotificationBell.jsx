import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { API_BASE, USE_MOCK } from "../../api/client";
import { authApi, notificationApi } from "../../api/endpoints";
import { CardSkeleton, EmptyState } from "../../components/ui";
import { useApiQuery } from "../../hooks/useApiQuery";
import { relativeTime } from "../../utils/format";

const MAX_BACKOFF = 30000;

// Real-time notification bell (supervisors/admins) with history + reconnect.
export function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [live, setLive] = useState([]);
  const [connected, setConnected] = useState(false);
  const esRef = useRef(null);
  const retryRef = useRef(null);
  const backoffRef = useRef(2000);

  const { data, loading, refetch, setData } = useApiQuery(
    "notifications:list",
    () => notificationApi.list(),
    { staleTime: 15000 },
  );

  const notifications = mergeNotifications(live, data);

  const connect = useCallback(async () => {
    if (USE_MOCK) {
      // Demo mode: no live stream; history comes from the fixtures.
      return;
    }
    try {
      const { ticket } = await authApi.refreshStreamTicket();
      const es = new EventSource(`${API_BASE}/notifications/stream?ticket=${ticket}`);
      esRef.current = es;
      es.onopen = () => {
        setConnected(true);
        backoffRef.current = 2000;
      };
      es.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.event === "ping" || payload.event === "heartbeat" || payload.event === "ready") {
            return;
          }
          setLive((prev) => [{ ...payload, id: `live-${Date.now()}`, is_read: false }, ...prev].slice(0, 20));
        } catch {
          /* ignore malformed frame */
        }
      };
      es.onerror = () => {
        setConnected(false);
        es.close();
        esRef.current = null;
        retryRef.current = setTimeout(connect, backoffRef.current);
        backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF);
      };
    } catch {
      setConnected(false);
      retryRef.current = setTimeout(connect, backoffRef.current);
      backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF);
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(retryRef.current);
      esRef.current?.close();
      esRef.current = null;
    };
  }, [connect]);

  const unread = notifications.filter((n) => !n.is_read).length;

  const openTarget = (n) => {
    setOpen(false);
    if (n.target_type === "escalation") navigate("/escalations");
    else if (n.target_type === "voa") navigate("/voa");
    else navigate("/passengers");
  };

  const markRead = async (n) => {
    if (n.is_read || String(n.id).startsWith("live-")) return;
    try {
      await notificationApi.markRead(n.id);
      setData((data || []).map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
    } catch {
      /* best effort */
    }
  };

  const markAll = async () => {
    try {
      await notificationApi.markAllRead();
      setLive((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setData((data || []).map((x) => ({ ...x, is_read: true })));
    } catch {
      /* best effort */
    }
  };

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        className="icon-btn"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifikasi${unread ? `, ${unread} belum dibaca` : ""}`}
        aria-expanded={open}
      >
        🔔
        {unread > 0 && <span className="notif-dot">{unread > 9 ? "9+" : unread}</span>}
      </button>

      {open && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 250 }}
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="notif-panel" role="dialog" aria-label="Daftar notifikasi">
            <div className="notif-panel__header">
              <span>Notifikasi</span>
              <div className="row" style={{ gap: 12 }}>
                <span
                  className="connection-status"
                  title={USE_MOCK ? "Mode demo" : connected ? "Terhubung" : "Terputus"}
                >
                  <span
                    className={`connection-status__dot ${USE_MOCK || connected ? "" : "connection-status__dot--off"}`}
                  />
                  {USE_MOCK ? "Demo" : connected ? "Live" : "Offline"}
                </span>
              </div>
            </div>
            <div className="notif-panel__list">
              {loading && !notifications.length ? (
                <div style={{ padding: 12 }}>
                  <CardSkeleton count={2} />
                </div>
              ) : notifications.length === 0 ? (
                <EmptyState icon="🔔" title="Tidak ada notifikasi" />
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    className={[
                      "notif-item",
                      n.is_read ? "" : "notif-item--unread",
                      `notif-item--${n.severity || "info"}`,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => {
                      markRead(n);
                      openTarget(n);
                    }}
                  >
                    <div className="notif-item__title">{n.title || n.event}</div>
                    {n.message && <div className="notif-item__msg">{n.message}</div>}
                    <div className="notif-item__time">{relativeTime(n.created_at || n.timestamp)}</div>
                  </button>
                ))
              )}
            </div>
            <div className="notif-panel__header" style={{ borderTop: "1px solid var(--border)", borderBottom: "none" }}>
              <button className="btn btn--ghost btn--sm" onClick={markAll} disabled={!unread}>
                Tandai semua dibaca
              </button>
              <button
                className="btn btn--ghost btn--sm"
                onClick={() => {
                  setLive([]);
                  refetch();
                }}
              >
                Muat ulang
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function mergeNotifications(live, persisted) {
  const seen = new Set();
  const merged = [];
  for (const n of [...live, ...(persisted || [])]) {
    const key = n.id;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(n);
  }
  return merged;
}
