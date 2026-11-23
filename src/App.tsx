import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { RequireSession } from "./components/RequireSession";
import { SessionProvider } from "./components/SessionProvider";
import Callback from "./pages/Callback";
import HowItWorks from "./pages/HowItWorks";
import Landing from "./pages/Landing";
import Settings from "./pages/Settings";
import Sync from "./pages/Sync";
import Terms from "./pages/Terms";

// The graph library is large; only load it when the graph page is opened.
const Graph = lazy(() => import("./pages/Graph"));

export default function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Landing />} />
            <Route path="/callback" element={<Callback />} />

            <Route element={<RequireSession />}>
              <Route path="/terms" element={<Terms />} />
            </Route>

            <Route element={<RequireSession consent />}>
              <Route path="/sync" element={<Sync />} />
              <Route path="/settings" element={<Settings />} />
            </Route>

            <Route element={<RequireSession consent synced />}>
              <Route path="/how-it-works" element={<HowItWorks />} />
              <Route
                path="/graph"
                element={
                  <Suspense fallback={<p className="muted center">Loading graph…</p>}>
                    <Graph />
                  </Suspense>
                }
              />
            </Route>

            {/* Old callback path from the first version of the app. */}
            <Route path="/home" element={<Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </SessionProvider>
  );
}
