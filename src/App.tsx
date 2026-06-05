import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthProvider";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { LoginPage } from "./pages/LoginPage";
import { HomePage } from "./pages/HomePage";
import { BulletinPage } from "./pages/BulletinPage";
import { SaisiePage } from "./pages/SaisiePage";

// Declaration des routes de l'application.
// "/" est protegee, "/login" est publique.
export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <HomePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/bulletin"
            element={
              <ProtectedRoute>
                <BulletinPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/saisie"
            element={
              <ProtectedRoute>
                <SaisiePage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
