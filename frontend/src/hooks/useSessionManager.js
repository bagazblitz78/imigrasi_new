import { useEffect, useRef, useState } from "react";

import { refreshSession } from "../api/client";

const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];
const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // hard idle logout (matches access token TTL)
const WARNING_AFTER_MS = 10 * 60 * 1000; // show warning after 10 min idle
const REFRESH_COOLDOWN_MS = 5 * 60 * 1000; // extend backend session at most every 5 min

// Keeps the backend session alive while the officer is active and logs out after
// inactivity. Returns the idle warning state for the toast.
export function useSessionManager({ enabled, onExpire }) {
  const lastActivityRef = useRef(Date.now());
  const lastRefreshRef = useRef(0);
  const [warning, setWarning] = useState(null);

  useEffect(() => {
    if (!enabled) return undefined;
    lastActivityRef.current = Date.now();

    const onActivity = () => {
      lastActivityRef.current = Date.now();
      setWarning(null);
      const now = Date.now();
      if (now - lastRefreshRef.current < REFRESH_COOLDOWN_MS) return;
      lastRefreshRef.current = now;
      refreshSession().catch(() => {
        /* access-token expiry will trigger the 401 flow if this keeps failing */
      });
    };

    ACTIVITY_EVENTS.forEach((evt) =>
      window.addEventListener(evt, onActivity, { passive: true }),
    );

    const timer = setInterval(() => {
      const idle = Date.now() - lastActivityRef.current;
      if (idle >= IDLE_TIMEOUT_MS) {
        onExpire();
        return;
      }
      if (idle >= WARNING_AFTER_MS) {
        setWarning({ remainingMinutes: Math.max(1, Math.ceil((IDLE_TIMEOUT_MS - idle) / 60000)) });
      }
    }, 1000);

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, onActivity));
      clearInterval(timer);
    };
  }, [enabled, onExpire]);

  return warning;
}
