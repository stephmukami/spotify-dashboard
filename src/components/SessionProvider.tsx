import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { SessionResponse } from "../../shared/types";
import { api, ApiError } from "../lib/api";
import { SessionContext, type SessionState } from "../lib/session";

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionState["status"]>("loading");
  const [session, setSessionState] = useState<SessionResponse | null>(null);

  const setSession = useCallback((s: SessionResponse | null) => {
    setSessionState(s);
    setStatus(s ? "ready" : "anonymous");
  }, []);

  const refresh = useCallback(async () => {
    try {
      setSession(await api.getSession());
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setSession(null);
      else throw e;
    }
  }, [setSession]);

  useEffect(() => {
    refresh().catch(() => setSession(null));
  }, [refresh, setSession]);

  const value = useMemo(() => ({ status, session, setSession, refresh }), [status, session, setSession, refresh]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
