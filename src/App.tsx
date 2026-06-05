import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthProvider";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { SaisieProvider } from "./context/SaisieContext";
import { LoginPage } from "./pages/LoginPage";
import { HomePage } from "./pages/HomePage";
import { BulletinPage } from "./pages/BulletinPage";
import { SaisiePage } from "./pages/SaisiePage";

// Declaration des routes de l'application.
// "/" est protegee, "/login" est publique.
//
// SaisieProvider enveloppe toutes les routes : l'etat de saisie (entreprise et
// liste de salaries) est ainsi PARTAGE entre /saisie (qui le saisit) et /bulletin
// (qui l'affiche). Version simple sans route layout / Outlet a ce stade (pas de
// persistance). /login et / sont sous le provider mais ne le consomment pas.
export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <SaisieProvider>
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
        </SaisieProvider>
      </BrowserRouter>
    </AuthProvider>
  );
}
