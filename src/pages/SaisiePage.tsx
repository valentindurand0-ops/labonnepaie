import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  assemblerEntree,
  type BulletinMensuel,
  type Entreprise,
} from "../model/types";
import {
  calculerBulletin,
  getBareme,
  HEURES_MENSUELLES_LEGALES,
  type BulletinCalcule,
} from "../engine";
import { EntrepriseForm } from "../components/EntrepriseForm";
import { SalarieForm } from "../components/SalarieForm";
import { useSaisie } from "../context/SaisieContext";

// Page de SAISIE : onglets entreprise (couche 2) et salaries (couche 3), poses sur
// le modele a 4 couches (src/model/types.ts).
//
// ETAPE SANS PERSISTANCE : l'etat des couches (entreprise, liste de salaries) vit
// dans le SaisieContext (partage avec BulletinPage), en memoire. Pas de Supabase a
// ce stade. Cette page ne DETIENT pas cet etat : elle le LIT et l'ECRIT via
// useSaisie. Seuls l'onglet actif et un compteur de remontage du formulaire restent
// des etats locaux (pur UI, propres a cette page).
//
// MULTI-SALARIES : une entreprise a plusieurs salaries. L'onglet salarie permet de
// LISTER les salaries crees, d'en SELECTIONNER un (le rendre actif) et d'en AJOUTER.
// Le contexte detient la liste plus l'id du salarie actif ; l'ajout passe par
// ajouterSalarie (qui selectionne aussi le nouveau salarie).
//
// FRONTIERE : les onglets produisent des objets de couches (Entreprise, Salarie).
// L'UI ne fabrique JAMAIS l'entree plate du moteur a la main et n'appelle jamais
// le moteur sans passer par assemblerEntree, seul endroit qui reunit les couches.
//
// DEPENDANCE DE COUCHE : l'entreprise est l'objet racine ; le salarie la reference
// par id. L'onglet salarie est donc verrouille tant qu'aucune entreprise n'existe.

type Onglet = "entreprise" | "salarie";

// Formate un montant en euros (2 decimales, espace separateur de milliers).
// Duplique volontairement le helper de BulletinPage : on ne touche pas a cette
// derniere a cette etape (cf. bascule UI prevue en etape ulterieure). Aucun
// calcul de paie ici.
function formaterMontant(valeur: number): string {
  const fixe = valeur.toFixed(2);
  const [entier, decimales] = fixe.split(".");
  const signe = entier.startsWith("-") ? "-" : "";
  const chiffres = signe ? entier.slice(1) : entier;
  const avecEspaces = chiffres.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${signe}${avecEspaces}.${decimales} €`;
}

export function SaisiePage() {
  // Etat des couches : detenu par le SaisieContext (partage avec BulletinPage),
  // pas par cette page. On le lit et on l'ecrit via le contexte. salarieSelectionne
  // est le DERIVE du contexte (salarie actif retrouve dans la liste).
  const {
    entreprise,
    statutEntreprise,
    erreurEntreprise,
    sauvegarderEntreprise,
    salaries,
    salarieSelectionneId,
    salarieSelectionne,
    ajouterSalarie,
    selectionnerSalarie,
  } = useSaisie();
  // Onglet actif : pur etat d'UI, local a cette page (rien a partager).
  const [ongletActif, setOngletActif] = useState<Onglet>("entreprise");
  // Compteur de remontage du formulaire d'ajout : incremente apres chaque ajout
  // pour repartir d'un formulaire vierge (SalarieForm initialise son etat une seule
  // fois depuis sa prop ; changer sa key le remonte). Pur UI.
  const [compteurFormSalarie, setCompteurFormSalarie] = useState(0);
  // Etat local de l'ECRITURE de l'entreprise (la lecture, elle, vient du contexte).
  // L'erreur d'ecriture est distincte de l'erreur de lecture (erreurEntreprise).
  const [enregistrementEnCours, setEnregistrementEnCours] = useState(false);
  const [erreurEnregistrement, setErreurEnregistrement] = useState<
    string | null
  >(null);

  // Orchestration de l'ecriture : on persiste via le contexte (qui re-mappe et pose
  // l'objet venu de la base), on ne bascule sur l'onglet salarie qu'au SUCCES, et on
  // affiche l'erreur sans perdre la saisie en cas d'echec.
  async function enregistrerEntreprise(e: Entreprise) {
    setEnregistrementEnCours(true);
    setErreurEnregistrement(null);
    try {
      await sauvegarderEntreprise(e);
      setOngletActif("salarie");
    } catch (err) {
      setErreurEnregistrement(
        err instanceof Error
          ? err.message
          : "Enregistrement de l'entreprise impossible.",
      );
    } finally {
      setEnregistrementEnCours(false);
    }
  }

  // L'onglet salarie n'existe pas sans entreprise (dependance de couche).
  const salarieAccessible = entreprise !== null;

  // Bulletin minimal NON EDITABLE a cette etape (pas d'onglet bulletin). Il sert
  // uniquement a prouver l'assemblage bout en bout pour le salarie SELECTIONNE. La
  // duree mensuelle vient du moteur (HEURES_MENSUELLES_LEGALES), pas d'un nombre
  // magique ecrit ici.
  const bulletinMinimal = useMemo<BulletinMensuel | null>(() => {
    if (!salarieSelectionne) return null;
    return {
      salarieId: salarieSelectionne.id,
      periode: "2026-06",
      heures: HEURES_MENSUELLES_LEGALES,
    };
  }, [salarieSelectionne]);

  // Preuve : entreprise + salarie selectionne + bulletin minimal -> assembleur ->
  // moteur. On passe TOUJOURS par assemblerEntree ; on ne fabrique pas l'entree plate.
  const { bulletin, erreur } = useMemo<{
    bulletin: BulletinCalcule | null;
    erreur: string | null;
  }>(() => {
    if (!entreprise || !salarieSelectionne || !bulletinMinimal) {
      return { bulletin: null, erreur: null };
    }
    try {
      const entree = assemblerEntree(
        entreprise,
        salarieSelectionne,
        bulletinMinimal,
      );
      return {
        bulletin: calculerBulletin(entree, getBareme(entree.legal.bareme)),
        erreur: null,
      };
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Erreur d'assemblage inconnue.";
      return { bulletin: null, erreur: message };
    }
  }, [entreprise, salarieSelectionne, bulletinMinimal]);

  return (
    <main className="bulletin-page">
      <header className="bulletin-header">
        <h1>Saisie entreprise et salarie</h1>
        <Link to="/">Retour a l'accueil</Link>
      </header>

      <nav className="saisie-onglets">
        <button
          type="button"
          className={ongletActif === "entreprise" ? "actif" : ""}
          onClick={() => setOngletActif("entreprise")}
        >
          Entreprise{entreprise ? " (enregistree)" : ""}
        </button>
        <button
          type="button"
          className={ongletActif === "salarie" ? "actif" : ""}
          onClick={() => setOngletActif("salarie")}
          disabled={!salarieAccessible}
          title={
            salarieAccessible ? undefined : "Creez d'abord une entreprise."
          }
        >
          Salaries{salaries.length > 0 ? ` (${salaries.length})` : ""}
        </button>
      </nav>

      {ongletActif === "entreprise" ? (
        <section className="bulletin-section">
          <h2>Entreprise</h2>
          {/* Pendant la lecture initiale depuis le stockage, on n'affiche pas le
              formulaire (sinon il clignoterait vide avant d'etre hydrate). */}
          {statutEntreprise === "chargement" ? (
            <p>Chargement de l'entreprise...</p>
          ) : (
            <>
              {/* Erreur de LECTURE : on l'affiche mais on laisse le formulaire
                  accessible (saisie manuelle possible en repli). */}
              {statutEntreprise === "erreur" && erreurEntreprise ? (
                <p className="bulletin-erreur" role="alert">
                  {erreurEntreprise}
                </p>
              ) : null}

              <EntrepriseForm
                entreprise={entreprise}
                onSave={(e) => void enregistrerEntreprise(e)}
              />

              {/* Etats de l'ECRITURE (distincts de la lecture). */}
              {enregistrementEnCours ? (
                <p className="recherche-statut">Enregistrement en cours...</p>
              ) : null}
              {erreurEnregistrement ? (
                <p className="bulletin-erreur" role="alert">
                  {erreurEnregistrement}
                </p>
              ) : null}
            </>
          )}
        </section>
      ) : null}

      {ongletActif === "salarie" ? (
        <section className="bulletin-section">
          <h2>Salaries</h2>
          {entreprise ? (
            <>
              {/* Liste des salaries crees : chacun selectionnable (devient l'actif).
                  L'actif est marque. Vide au depart. */}
              {salaries.length === 0 ? (
                <p>Aucun salarie pour l'instant. Ajoutez-en un ci-dessous.</p>
              ) : (
                <ul className="salarie-liste">
                  {salaries.map((s) => {
                    const actif = s.id === salarieSelectionneId;
                    return (
                      <li key={s.id}>
                        <button
                          type="button"
                          className={actif ? "actif" : ""}
                          aria-pressed={actif}
                          onClick={() => selectionnerSalarie(s.id)}
                        >
                          {s.prenom} {s.nom} -{" "}
                          {s.statut === "cadre" ? "Cadre" : "ETAM"} -{" "}
                          {formaterMontant(s.salaireBaseMensuel)}
                          {actif ? " (selectionne)" : ""}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              {/* Ajout d'un NOUVEAU salarie. salarie={null} -> formulaire vierge ;
                  la key le remonte apres chaque ajout pour repartir a vide. onSave
                  passe par ajouterSalarie (qui selectionne aussi le nouveau). */}
              <h3>Ajouter un salarie</h3>
              <SalarieForm
                key={compteurFormSalarie}
                entrepriseId={entreprise.id}
                salarie={null}
                onSave={(s) => {
                  ajouterSalarie(s);
                  setCompteurFormSalarie((n) => n + 1);
                }}
              />
            </>
          ) : (
            <p>Creez d'abord une entreprise dans l'onglet precedent.</p>
          )}
        </section>
      ) : null}

      <section className="bulletin-section">
        <h2>Verification de l'assemblage</h2>
        {!entreprise || !salarieSelectionne ? (
          <p>
            Renseignez l'entreprise puis selectionnez un salarie pour assembler un
            bulletin de controle.
          </p>
        ) : erreur ? (
          <p className="bulletin-erreur" role="alert">
            {erreur}
          </p>
        ) : bulletin ? (
          <table className="bulletin-table bulletin-totaux">
            <tbody>
              <tr>
                <td>Brut total soumis</td>
                <td className="num">{formaterMontant(bulletin.brutTotal)}</td>
              </tr>
              <tr>
                <td>Net social</td>
                <td className="num">{formaterMontant(bulletin.netSocial)}</td>
              </tr>
              <tr>
                <td>Total cotisations patronales</td>
                <td className="num">
                  {formaterMontant(bulletin.totalCotisationsPatronales)}
                </td>
              </tr>
              <tr>
                <td>Cout total employeur</td>
                <td className="num">
                  {formaterMontant(bulletin.coutTotalEmployeur)}
                </td>
              </tr>
            </tbody>
          </table>
        ) : null}
      </section>
    </main>
  );
}
