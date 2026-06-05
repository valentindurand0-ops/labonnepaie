import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Entreprise, Salarie } from "../model/types";

// CONTEXTE PARTAGE des couches de SAISIE : entreprise (couche 2) et salarie
// (couche 3). Il existe pour qu'un MEME etat soit lu et ecrit par PLUSIEURS ecrans
// (SaisiePage saisit, BulletinPage affiche le bulletin a partir de ce qui est saisi),
// au lieu d'etre detenu localement par une seule page.
//
// FRONTIERE, non negociable : ce contexte ne porte QUE des objets de couches
// (Entreprise, Salarie) plus les setters. AUCUNE logique de calcul ici, AUCUN appel
// au moteur, AUCUN assemblerEntree. Le chemin vers le moteur reste assemblerEntree
// puis calculerBulletin, fait par la page, jamais par le contexte. Le moteur
// (src/engine) et le modele (src/model) n'importent JAMAIS ce fichier.
//
// La couche MENSUELLE (couche 4 : periode, heures, prime, conges) n'est PAS ici :
// elle est saisie chaque mois et reste locale a BulletinPage.

interface SaisieContextValue {
  // null tant que la couche n'a pas ete saisie.
  entreprise: Entreprise | null;
  salarie: Salarie | null;
  // Les formulaires emettent toujours un objet de couche complet (jamais null) :
  // les setters n'acceptent donc qu'un objet, pas null.
  setEntreprise: (entreprise: Entreprise) => void;
  setSalarie: (salarie: Salarie) => void;
}

const SaisieContext = createContext<SaisieContextValue | null>(null);

export function SaisieProvider({ children }: { children: ReactNode }) {
  // Etat en memoire, sans persistance a ce stade (pas de Supabase ici).
  const [entreprise, setEntreprise] = useState<Entreprise | null>(null);
  const [salarie, setSalarie] = useState<Salarie | null>(null);

  const value = useMemo<SaisieContextValue>(
    () => ({ entreprise, salarie, setEntreprise, setSalarie }),
    [entreprise, salarie],
  );

  return (
    <SaisieContext.Provider value={value}>{children}</SaisieContext.Provider>
  );
}

// Accesseur du contexte. Garde-fou : utilise hors d'un SaisieProvider, on echoue
// franchement plutot que de manipuler un contexte nul silencieusement.
export function useSaisie(): SaisieContextValue {
  const ctx = useContext(SaisieContext);
  if (!ctx) {
    throw new Error("useSaisie doit etre utilise a l'interieur d'un SaisieProvider.");
  }
  return ctx;
}
