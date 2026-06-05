import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Entreprise, Salarie } from "../model/types";

// CONTEXTE PARTAGE des couches de SAISIE : entreprise (couche 2) et salaries
// (couche 3). Il existe pour qu'un MEME etat soit lu et ecrit par PLUSIEURS ecrans
// (SaisiePage saisit, BulletinPage affiche le bulletin a partir de ce qui est saisi),
// au lieu d'etre detenu localement par une seule page.
//
// Une entreprise a PLUSIEURS salaries : le contexte detient donc une LISTE de
// salaries plus l'IDENTIFIANT du salarie actif (salarieSelectionneId). On stocke
// l'id, jamais une COPIE du salarie selectionne : sinon on aurait deux versions du
// meme salarie qui peuvent diverger. Le salarie courant (salarieSelectionne) est un
// simple DERIVE, recalcule par recherche dans la liste a chaque rendu ; les seules
// sources de verite sont salaries et salarieSelectionneId.
//
// FRONTIERE, non negociable : ce contexte ne porte QUE des objets de couches
// (Entreprise, Salarie) et de l'etat d'UI (liste, id selectionne). AUCUNE logique de
// calcul ici, AUCUN appel au moteur, AUCUN assemblerEntree. Le chemin vers le moteur
// reste assemblerEntree puis calculerBulletin, fait par la page, jamais par le
// contexte. Le moteur (src/engine) et le modele (src/model) n'importent JAMAIS ce
// fichier.
//
// La couche MENSUELLE (couche 4 : periode, heures, prime, conges) n'est PAS ici :
// elle est saisie chaque mois et reste locale a BulletinPage.

interface SaisieContextValue {
  // Couche 2 : objet racine. null tant qu'elle n'a pas ete saisie.
  entreprise: Entreprise | null;
  // Le formulaire emet toujours un objet de couche complet (jamais null) : le
  // setter n'accepte donc qu'un objet, pas null.
  setEntreprise: (entreprise: Entreprise) => void;

  // Couche 3 : liste des salaries (vide au depart) et id du salarie ACTIF.
  salaries: Salarie[];
  salarieSelectionneId: string | null;
  // DERIVE de salaries + salarieSelectionneId (pas une source de verite) : le
  // salarie actif retrouve dans la liste, ou null si liste vide / aucun selectionne.
  salarieSelectionne: Salarie | null;

  // Ajoute un salarie a la liste ET le rend actif (selection automatique a la
  // creation : le dirigeant vient de le saisir, il devient le salarie courant).
  ajouterSalarie: (salarie: Salarie) => void;
  // Change le salarie actif par id.
  selectionnerSalarie: (id: string) => void;
  // Met a jour un salarie existant (remplace dans la liste celui de meme id), sans
  // toucher a la selection. Pose pour l'edition d'un salarie existant ; pas encore
  // branche a une UI (voir RESTE A FAIRE dans CLAUDE.md).
  modifierSalarie: (salarie: Salarie) => void;
}

const SaisieContext = createContext<SaisieContextValue | null>(null);

export function SaisieProvider({ children }: { children: ReactNode }) {
  // Etat en memoire, sans persistance a ce stade (pas de Supabase ici).
  const [entreprise, setEntreprise] = useState<Entreprise | null>(null);
  // Sources de verite de la couche 3 : la liste et l'id du salarie actif.
  const [salaries, setSalaries] = useState<Salarie[]>([]);
  const [salarieSelectionneId, setSalarieSelectionneId] = useState<
    string | null
  >(null);

  const ajouterSalarie = useCallback((salarie: Salarie) => {
    setSalaries((prev) => [...prev, salarie]);
    // Le salarie ajoute devient l'actif.
    setSalarieSelectionneId(salarie.id);
  }, []);

  const selectionnerSalarie = useCallback((id: string) => {
    setSalarieSelectionneId(id);
  }, []);

  const modifierSalarie = useCallback((salarie: Salarie) => {
    setSalaries((prev) =>
      prev.map((s) => (s.id === salarie.id ? salarie : s)),
    );
  }, []);

  // DERIVE : recalcule a chaque rendu par recherche dans la liste. Pas de useState
  // dedie, pour qu'il ne puisse jamais se desynchroniser de salaries.
  const salarieSelectionne =
    salaries.find((s) => s.id === salarieSelectionneId) ?? null;

  const value = useMemo<SaisieContextValue>(
    () => ({
      entreprise,
      setEntreprise,
      salaries,
      salarieSelectionneId,
      salarieSelectionne,
      ajouterSalarie,
      selectionnerSalarie,
      modifierSalarie,
    }),
    [
      entreprise,
      salaries,
      salarieSelectionneId,
      salarieSelectionne,
      ajouterSalarie,
      selectionnerSalarie,
      modifierSalarie,
    ],
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
