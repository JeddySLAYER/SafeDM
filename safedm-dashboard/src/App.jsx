import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AdminLayout from "./components/AdminLayout";
import { AuthProvider } from "./context/AuthContext";
import { useAuth } from "./context/useAuth";
import ApplicationsPage from "./pages/ApplicationsPage";
import GuidePage from "./pages/GuidePage";
import LinkGatePage from "./pages/LinkGatePage";
import LoginPage from "./pages/LoginPage";
import OperationsPage from "./pages/OperationsPage";
import ReportsPage from "./pages/ReportsPage";
import StatsPage from "./pages/StatsPage";
import PoliciesPage from "./pages/PoliciesPage";
import TrainingPage from "./pages/TrainingPage";
import ThreatDetailPage from "./pages/ThreatDetailPage";
import ThreatsPage from "./pages/ThreatsPage";
import UserDetailPage from "./pages/UserDetailPage";
import UsersPage from "./pages/UsersPage";
import "./App.css";

function Protected({ children }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <Protected>
                <AdminLayout />
              </Protected>
            }
          >
            <Route index element={<StatsPage />} />
            <Route path="threats" element={<ThreatsPage />} />
            <Route path="threats/:threatId" element={<ThreatDetailPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="link-gate" element={<LinkGatePage />} />
            <Route path="applications" element={<ApplicationsPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="users/:userId" element={<UserDetailPage />} />
            <Route path="guide" element={<GuidePage />} />
            <Route path="policies" element={<PoliciesPage />} />
            <Route path="operations" element={<OperationsPage />} />
            <Route path="training" element={<TrainingPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
