import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  calculerBulletin,
  getBareme,
  type BulletinCalcule,
  type EntreeBulletin,
  type LigneCotisation,
  type Statut,
} from "../engine";

// Reference du bareme, figee pour l'instant (affichee en lecture seule).
const REFERENCE_BAREME = "syntec-2026-01";

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
  // Etat local du formulaire. Les champs numeriques sont stockes en chaine
  // pour gerer proprement la saisie (vide, partielle) avant parsing.
  const [statut, setStatut] = useState<Statut>("cadre");
  const [brut, setBrut] = useState("4000");
  const [tauxAtMp, setTauxAtMp] = useState("1.4");
  const [heures, setHeures] = useState("151.67");
  const [primeSoumise, setPrimeSoumise] = useState("0");
  const [joursConges, setJoursConges] = useState("0");

  // Recalcul reactif : a chaque changement de champ, on appelle le moteur.
  // Aucune logique de paie ici, seulement la validation de la saisie.
  const { bulletin, erreur } = useMemo<{
    bulletin: BulletinCalcule | null;
    erreur: string | null;
  }>(() => {
    try {
      const brutNum = Number(brut);
      const tauxNum = Number(tauxAtMp);
      const heuresNum = Number(heures);
      const primeNum = Number(primeSoumise);
      const joursCongesNum = Number(joursConges);

      if (brut.trim() === "" || !Number.isFinite(brutNum) || brutNum <= 0) {
        throw new Error("Le brut mensuel doit etre un nombre strictement positif.");
      }
      if (tauxAtMp.trim() === "" || !Number.isFinite(tauxNum) || tauxNum < 0) {
        throw new Error("Le taux AT/MP doit etre un nombre positif ou nul.");
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

      const entree: EntreeBulletin = {
        legal: { bareme: REFERENCE_BAREME },
        entreprise: { tauxAtMp: tauxNum },
        salarie: { statut, brutMensuel: brutNum },
        mensuel: {
          heures: heuresNum,
          primeSoumise: primeNum,
          joursConges: joursCongesNum,
        },
      };

      const bareme = getBareme(REFERENCE_BAREME);
      return { bulletin: calculerBulletin(entree, bareme), erreur: null };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erreur de calcul inconnue.";
      return { bulletin: null, erreur: message };
    }
  }, [statut, brut, tauxAtMp, heures, primeSoumise, joursConges]);

  return (
    <main className="bulletin-page">
      <header className="bulletin-header">
        <h1>Bulletin de paie</h1>
        <Link to="/">Retour a l'accueil</Link>
      </header>

      <section className="bulletin-form">
        <label>
          Statut
          <select
            value={statut}
            onChange={(e) => setStatut(e.target.value as Statut)}
          >
            <option value="cadre">Cadre</option>
            <option value="etam">ETAM</option>
          </select>
        </label>

        <label>
          Brut mensuel
          <input
            type="number"
            value={brut}
            onChange={(e) => setBrut(e.target.value)}
          />
        </label>

        <label>
          Taux AT/MP
          <input
            type="number"
            step="0.01"
            value={tauxAtMp}
            onChange={(e) => setTauxAtMp(e.target.value)}
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

        <label>
          Bareme
          <input type="text" value={REFERENCE_BAREME} readOnly />
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
              </tbody>
            </table>
          </section>
        </>
      ) : null}
    </main>
  );
}
