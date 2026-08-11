import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AdminLayout from "./components/AdminLayout";
import { AuthProvider, useAuth } from "./context/AuthContext";
import GuidePage from "./pages/GuidePage";
import LoginPage from "./pages/LoginPage";
import ReportsPage from "./pages/ReportsPage";
import StatsPage from "./pages/StatsPage";
import ThreatsPage from "./pages/ThreatsPage";
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
            <Route path="reports" element={<ReportsPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="guide" element={<GuidePage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
