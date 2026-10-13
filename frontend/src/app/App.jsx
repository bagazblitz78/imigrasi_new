import { Suspense, lazy } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import { CenteredSpinner } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { AppLayout } from "../layouts/AppLayout";
import ForbiddenPage from "../pages/ForbiddenPage";
import NotFoundPage from "../pages/NotFoundPage";

const LoginPage = lazy(() => import("../features/auth/LoginPage"));
const DashboardRouter = lazy(() => import("../features/dashboard/DashboardRouter"));
const ScanPage = lazy(() => import("../features/scanner/ScanPage"));
const PassengersPage = lazy(() => import("../features/passengers/PassengersPage"));
const EscalationsPage = lazy(() => import("../features/escalations/EscalationsPage"));
const VoaPage = lazy(() => import("../features/voa/VoaPage"));
const CountersPage = lazy(() => import("../features/counters/CountersPage"));
const StatsPage = lazy(() => import("../features/reports/StatsPage"));
const BlacklistPage = lazy(() => import("../features/blacklist/BlacklistPage"));
const UsersPage = lazy(() => import("../features/users/UsersPage"));
const ReportsPage = lazy(() => import("../features/reports/ReportsPage"));
const AuditLogsPage = lazy(() => import("../features/audit/AuditLogsPage"));

function FullPageLoader() {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <CenteredSpinner label="Menyiapkan sistem…" />
    </div>
  );
}

function RequireAuth({ children }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === "loading") return <FullPageLoader />;
  if (status === "anonymous") return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

function RoleRoute({ roles, children }) {
  const { role } = useAuth();
  if (!roles.includes(role)) return <ForbiddenPage />;
  return children;
}

export default function App() {
  return (
    <Suspense fallback={<FullPageLoader />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route index element={<DashboardRouter />} />
          <Route
            path="scan"
            element={
              <RoleRoute roles={["agent"]}>
                <ScanPage />
              </RoleRoute>
            }
          />
          <Route path="passengers" element={<PassengersPage />} />
          <Route
            path="escalations"
            element={
              <RoleRoute roles={["supervisor", "admin"]}>
                <EscalationsPage />
              </RoleRoute>
            }
          />
          <Route
            path="voa"
            element={
              <RoleRoute roles={["supervisor", "admin"]}>
                <VoaPage />
              </RoleRoute>
            }
          />
          <Route path="counters" element={<CountersPage />} />
          <Route
            path="stats"
            element={
              <RoleRoute roles={["supervisor", "admin"]}>
                <StatsPage />
              </RoleRoute>
            }
          />
          <Route
            path="blacklist"
            element={
              <RoleRoute roles={["admin"]}>
                <BlacklistPage />
              </RoleRoute>
            }
          />
          <Route
            path="users"
            element={
              <RoleRoute roles={["admin"]}>
                <UsersPage />
              </RoleRoute>
            }
          />
          <Route
            path="reports"
            element={
              <RoleRoute roles={["admin"]}>
                <ReportsPage />
              </RoleRoute>
            }
          />
          <Route
            path="audit"
            element={
              <RoleRoute roles={["admin"]}>
                <AuditLogsPage />
              </RoleRoute>
            }
          />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
