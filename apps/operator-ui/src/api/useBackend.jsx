// useBackend.jsx — live backend state for the whole app: /api/status polling + SSE refresh.
// connected=false => pages show an honest "backend offline" state (never fabricated data).
import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { api, subscribeStream } from './client.js';

const BackendContext = createContext(null);

export function BackendProvider({ children }) {
  const [status, setStatus] = useState(null);
  const [connected, setConnected] = useState(false);
  const timer = useRef(null);

  const refresh = useCallback(async () => {
    try {
      const r = await api.status();
      if (r.ok) {
        setStatus(r.data);
        setConnected(true);
      } else {
        setConnected(false);
      }
    } catch {
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    timer.current = setInterval(refresh, 5000);
    const unsub = subscribeStream(() => refresh());
    return () => { clearInterval(timer.current); unsub(); };
  }, [refresh]);

  const value = useMemo(() => ({ status, connected, refresh }), [status, connected, refresh]);
  return <BackendContext.Provider value={value}>{children}</BackendContext.Provider>;
}

export function useBackend() {
  const ctx = useContext(BackendContext);
  if (!ctx) throw new Error('useBackend must be used within BackendProvider');
  return ctx;
}
