import { useMemo, useState } from "react";
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

// Page d'AFFICHAGE du bulletin.
//
// SOURCE DES DONNEES : l'entreprise (couche 2) et le salarie (couche 3) viennent du
// SaisieContext, donc de ce qui a ete REELLEMENT saisi dans /saisie. Plus aucune
// donnee en dur (l'ancien cadre 4000 a disparu). La couche MENSUELLE (couche 4 :
// periode, heures, prime, conges) est saisie ICI, en etat local : c'est la donnee
// qui change chaque mois, elle n'a pas sa place dans le contexte partage.
//
// FRONTIERE : la page ne fabrique JAMAIS l'entree plate du moteur. Elle passe
// TOUJOURS par assemblerEntree (seul endroit qui reunit les 4 couches) puis
// calculerBulletin. Le bareme applique est celui resolu par l'assembleur
// (entree.legal.bareme), pas un identifiant code en dur dans la page.

// Formate un montant en euros : 2 decimales et espace separateur de milliers.
// Ex : 5588.08 -> "5 588.08 €". N'effectue aucun calcul de paie.
function formaterMontant(valeur: number): string {
  const fixe = valeur.toFixed(2);
  const [entier, decimales] = fixe.split(".");
  const signe = entier.startsWith("-") ? "-" : "";
  const chiffres = signe ? entier.slice(1) : entier;
  const avecEspaces = chiffres.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${signe}${avecEspaces}.${decimales} €`;
}

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
  // Couches 2 et 3 : lues dans le contexte partage (saisies dans /saisie).
  const { entreprise, salarie } = useSaisie();

  // Couche 4 (mensuel) : etat LOCAL a cette page. Les champs numeriques sont
  // stockes en chaine pour gerer proprement la saisie (vide, partielle) avant
  // parsing. La duree mensuelle par defaut vient du moteur, pas d'un nombre magique.
  const [periode, setPeriode] = useState("2026-06");
  const [heures, setHeures] = useState(String(HEURES_MENSUELLES_LEGALES));
  const [primeSoumise, setPrimeSoumise] = useState("0");
  const [joursConges, setJoursConges] = useState("0");

  // Recalcul reactif. Si l'entreprise ou le salarie manque, on ne calcule rien
  // (l'ecran invite a completer la saisie). Sinon on valide la couche 4 puis on
  // passe par assemblerEntree -> calculerBulletin. Aucune logique de paie ici :
  // seulement la validation de la saisie mensuelle.
  const { bulletin, erreur, baremeReference } = useMemo<{
    bulletin: BulletinCalcule | null;
    erreur: string | null;
    baremeReference: string | null;
  }>(() => {
    if (!entreprise || !salarie) {
      return { bulletin: null, erreur: null, baremeReference: null };
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
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erreur de calcul inconnue.";
      return { bulletin: null, erreur: message, baremeReference: null };
    }
  }, [entreprise, salarie, periode, heures, primeSoumise, joursConges]);

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
            l'entreprise et du salarie.
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
      </section>

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
