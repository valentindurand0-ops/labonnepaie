import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./useAuth";

// Garde de route : n'affiche children que si un utilisateur est connecte.
// Sinon redirige vers /login. Pendant le chargement de la session initiale,
// on n'affiche rien pour eviter un flash de la page de connexion.
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
