import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  calculerBulletin,
  getBareme,
  HEURES_MENSUELLES_LEGALES,
  type BulletinCalcule,
  type LigneCotisation,
} from "../engine";
import { assemblerEntree, type BulletinMensuel } from "../model/types";
import { useSaisie } from "../context/SaisieContext";
import { HistoriqueBulletins } from "../components/HistoriqueBulletins";
import { formaterMontant } from "../utils/formatage";

// Page d'AFFICHAGE du bulletin.
//
// SOURCE DES DONNEES : l'entreprise (couche 2) et le salarie SELECTIONNE (couche 3)
// viennent du SaisieContext, donc de ce qui a ete REELLEMENT saisi dans /saisie. Le
// salarie affiche est le salarie ACTIF (salarieSelectionne) ; on ne change PLUS de
// salarie ici (le selecteur a disparu en etape 5a). Le seul chemin de selection est
// la FICHE (/salarie/:id), qui aligne salarieSelectionneId sur l'id de l'URL avant de
// renvoyer vers cette page. Plus aucune donnee en dur (l'ancien cadre 4000 a disparu).
// La couche MENSUELLE (couche 4 : periode, heures, prime, conges) est saisie ICI, en
// etat local : c'est la donnee qui change chaque mois, elle n'a pas sa place dans le
// contexte partage.
//
// FRONTIERE : la page ne fabrique JAMAIS l'entree plate du moteur. Elle passe
// TOUJOURS par assemblerEntree (seul endroit qui reunit les 4 couches) puis
// calculerBulletin. Le bareme applique est celui resolu par l'assembleur
// (entree.legal.bareme), pas un identifiant code en dur dans la page.

// Affiche un taux en pourcentage avec 2 decimales. Ex : 6.9 -> "6.90 %".
function formaterTaux(taux: number): string {
  return `${taux.toFixed(2)} %`;
}

// Tableau d'un ensemble de lignes de cotisation.
function TableLignes({
  titre,
  lignes,
}: {
  titre: string;
  lignes: LigneCotisation[];
}) {
  return (
    <section className="bulletin-section">
      <h2>{titre}</h2>
      <table className="bulletin-table">
        <thead>
          <tr>
            <th>Libelle</th>
            <th className="num">Base</th>
            <th className="num">Taux</th>
            <th className="num">Montant</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((l, i) => (
            <tr key={`${l.libelle}-${i}`}>
              <td>{l.libelle}</td>
              <td className="num">{formaterMontant(l.base)}</td>
              <td className="num">{formaterTaux(l.taux)}</td>
              <td className="num">{formaterMontant(l.montant)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function BulletinPage() {
  // Couches 2 et 3 : lues dans le contexte partage (saisies dans /saisie). Le
  // salarie affiche est le salarie SELECTIONNE (derive du contexte). On ne lit plus
  // la liste ni de quoi changer la selection : le selecteur a disparu (etape 5a), la
  // selection se fait sur la fiche.
  const {
    entreprise,
    statutEntreprise,
    statutSalaries,
    salarieSelectionne,
    bulletins,
    statutBulletins,
    erreurBulletins,
    sauvegarderBulletin,
  } = useSaisie();
  const salarie = salarieSelectionne;

  // Couche 4 (mensuel) : etat LOCAL a cette page. Les champs numeriques sont
  // stockes en chaine pour gerer proprement la saisie (vide, partielle) avant
  // parsing. La duree mensuelle par defaut vient du moteur, pas d'un nombre magique.
  const [periode, setPeriode] = useState("2026-06");
  const [heures, setHeures] = useState(String(HEURES_MENSUELLES_LEGALES));
  const [primeSoumise, setPrimeSoumise] = useState("0");
  const [joursConges, setJoursConges] = useState("0");

  // Etat LOCAL de l'enregistrement du mois saisi (meme patron que la sauvegarde
  // entreprise dans SaisiePage). erreurEnregistrement porte l'echec d'ECRITURE
  // (distinct de erreur, qui porte l'invalidite de la couche 4). messageSucces est
  // honnete sur l'ecrasement par cle naturelle (cf. handleEnregistrer) : "Mois
  // enregistre" pour une creation, "Mois mis a jour" pour un remplacement.
  const [enregistrementEnCours, setEnregistrementEnCours] = useState(false);
  const [erreurEnregistrement, setErreurEnregistrement] = useState<string | null>(
    null,
  );
  const [messageSucces, setMessageSucces] = useState<string | null>(null);

  // Recalcul reactif. Si l'entreprise ou le salarie manque, on ne calcule rien
  // (l'ecran invite a completer la saisie). Sinon on valide la couche 4 puis on
  // passe par assemblerEntree -> calculerBulletin. Aucune logique de paie ici :
  // seulement la validation de la saisie mensuelle.
  const { bulletin, erreur, baremeReference, bulletinMensuel } = useMemo<{
    bulletin: BulletinCalcule | null;
    erreur: string | null;
    baremeReference: string | null;
    // Objet d'ENTREES de la couche 4 deja valide. Non null exactement quand le calcul
    // a reussi (bulletin non null). Le handler de sauvegarde le persiste TEL QUEL :
    // c'est un objet d'entrees (jamais de sorties), aucune seconde validation.
    bulletinMensuel: BulletinMensuel | null;
  }>(() => {
    if (!entreprise || !salarie) {
      return {
        bulletin: null,
        erreur: null,
        baremeReference: null,
        bulletinMensuel: null,
      };
    }
    try {
      const heuresNum = Number(heures);
      const primeNum = Number(primeSoumise);
      const joursCongesNum = Number(joursConges);

      if (periode.trim() === "") {
        throw new Error("La periode de paie est obligatoire.");
      }
      if (heures.trim() === "" || !Number.isFinite(heuresNum) || heuresNum <= 0) {
        throw new Error("Le nombre d'heures doit etre un nombre strictement positif.");
      }
      if (primeSoumise.trim() === "" || !Number.isFinite(primeNum) || primeNum < 0) {
        throw new Error("La prime soumise doit etre un nombre positif ou nul.");
      }
      if (
        joursConges.trim() === "" ||
        !Number.isFinite(joursCongesNum) ||
        joursCongesNum < 0
      ) {
        throw new Error("Les jours de conges doivent etre un nombre positif ou nul.");
      }

      // Couche 4 assemblee a partir du salarie courant (reference par id). On ne
      // fabrique pas l'entree plate : c'est assemblerEntree qui reunit les couches.
      const bulletinMensuel: BulletinMensuel = {
        salarieId: salarie.id,
        periode,
        heures: heuresNum,
        primeSoumise: primeNum,
        joursConges: joursCongesNum,
      };

      const entree = assemblerEntree(entreprise, salarie, bulletinMensuel);
      const bareme = getBareme(entree.legal.bareme);
      return {
        bulletin: calculerBulletin(entree, bareme),
        erreur: null,
        baremeReference: entree.legal.bareme,
        bulletinMensuel,
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erreur de calcul inconnue.";
      return {
        bulletin: null,
        erreur: message,
        baremeReference: null,
        bulletinMensuel: null,
      };
    }
  }, [entreprise, salarie, periode, heures, primeSoumise, joursConges]);

  // Tout changement de la saisie (couche 4) ou de salarie efface les messages
  // d'enregistrement : un "Mois enregistre" ne doit pas trainer alors que la saisie a
  // change depuis. Les messages ne refletent donc TOUJOURS que le dernier etat sauve.
  useEffect(() => {
    setMessageSucces(null);
    setErreurEnregistrement(null);
  }, [periode, heures, primeSoumise, joursConges, salarie?.id]);

  // Enregistre le mois saisi. bulletinMensuel est l'objet d'ENTREES deja valide par le
  // useMemo : on le persiste tel quel, pas de seconde validation. AVANT l'appel, on
  // teste si la periode existe deja dans l'historique pour un message HONNETE : la cle
  // naturelle (salarieId, periode) fait que sauvegarderBulletin ECRASE la ligne de meme
  // periode au lieu de creer un doublon. En cas d'echec d'ecriture, la saisie n'est pas
  // perdue (le contexte ne touche pas l'etat sur rejet) et l'erreur s'affiche.
  const handleEnregistrer = async () => {
    if (!bulletinMensuel) {
      return;
    }
    const periodeDejaPresente = bulletins.some(
      (b) => b.periode === bulletinMensuel.periode,
    );
    setEnregistrementEnCours(true);
    setErreurEnregistrement(null);
    setMessageSucces(null);
    try {
      await sauvegarderBulletin(bulletinMensuel);
      setMessageSucces(periodeDejaPresente ? "Mois mis a jour" : "Mois enregistre");
    } catch (e) {
      setErreurEnregistrement(
        e instanceof Error ? e.message : "Enregistrement du mois impossible.",
      );
    } finally {
      setEnregistrementEnCours(false);
    }
  };

  // Pendant la lecture initiale de l'entreprise depuis le stockage, on n'affiche ni
  // bulletin ni invite "completez la saisie" : on ne sait pas encore s'il y a une
  // entreprise. On distingue donc le CHARGEMENT du cas "vraiment pas d'entreprise".
  // Meme garde pour la cascade des salaries : sans elle, un rechargement de session
  // avec des salaries en base afficherait "completez la saisie" pendant la fenetre de
  // chargement alors que des salaries existent (faux negatif).
  if (statutEntreprise === "chargement" || statutSalaries === "chargement") {
    return (
      <main className="bulletin-page">
        <header className="bulletin-header">
          <h1>Bulletin de paie</h1>
          <Link to="/">Retour a l'accueil</Link>
        </header>
        <section className="bulletin-section">
          <p>Chargement des donnees...</p>
        </section>
      </main>
    );
  }

  // Garde-fou : sans entreprise ET salarie saisis, pas de bulletin par defaut. On
  // invite a completer la saisie, sans planter.
  if (!entreprise || !salarie) {
    return (
      <main className="bulletin-page">
        <header className="bulletin-header">
          <h1>Bulletin de paie</h1>
          <Link to="/">Retour a l'accueil</Link>
        </header>
        <section className="bulletin-section">
          <p>
            Aucun bulletin a afficher : completez d'abord la saisie de
            l'entreprise et selectionnez un salarie.
          </p>
          <p>
            <Link to="/saisie">Saisir une entreprise et un salarie</Link>
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="bulletin-page">
      <header className="bulletin-header">
        <h1>Bulletin de paie</h1>
        <Link to="/">Retour a l'accueil</Link>
      </header>

      <section className="bulletin-section">
        <h2>Entreprise et salarie</h2>
        <table className="bulletin-table">
          <tbody>
            <tr>
              <td>Entreprise</td>
              <td>{entreprise.raisonSociale}</td>
            </tr>
            <tr>
              <td>Effectif</td>
              <td className="num">{entreprise.effectif}</td>
            </tr>
            <tr>
              <td>Taux AT/MP</td>
              <td className="num">{formaterTaux(entreprise.tauxAtMp)}</td>
            </tr>
            <tr>
              <td>Salarie</td>
              <td>
                {salarie.prenom} {salarie.nom}
              </td>
            </tr>
            <tr>
              <td>Statut</td>
              <td>{salarie.statut === "cadre" ? "Cadre" : "ETAM"}</td>
            </tr>
            <tr>
              <td>Salaire de base mensuel</td>
              <td className="num">
                {formaterMontant(salarie.salaireBaseMensuel)}
              </td>
            </tr>
          </tbody>
        </table>
        <p>
          <Link to="/saisie">Modifier l'entreprise ou le salarie</Link>
        </p>
      </section>

      <section className="bulletin-form">
        <label>
          Periode (AAAA-MM)
          <input
            type="month"
            value={periode}
            onChange={(e) => setPeriode(e.target.value)}
          />
        </label>

        <label>
          Heures
          <input
            type="number"
            step="0.01"
            value={heures}
            onChange={(e) => setHeures(e.target.value)}
          />
        </label>

        <label>
          Prime soumise
          <input
            type="number"
            step="0.01"
            value={primeSoumise}
            onChange={(e) => setPrimeSoumise(e.target.value)}
          />
        </label>

        <label>
          Jours de conges
          <input
            type="number"
            step="1"
            value={joursConges}
            onChange={(e) => setJoursConges(e.target.value)}
          />
        </label>

        {/* Enregistrement du mois saisi. type="button" : pas de <form> ici, mais on se
            premunit contre toute soumission implicite. Desactive si le calcul n'est pas
            valide (bulletin null ou erreur de couche 4) ou pendant l'ecriture. */}
        <div className="bulletin-enregistrer">
          <button
            type="button"
            onClick={handleEnregistrer}
            disabled={!bulletin || erreur !== null || enregistrementEnCours}
          >
            {enregistrementEnCours ? "Enregistrement..." : "Enregistrer ce mois"}
          </button>
          {erreurEnregistrement ? (
            <p className="bulletin-erreur" role="alert">
              {erreurEnregistrement}
            </p>
          ) : messageSucces ? (
            <p className="bulletin-succes">{messageSucces}</p>
          ) : null}
        </div>
      </section>

      {/* Historique en LECTURE SEULE du salarie actif, sous le formulaire et au-dessus
          du bulletin calcule : le mois fraichement enregistre apparait en tete (tri
          decroissant fait par le store / le contexte, jamais ici) juste sous le bouton.
          Composant EXTRAIT (etape 5a) et partage avec la fiche salarie : une lecture
          d'historique en echec reste cantonnee a sa section, elle n'empeche ni la
          saisie ni le calcul ci-dessous. */}
      <HistoriqueBulletins
        statut={statutBulletins}
        erreur={erreurBulletins}
        bulletins={bulletins}
      />

      {erreur ? (
        <p className="bulletin-erreur" role="alert">
          {erreur}
        </p>
      ) : bulletin ? (
        <>
          <section className="bulletin-section">
            <h2>Elements de brut</h2>
            <table className="bulletin-table">
              <tbody>
                {bulletin.lignesBrut.map((g, i) => (
                  <tr key={`${g.libelle}-${i}`}>
                    <td>{g.libelle}</td>
                    <td className="num">{formaterMontant(g.montant)}</td>
                  </tr>
                ))}
                <tr>
                  <td>
                    <strong>Brut total soumis</strong>
                  </td>
                  <td className="num">
                    <strong>{formaterMontant(bulletin.brutTotal)}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          <TableLignes
            titre="Cotisations salariales"
            lignes={bulletin.lignesSalariales}
          />
          <TableLignes
            titre="Cotisations patronales"
            lignes={bulletin.lignesPatronales}
          />

          <section className="bulletin-section">
            <h2>Totaux</h2>
            <table className="bulletin-table bulletin-totaux">
              <tbody>
                <tr>
                  <td>Total retenues salariales</td>
                  <td className="num">
                    {formaterMontant(bulletin.totalRetenuesSalariales)}
                  </td>
                </tr>
                <tr>
                  <td>Total cotisations patronales</td>
                  <td className="num">
                    {formaterMontant(bulletin.totalCotisationsPatronales)}
                  </td>
                </tr>
                <tr>
                  <td>Allegement general</td>
                  <td className="num">
                    {formaterMontant(bulletin.allegementCotisations)}
                  </td>
                </tr>
                <tr>
                  <td>Net social</td>
                  <td className="num">{formaterMontant(bulletin.netSocial)}</td>
                </tr>
                <tr>
                  <td>Net a payer avant impot</td>
                  <td className="num">
                    {formaterMontant(bulletin.netAPayerAvantImpot)}
                  </td>
                </tr>
                <tr>
                  <td>Cout total employeur</td>
                  <td className="num">
                    {formaterMontant(bulletin.coutTotalEmployeur)}
                  </td>
                </tr>
                {baremeReference ? (
                  <tr>
                    <td>Bareme applique</td>
                    <td className="num">{baremeReference}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </section>
        </>
      ) : null}
    </main>
  );
}
