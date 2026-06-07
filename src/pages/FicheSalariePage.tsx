import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { Salarie } from "../model/types";
import { useSaisie } from "../context/SaisieContext";
import { SalarieForm } from "../components/SalarieForm";
import { HistoriqueBulletins } from "../components/HistoriqueBulletins";

// FICHE d'un salarie : route /salarie/:id. Reunit en un seul ecran les donnees
// STABLES editables du salarie (couche 3, via SalarieForm en mode edition) et
// l'HISTORIQUE de ses bulletins (couche 4, via HistoriqueBulletins), plus un bouton
// vers le bulletin du mois (BulletinPage). C'est le SEUL chemin d'edition du salarie :
// SaisiePage ne fait plus qu'entreprise + liste cliquable vers cette fiche.
//
// SELECTION : il n'existe qu'UNE source de selection, salarieSelectionneId dans le
// contexte. L'URL la PILOTE : un effet aligne salarieSelectionneId sur l'id de l'URL
// (selectionnerSalarie), pour que la cascade d'historique du contexte charge le bon
// salarie. On ne cree AUCUN deuxieme etat de selection. Pour l'AFFICHAGE en revanche,
// la fiche resout son salarie DIRECTEMENT par l'id de l'URL (salaries.find), pour ne
// pas dependre d'un rendu de retard sur salarieSelectionne.
//
// INTROUVABLE : on ne conclut "salarie introuvable" qu'une fois statutSalaries ===
// "pret" (et find null). Tant que la cascade charge (entreprise puis salaries), on
// affiche "Chargement..." : sinon un rechargement direct de /salarie/:id afficherait
// "introuvable" a tort pendant la fenetre de chargement (faux negatif). Un id d'un
// autre compte n'est jamais dans salaries (RLS) : il retombe sur "introuvable".

export function FicheSalariePage() {
  const { id } = useParams<{ id: string }>();
  const {
    statutEntreprise,
    salaries,
    statutSalaries,
    erreurSalaries,
    salarieSelectionneId,
    selectionnerSalarie,
    modifierSalarie,
    bulletins,
    statutBulletins,
    erreurBulletins,
  } = useSaisie();

  // Etat local de l'ECRITURE (modification du salarie), distinct de la lecture.
  const [enregistrementEnCours, setEnregistrementEnCours] = useState(false);
  const [erreurEnregistrement, setErreurEnregistrement] = useState<
    string | null
  >(null);
  const [messageSucces, setMessageSucces] = useState<string | null>(null);

  // SYNCHRONISATION URL -> selection du contexte. On aligne salarieSelectionneId sur
  // l'id de l'URL UNIQUEMENT quand ce salarie existe dans la liste chargee (sinon on
  // ne pollue pas la selection avec un id fantome). Deps [id, salaries] : au
  // rechargement direct, la liste arrive APRES le premier rendu, il faut redeclencher
  // une fois salaries charge. Le garde id !== salarieSelectionneId evite un set
  // redondant (et le double chargement d'historique quand l'id d'URL est deja l'actif).
  useEffect(() => {
    if (!id) return;
    if (id === salarieSelectionneId) return;
    if (salaries.some((s) => s.id === id)) {
      selectionnerSalarie(id);
    }
  }, [id, salaries, salarieSelectionneId, selectionnerSalarie]);

  // Resolution du salarie AFFICHE : directement par l'id de l'URL.
  const salarie = salaries.find((s) => s.id === id) ?? null;

  // Orchestration de la MODIFICATION (branche UPDATE de l'upsert via le contexte). Au
  // SUCCES on affiche un message ; en cas d'echec on garde le formulaire rempli (le
  // contexte ne touche pas l'etat sur rejet) et on affiche l'erreur.
  async function enregistrerModification(s: Salarie) {
    setEnregistrementEnCours(true);
    setErreurEnregistrement(null);
    setMessageSucces(null);
    try {
      await modifierSalarie(s);
      setMessageSucces("Salarie mis a jour");
    } catch (err) {
      setErreurEnregistrement(
        err instanceof Error
          ? err.message
          : "Modification du salarie impossible.",
      );
    } finally {
      setEnregistrementEnCours(false);
    }
  }

  // Salarie resolu : on affiche la fiche.
  if (salarie) {
    return (
      <main className="bulletin-page">
        <header className="bulletin-header">
          <h1>
            {salarie.prenom} {salarie.nom}
          </h1>
          <Link to="/saisie">Retour a la saisie</Link>
        </header>

        <section className="bulletin-section">
          <h2>Donnees du salarie</h2>
          {/* Edition des donnees stables : on REUTILISE SalarieForm en mode edition.
              entrepriseId vient du salarie lui-meme (reference de couche deja posee),
              jamais ressaisi. onSave passe par modifierSalarie (branche UPDATE). */}
          <SalarieForm
            entrepriseId={salarie.entrepriseId}
            salarie={salarie}
            onSave={(s) => void enregistrerModification(s)}
          />
          {enregistrementEnCours ? (
            <p className="recherche-statut">Enregistrement en cours...</p>
          ) : null}
          {erreurEnregistrement ? (
            <p className="bulletin-erreur" role="alert">
              {erreurEnregistrement}
            </p>
          ) : messageSucces ? (
            <p className="bulletin-succes">{messageSucces}</p>
          ) : null}
        </section>

        <HistoriqueBulletins
          statut={statutBulletins}
          erreur={erreurBulletins}
          bulletins={bulletins}
        />

        <section className="bulletin-section">
          <h2>Bulletin du mois</h2>
          {/* Le lien transporte l'id du salarie : BulletinPage lit son salarie
              depuis sa propre URL (/bulletin/:id), comme la fiche. Plus aucune
              dependance implicite a un alignement prealable de la selection. */}
          <p>
            <Link to={`/bulletin/${salarie.id}`}>Editer le bulletin du mois</Link>
          </p>
        </section>
      </main>
    );
  }

  // Pas encore resolu : la cascade charge (entreprise puis salaries). On n'affiche pas
  // "introuvable" tant que ce n'est pas "pret" (faux negatif au rechargement direct).
  if (statutEntreprise === "chargement" || statutSalaries === "chargement") {
    return (
      <main className="bulletin-page">
        <header className="bulletin-header">
          <h1>Fiche salarie</h1>
          <Link to="/saisie">Retour a la saisie</Link>
        </header>
        <section className="bulletin-section">
          <p>Chargement des donnees...</p>
        </section>
      </main>
    );
  }

  // Lecture des salaries en echec : on affiche l'erreur plutot que "introuvable".
  if (statutSalaries === "erreur") {
    return (
      <main className="bulletin-page">
        <header className="bulletin-header">
          <h1>Fiche salarie</h1>
          <Link to="/saisie">Retour a la saisie</Link>
        </header>
        <section className="bulletin-section">
          <p className="bulletin-erreur" role="alert">
            {erreurSalaries}
          </p>
        </section>
      </main>
    );
  }

  // statutSalaries === "pret" et find null : le salarie n'existe pas (id trafique,
  // supprime, ou d'un autre compte ecarte par la RLS).
  return (
    <main className="bulletin-page">
      <header className="bulletin-header">
        <h1>Fiche salarie</h1>
        <Link to="/saisie">Retour a la saisie</Link>
      </header>
      <section className="bulletin-section">
        <p>Salarie introuvable.</p>
        <p>
          <Link to="/saisie">Revenir a la liste des salaries</Link>
        </p>
      </section>
    </main>
  );
}
