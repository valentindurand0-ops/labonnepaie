import { useState } from "react";
import { Link } from "react-router-dom";
import type { Entreprise, Salarie } from "../model/types";
import { EntrepriseForm } from "../components/EntrepriseForm";
import { SalarieForm } from "../components/SalarieForm";
import { useSaisie } from "../context/SaisieContext";
import { formaterMontant } from "../utils/formatage";

// Page de SAISIE : onglets entreprise (couche 2) et salaries (couche 3), poses sur
// le modele a 4 couches (src/model/types.ts).
//
// L'etat des couches (entreprise, liste de salaries) vit dans le SaisieContext
// (partage, persiste). Cette page ne DETIENT pas cet etat : elle le LIT et l'ECRIT
// via useSaisie. Seuls l'onglet actif et un compteur de remontage du formulaire
// restent des etats locaux (pur UI, propres a cette page).
//
// REDUITE A "ENTREPRISE + LISTE" (etape 5a) : la page LISTE les salaries et permet
// d'en AJOUTER, mais l'EDITION d'un salarie existant et l'historique vivent desormais
// sur la FICHE (/salarie/:id). Chaque salarie de la liste est un LIEN vers sa fiche.
// Il n'y a plus qu'un seul chemin d'edition du salarie, donc plus de risque de desync.
// Cette page n'importe PLUS le moteur : la preuve d'assemblage est faite par
// BulletinPage et par le test unitaire de l'assembleur.
//
// FRONTIERE : les onglets produisent des objets de couches (Entreprise, Salarie).
// DEPENDANCE DE COUCHE : l'entreprise est l'objet racine ; le salarie la reference
// par id. L'onglet salarie est donc verrouille tant qu'aucune entreprise n'existe.

type Onglet = "entreprise" | "salarie";

export function SaisiePage() {
  // Etat des couches : detenu par le SaisieContext (partage), pas par cette page.
  const {
    entreprise,
    statutEntreprise,
    erreurEntreprise,
    sauvegarderEntreprise,
    salaries,
    statutSalaries,
    erreurSalaries,
    ajouterSalarie,
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
  // Etat local de l'ECRITURE d'un salarie (ajout), distinct de la lecture
  // (statutSalaries / erreurSalaries viennent du contexte).
  const [enregistrementSalarieEnCours, setEnregistrementSalarieEnCours] =
    useState(false);
  const [erreurSalarie, setErreurSalarie] = useState<string | null>(null);

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

  // Orchestration de l'AJOUT d'un salarie : on persiste via le contexte (qui re-mappe
  // et pose l'objet venu de la base), on ne remonte le formulaire a vide qu'au SUCCES,
  // et on affiche l'erreur sans perdre la saisie en cas d'echec.
  async function enregistrerNouveauSalarie(s: Salarie) {
    setEnregistrementSalarieEnCours(true);
    setErreurSalarie(null);
    try {
      await ajouterSalarie(s);
      setCompteurFormSalarie((n) => n + 1);
    } catch (err) {
      setErreurSalarie(
        err instanceof Error
          ? err.message
          : "Enregistrement du salarie impossible.",
      );
    } finally {
      setEnregistrementSalarieEnCours(false);
    }
  }

  // L'onglet salarie n'existe pas sans entreprise (dependance de couche).
  const salarieAccessible = entreprise !== null;

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
            statutSalaries === "chargement" ? (
              // Pendant la lecture des salaries depuis le stockage, on n'affiche ni
              // liste ni formulaire (sinon "Aucun salarie" clignoterait a tort).
              <p>Chargement des salaries...</p>
            ) : (
              <>
                {/* Erreur de LECTURE des salaries : affichee, sans bloquer la suite. */}
                {statutSalaries === "erreur" && erreurSalaries ? (
                  <p className="bulletin-erreur" role="alert">
                    {erreurSalaries}
                  </p>
                ) : null}

                {/* Liste des salaries : chacun est un LIEN vers sa fiche
                    (/salarie/:id), ou se font l'edition et l'historique. Vide au
                    depart. */}
                {salaries.length === 0 ? (
                  <p>Aucun salarie pour l'instant. Ajoutez-en un ci-dessous.</p>
                ) : (
                  <ul className="salarie-liste">
                    {salaries.map((s) => (
                      <li key={s.id}>
                        <Link to={`/salarie/${s.id}`}>
                          {s.prenom} {s.nom} -{" "}
                          {s.statut === "cadre" ? "Cadre" : "ETAM"} -{" "}
                          {formaterMontant(s.salaireBaseMensuel)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Ajout d'un salarie : formulaire vierge, la key (compteur) le
                    remonte apres chaque ajout reussi ; onSave passe par ajouterSalarie. */}
                <h3>Ajouter un salarie</h3>
                <SalarieForm
                  key={compteurFormSalarie}
                  entrepriseId={entreprise.id}
                  salarie={null}
                  onSave={(s) => void enregistrerNouveauSalarie(s)}
                />

                {/* Etats de l'ECRITURE d'un salarie (distincts de la lecture). */}
                {enregistrementSalarieEnCours ? (
                  <p className="recherche-statut">Enregistrement en cours...</p>
                ) : null}
                {erreurSalarie ? (
                  <p className="bulletin-erreur" role="alert">
                    {erreurSalarie}
                  </p>
                ) : null}
              </>
            )
          ) : (
            <p>Creez d'abord une entreprise dans l'onglet precedent.</p>
          )}
        </section>
      ) : null}
    </main>
  );
}
