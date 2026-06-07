import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Entreprise, Salarie } from "../model/types";
import { useAuth } from "../auth/useAuth";
import {
  chargerEntreprise,
  enregistrerEntreprise,
} from "../services/entrepriseStore";

// CONTEXTE PARTAGE des couches de SAISIE : entreprise (couche 2) et salaries
// (couche 3). Il existe pour qu'un MEME etat soit lu et ecrit par PLUSIEURS ecrans
// (SaisiePage saisit, BulletinPage affiche le bulletin a partir de ce qui est saisi),
// au lieu d'etre detenu localement par une seule page.
//
// CE FICHIER N'EST PLUS "PUR MEMOIRE". Depuis le branchement de la persistance, il
// ORCHESTRE le stockage de l'entreprise via src/services/entrepriseStore :
//   - LECTURE : au changement de session (connexion / changement de compte), il
//     hydrate l'entreprise depuis Supabase via chargerEntreprise(). statutEntreprise
//     suit ce cycle ('chargement' -> 'pret' | 'erreur').
//   - ECRITURE : sauvegarderEntreprise(e) persiste via enregistrerEntreprise() PUIS
//     pose dans l'etat l'objet RE-MAPPE renvoye par la base. setEntreprise n'est
//     jamais appele avec autre chose qu'un objet venu de la base (lecture ou ecriture)
//     pour que l'etat memoire reste un reflet fidele du stockage.
// La couche 3 (salaries) reste en memoire a ce stade (sa persistance est une etape
// ulterieure : salarieStore).
//
// FRONTIERE, non negociable : seule cette couche contexte/UI importe le store (et,
// indirectement, Supabase). Le moteur (src/engine) et le modele (src/model)
// n'importent JAMAIS ce fichier, ni le store, ni Supabase : ils restent purs. Ce
// contexte ne porte QUE des objets de couches (Entreprise, Salarie) et de l'etat
// d'UI. AUCUNE logique de CALCUL de paie ici, AUCUN appel au moteur, AUCUN
// assemblerEntree : le chemin vers le moteur reste assemblerEntree puis
// calculerBulletin, fait par la page.
//
// Une entreprise a PLUSIEURS salaries : le contexte detient donc une LISTE de
// salaries plus l'IDENTIFIANT du salarie actif (salarieSelectionneId). On stocke
// l'id, jamais une COPIE du salarie selectionne : sinon on aurait deux versions du
// meme salarie qui peuvent diverger. Le salarie courant (salarieSelectionne) est un
// simple DERIVE, recalcule par recherche dans la liste a chaque rendu ; les seules
// sources de verite sont salaries et salarieSelectionneId.
//
// La couche MENSUELLE (couche 4 : periode, heures, prime, conges) n'est PAS ici :
// elle est saisie chaque mois et reste locale a BulletinPage.

// Statut du cycle de LECTURE de l'entreprise. Le cas "pas encore d'entreprise" n'est
// PAS un statut a part : il se DEDUIT de (statutEntreprise === "pret" && entreprise
// === null).
export type StatutEntreprise = "chargement" | "pret" | "erreur";

interface SaisieContextValue {
  // Couche 2 : objet racine. null = soit pas encore charge (statut "chargement"),
  // soit charge mais aucune entreprise en base (statut "pret"), soit lecture en
  // echec (statut "erreur"). C'est statutEntreprise qui leve l'ambiguite.
  entreprise: Entreprise | null;
  // Etat du cycle de lecture de l'entreprise depuis le stockage.
  statutEntreprise: StatutEntreprise;
  // Message d'erreur de LECTURE (non null seulement quand statutEntreprise vaut
  // "erreur"). Les erreurs d'ECRITURE sont remontees par le rejet de
  // sauvegarderEntreprise, gerees localement par l'ecran appelant.
  erreurEntreprise: string | null;
  // Persiste l'entreprise (creation ou mise a jour) PUIS pose dans l'etat l'objet
  // re-mappe par la base. Rejette si l'ecriture echoue : dans ce cas l'etat memoire
  // n'est PAS modifie (l'appelant attrape et affiche l'erreur). Async par nature.
  sauvegarderEntreprise: (entreprise: Entreprise) => Promise<void>;

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
  // Etat d'authentification : la lecture / ecriture de l'entreprise depend du compte
  // connecte (RLS owner_id = auth.uid()). On lit la session pour ne charger qu'une
  // fois la session prete, et pour recharger / vider quand le compte change.
  const { user, loading: authLoading } = useAuth();

  // Couche 2 : entreprise et statut de sa lecture. statut initial "chargement" :
  // au montage la session n'est pas encore prete, on n'affiche pas "pas d'entreprise".
  const [entreprise, setEntreprise] = useState<Entreprise | null>(null);
  const [statutEntreprise, setStatutEntreprise] =
    useState<StatutEntreprise>("chargement");
  const [erreurEntreprise, setErreurEntreprise] = useState<string | null>(null);

  // Sources de verite de la couche 3 : la liste et l'id du salarie actif.
  const [salaries, setSalaries] = useState<Salarie[]>([]);
  const [salarieSelectionneId, setSalarieSelectionneId] = useState<
    string | null
  >(null);

  // LECTURE de l'entreprise au changement de session. Depend de user?.id (pas de
  // l'objet user, qui change a chaque refresh de token pour le meme compte) et de
  // authLoading (on attend que le JWT soit attache, sinon la requete partirait en
  // anonyme et la RLS renverrait 0 ligne a tort).
  useEffect(() => {
    // Session pas encore restauree : on attend, on reste en "chargement".
    if (authLoading) {
      return;
    }

    // Deconnecte : on VIDE tout l'etat de saisie. Indispensable au changement de
    // compte (sinon l'entreprise du compte precedent resterait en memoire) et a
    // l'isolation par compte. Rien a charger : statut "pret", entreprise null.
    if (!user) {
      setEntreprise(null);
      setSalaries([]);
      setSalarieSelectionneId(null);
      setErreurEntreprise(null);
      setStatutEntreprise("pret");
      return;
    }

    // Connecte : on (re)charge l'entreprise du compte. annule protege contre une
    // resolution tardive apres demontage ou changement de compte.
    let annule = false;
    setStatutEntreprise("chargement");
    setErreurEntreprise(null);
    chargerEntreprise()
      .then((e) => {
        if (annule) return;
        // e peut etre null : compte sans entreprise (cas normal, pas une erreur).
        setEntreprise(e);
        setStatutEntreprise("pret");
      })
      .catch((err) => {
        if (annule) return;
        setStatutEntreprise("erreur");
        setErreurEntreprise(
          err instanceof Error
            ? err.message
            : "Lecture de l'entreprise impossible.",
        );
      });

    return () => {
      annule = true;
    };
  }, [user?.id, authLoading]);

  // ECRITURE : persiste puis adopte l'objet re-mappe par la base. En cas d'echec, on
  // laisse l'erreur remonter (rejet) SANS toucher a l'etat memoire : l'appelant
  // affiche l'erreur, l'entreprise affichee reste celle d'avant. Un succes remet
  // aussi le statut a "pret" (utile si une lecture precedente avait echoue).
  const sauvegarderEntreprise = useCallback(async (e: Entreprise) => {
    const persistee = await enregistrerEntreprise(e);
    setEntreprise(persistee);
    setStatutEntreprise("pret");
    setErreurEntreprise(null);
  }, []);

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
      statutEntreprise,
      erreurEntreprise,
      sauvegarderEntreprise,
      salaries,
      salarieSelectionneId,
      salarieSelectionne,
      ajouterSalarie,
      selectionnerSalarie,
      modifierSalarie,
    }),
    [
      entreprise,
      statutEntreprise,
      erreurEntreprise,
      sauvegarderEntreprise,
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
