import { createContext, useContext } from "react";
import type { SessionResponse } from "../../shared/types";

export interface SessionState {
  status: "loading" | "anonymous" | "ready";
  session: SessionResponse | null;
  setSession: (session: SessionResponse | null) => void;
  refresh: () => Promise<void>;
}

export const SessionContext = createContext<SessionState | null>(null);

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
  return ctx;
}
