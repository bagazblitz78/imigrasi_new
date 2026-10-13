import { useAuth } from "../../contexts/AuthContext";
import AdminDashboard from "./AdminDashboard";
import AgentDashboard from "./AgentDashboard";
import SupervisorDashboard from "./SupervisorDashboard";

export default function DashboardRouter() {
  const { role } = useAuth();
  if (role === "admin") return <AdminDashboard />;
  if (role === "supervisor") return <SupervisorDashboard />;
  return <AgentDashboard />;
}
