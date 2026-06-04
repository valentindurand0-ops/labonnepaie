import { useContext } from "react";
import { AuthContext } from "./AuthProvider";
import type { AuthContextValue } from "./AuthProvider";

// Hook d'acces au contexte d'authentification.
// Leve une erreur si utilise hors d'un AuthProvider, pour detecter
// rapidement une erreur de cablage des composants.
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth doit etre utilise a l'interieur d'un AuthProvider.");
  }
  return context;
}
