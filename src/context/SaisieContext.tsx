import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { BulletinMensuel, Entreprise, Salarie } from "../model/types";
import { useAuth } from "../auth/useAuth";
import {
  chargerEntreprise,
  enregistrerEntreprise,
} from "../services/entrepriseStore";
import {
  chargerSalaries,
  enregistrerSalarie,
} from "../services/salarieStore";
import {
  chargerBulletins,
  enregistrerBulletin,
} from "../services/bulletinStore";

// CONTEXTE PARTAGE des couches de SAISIE : entreprise (couche 2) et salaries
// (couche 3). Il existe pour qu'un MEME etat soit lu et ecrit par PLUSIEURS ecrans
// (SaisiePage saisit, BulletinPage affiche le bulletin a partir de ce qui est saisi),
// au lieu d'etre detenu localement par une seule page.
//
// CE FICHIER N'EST PLUS "PUR MEMOIRE". Depuis le branchement de la persistance, il
// ORCHESTRE le stockage de l'entreprise (couche 2) ET des salaries (couche 3) via
// src/services/entrepriseStore et src/services/salarieStore :
//   - LECTURE EN CASCADE : au changement de session, il hydrate d'abord l'entreprise
//     via chargerEntreprise() (statutEntreprise : 'chargement' -> 'pret' | 'erreur').
//     Une fois l'entreprise PRETE et connue, un second effet charge ses salaries via
//     chargerSalaries(entreprise.id) (statutSalaries suit le meme cycle). Les salaries
//     dependent de l'entreprise : leur chargement vient APRES, jamais avant. Un
//     troisieme effet charge l'historique (couche 4) du SEUL salarie ACTIF via
//     chargerBulletins(salarieSelectionneId) (statutBulletins suit le meme cycle) :
//     l'historique depend du salarie selectionne, son chargement vient APRES.
//   - ECRITURE : sauvegarderEntreprise / ajouterSalarie / modifierSalarie /
//     sauvegarderBulletin persistent via le store PUIS posent dans l'etat l'objet
//     RE-MAPPE renvoye par la base. On n'ecrit en memoire qu'APRES confirmation base
//     (pas d'optimistic update) : en cas d'echec, l'action rejette sans toucher l'etat,
//     l'ecran attrape et affiche. setEntreprise / setSalaries / setBulletins ne
//     recoivent jamais que des objets venus de la base, pour que l'etat memoire reste
//     un reflet fidele du stockage.
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
// La couche MENSUELLE (couche 4) est ici sous forme d'HISTORIQUE PERSISTE : bulletins
// est la liste des bulletins deja enregistres du salarie ACTIF (lecture seule du point
// de vue des ecrans, source de verite unique de l'historique courant). En revanche le
// bulletin EN COURS DE SAISIE (le mois qu'on edite, pas encore enregistre) reste local
// a BulletinPage : le contexte ne porte que ce qui est durci en base.

// Statut du cycle de LECTURE de l'entreprise. Le cas "pas encore d'entreprise" n'est
// PAS un statut a part : il se DEDUIT de (statutEntreprise === "pret" && entreprise
// === null).
export type StatutEntreprise = "chargement" | "pret" | "erreur";

// Statut du cycle de LECTURE des salaries. Meme tryptique que l'entreprise. Le cas
// "aucun salarie" n'est PAS un statut a part : il se DEDUIT de (statutSalaries ===
// "pret" && salaries.length === 0).
export type StatutSalaries = "chargement" | "pret" | "erreur";

// Statut du cycle de LECTURE de l'historique du salarie actif. Meme tryptique. Le cas
// "aucun bulletin" n'est PAS un statut a part : il se DEDUIT de (statutBulletins ===
// "pret" && bulletins.length === 0). Le cas "aucun salarie selectionne" est aussi
// "pret" avec bulletins vide : il n'y a rien a charger.
export type StatutBulletins = "chargement" | "pret" | "erreur";

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
  // Etat du cycle de lecture des salaries depuis le stockage (cascade apres
  // l'entreprise).
  statutSalaries: StatutSalaries;
  // Message d'erreur de LECTURE des salaries (non null seulement quand statutSalaries
  // vaut "erreur"). Les erreurs d'ECRITURE remontent par le rejet de ajouterSalarie /
  // modifierSalarie, gerees localement par l'ecran appelant.
  erreurSalaries: string | null;

  // Persiste un NOUVEAU salarie via le store PUIS l'ajoute a la liste (objet re-mappe
  // par la base) ET le rend actif. Rejette si l'ecriture echoue, sans toucher l'etat.
  // Async par nature.
  ajouterSalarie: (salarie: Salarie) => Promise<void>;
  // Change le salarie actif par id.
  selectionnerSalarie: (id: string) => void;
  // Persiste la MISE A JOUR d'un salarie existant via le store (branche UPDATE de
  // l'upsert) PUIS remplace dans la liste celui de meme id (objet re-mappe), sans
  // toucher a la selection. Rejette si l'ecriture echoue, sans toucher l'etat. Async.
  modifierSalarie: (salarie: Salarie) => Promise<void>;

  // Couche 4 : HISTORIQUE persiste du salarie ACTIF (vide si aucun salarie selectionne),
  // ordonne par periode croissante. Unique source de verite de l'historique courant :
  // pas de copie ni de cache par salarie a resynchroniser, il se recharge a chaque
  // changement de salarie actif.
  bulletins: BulletinMensuel[];
  // Etat du cycle de lecture de l'historique (cascade apres le salarie actif).
  statutBulletins: StatutBulletins;
  // Message d'erreur de LECTURE des bulletins (non null seulement quand statutBulletins
  // vaut "erreur"). L'erreur d'ECRITURE remonte par le rejet de sauvegarderBulletin,
  // geree localement par l'ecran appelant.
  erreurBulletins: string | null;
  // Persiste un bulletin (creation ou mise a jour, cle naturelle salarieId + periode)
  // via le store PUIS upsert en memoire dans bulletins (remplace la ligne de meme
  // periode si elle existe, sinon ajoute), re-trie par periode. Rejette si l'ecriture
  // echoue, sans toucher l'etat. Async par nature.
  sauvegarderBulletin: (bulletin: BulletinMensuel) => Promise<void>;
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
  // Statut de la lecture des salaries (cascade apres l'entreprise). Initial
  // "chargement" : au montage l'entreprise n'est pas encore resolue.
  const [statutSalaries, setStatutSalaries] =
    useState<StatutSalaries>("chargement");
  const [erreurSalaries, setErreurSalaries] = useState<string | null>(null);

  // Source de verite de la couche 4 : l'historique du salarie ACTIF. Recharge a chaque
  // changement de salarie actif (cascade apres la selection). Initial "chargement" :
  // au montage le salarie actif n'est pas encore resolu.
  const [bulletins, setBulletins] = useState<BulletinMensuel[]>([]);
  const [statutBulletins, setStatutBulletins] =
    useState<StatutBulletins>("chargement");
  const [erreurBulletins, setErreurBulletins] = useState<string | null>(null);

  // LECTURE de l'entreprise au changement de session. Depend de user?.id (pas de
  // l'objet user, qui change a chaque refresh de token pour le meme compte) et de
  // authLoading (on attend que le JWT soit attache, sinon la requete partirait en
  // anonyme et la RLS renverrait 0 ligne a tort).
  useEffect(() => {
    // Session pas encore restauree : on attend, on reste en "chargement".
    if (authLoading) {
      return;
    }

    // Deconnecte : on VIDE l'entreprise (isolation par compte : l'entreprise du compte
    // precedent ne doit pas rester en memoire). Rien a charger : statut "pret",
    // entreprise null. On ne touche PAS ici a salaries / selection : l'effet de
    // cascade (seul proprietaire de la couche 3) les videra en reaction a
    // entreprise === null.
    if (!user) {
      setEntreprise(null);
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

  // LECTURE EN CASCADE des salaries, APRES l'entreprise. Depend de l'etat de lecture
  // de l'entreprise et de son id : on ne charge les salaries que lorsque l'entreprise
  // est PRETE et connue (gate sur statutEntreprise === "pret", pas sur entreprise?.id
  // seul, sinon un changement de compte fetcherait brievement les salaries de l'ancien
  // entreprise sous le nouveau JWT). Cet effet est le SEUL proprietaire de l'etat
  // salaries / selection : c'est lui qui vide a la deconnexion (entreprise === null).
  useEffect(() => {
    // Entreprise pas encore resolue : on attend, on reste en "chargement".
    if (statutEntreprise === "chargement") {
      setStatutSalaries("chargement");
      return;
    }

    // Lecture entreprise en echec : on ne tente pas les salaries (l'erreur entreprise
    // est deja affichee). Etat salarie neutre et vide.
    if (statutEntreprise === "erreur") {
      setSalaries([]);
      setSalarieSelectionneId(null);
      setErreurSalaries(null);
      setStatutSalaries("pret");
      return;
    }

    // statutEntreprise === "pret". Pas d'entreprise (compte sans entreprise, ou
    // deconnecte) : rien a charger, on VIDE la couche 3 (isolation par compte).
    if (!entreprise) {
      setSalaries([]);
      setSalarieSelectionneId(null);
      setErreurSalaries(null);
      setStatutSalaries("pret");
      return;
    }

    // Entreprise connue : on (re)charge ses salaries. annule protege contre une
    // resolution tardive apres demontage ou changement d'entreprise.
    let annule = false;
    setStatutSalaries("chargement");
    setErreurSalaries(null);
    chargerSalaries(entreprise.id)
      .then((liste) => {
        if (annule) return;
        setSalaries(liste);
        // AUTO-SELECTION CONDITIONNELLE (jamais inconditionnelle) : on ne reselectionne
        // le premier QUE si la selection courante est absente ou ne correspond plus a
        // aucun salarie de la liste fraichement chargee. Sinon on laisse la selection
        // de l'utilisateur intacte. On stocke toujours l'id, jamais une copie.
        setSalarieSelectionneId((prev) =>
          prev && liste.some((s) => s.id === prev)
            ? prev
            : liste.length > 0
              ? liste[0].id
              : null,
        );
        setStatutSalaries("pret");
      })
      .catch((err) => {
        if (annule) return;
        setStatutSalaries("erreur");
        setErreurSalaries(
          err instanceof Error
            ? err.message
            : "Lecture des salaries impossible.",
        );
      });

    return () => {
      annule = true;
    };
  }, [statutEntreprise, entreprise?.id]);

  // LECTURE EN CASCADE de l'historique (couche 4), APRES la selection du salarie. Suit
  // le salarie ACTIF quelle que soit la facon dont il l'est devenu (auto-selection de
  // liste[0] OU clic utilisateur) : on ne distingue PAS les deux, donc pas d'etat
  // "selection manuelle ou auto" en plus. Quand un salarie est actif, son historique se
  // charge ; quand salarieSelectionneId est null, il n'y a RIEN a charger (bulletins
  // vide, statut "pret"). annule protege contre une resolution tardive : au changement
  // rapide de salarie, une reponse en retard ne doit pas ecraser l'historique du salarie
  // courant.
  useEffect(() => {
    // Aucun salarie actif (liste vide, deconnecte, ou pas encore selectionne) : rien a
    // charger, historique vide, statut "pret".
    if (!salarieSelectionneId) {
      setBulletins([]);
      setErreurBulletins(null);
      setStatutBulletins("pret");
      return;
    }

    let annule = false;
    setStatutBulletins("chargement");
    setErreurBulletins(null);
    chargerBulletins(salarieSelectionneId)
      .then((liste) => {
        if (annule) return;
        setBulletins(liste);
        setStatutBulletins("pret");
      })
      .catch((err) => {
        if (annule) return;
        setStatutBulletins("erreur");
        setErreurBulletins(
          err instanceof Error
            ? err.message
            : "Lecture des bulletins impossible.",
        );
      });

    return () => {
      annule = true;
    };
  }, [salarieSelectionneId]);

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

  // Persiste d'ABORD via le store, puis ecrit en memoire l'objet RE-MAPPE par la base
  // (pas d'optimistic update). Upsert en memoire : si l'id existe deja on remplace,
  // sinon on ajoute en fin (ordre d'insertion = ordre created_at de la base). Le
  // salarie ajoute devient l'actif (selection sur l'id canonique retourne). En cas
  // d'echec, enregistrerSalarie rejette : on ne touche pas l'etat, l'appelant attrape.
  const ajouterSalarie = useCallback(async (salarie: Salarie) => {
    const persiste = await enregistrerSalarie(salarie);
    setSalaries((prev) =>
      prev.some((s) => s.id === persiste.id)
        ? prev.map((s) => (s.id === persiste.id ? persiste : s))
        : [...prev, persiste],
    );
    setSalarieSelectionneId(persiste.id);
  }, []);

  const selectionnerSalarie = useCallback((id: string) => {
    setSalarieSelectionneId(id);
  }, []);

  // Persiste la mise a jour (branche UPDATE de l'upsert) puis remplace en place l'objet
  // de meme id par le re-mappe de la base, SANS toucher a la selection. En cas
  // d'echec, rejette sans toucher l'etat memoire.
  const modifierSalarie = useCallback(async (salarie: Salarie) => {
    const persiste = await enregistrerSalarie(salarie);
    setSalaries((prev) =>
      prev.map((s) => (s.id === persiste.id ? persiste : s)),
    );
  }, []);

  // Persiste d'ABORD via le store, puis upsert en memoire l'objet RE-MAPPE par la base
  // (pas d'optimistic update). Upsert par cle naturelle (salarieId + periode) : si un
  // bulletin de meme periode existe deja on le remplace, sinon on ajoute ; puis on
  // re-trie par periode pour garder l'historique chronologique (meme ordre que la
  // lecture). bulletins reste l'unique source de verite de l'historique actif : pas de
  // cache par salarie a resynchroniser. En cas d'echec, enregistrerBulletin rejette : on
  // ne touche pas l'etat, l'appelant attrape.
  const sauvegarderBulletin = useCallback(async (bulletin: BulletinMensuel) => {
    const persiste = await enregistrerBulletin(bulletin);
    setBulletins((prev) => {
      const fusion = prev.some((b) => b.periode === persiste.periode)
        ? prev.map((b) => (b.periode === persiste.periode ? persiste : b))
        : [...prev, persiste];
      return fusion
        .slice()
        .sort((a, b) => a.periode.localeCompare(b.periode));
    });
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
      statutSalaries,
      erreurSalaries,
      ajouterSalarie,
      selectionnerSalarie,
      modifierSalarie,
      bulletins,
      statutBulletins,
      erreurBulletins,
      sauvegarderBulletin,
    }),
    [
      entreprise,
      statutEntreprise,
      erreurEntreprise,
      sauvegarderEntreprise,
      salaries,
      salarieSelectionneId,
      salarieSelectionne,
      statutSalaries,
      erreurSalaries,
      ajouterSalarie,
      selectionnerSalarie,
      modifierSalarie,
      bulletins,
      statutBulletins,
      erreurBulletins,
      sauvegarderBulletin,
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
