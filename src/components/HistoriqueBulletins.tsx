import type { BulletinMensuel } from "../model/types";
import type { StatutBulletins } from "../types/statuts";
import { formaterMontant } from "../utils/formatage";

// Composant PRESENTATIONNEL de l'historique des bulletins enregistres d'un salarie.
//
// EXTRAIT de BulletinPage (etape 5a) pour etre REUTILISE a l'identique par
// BulletinPage et FicheSalariePage : on extrait, on ne recopie pas. Il ne lit NI le
// contexte NI le moteur : tout entre par les props (statut, erreur, bulletins). Il ne
// depend meme pas du module contexte pour son type : StatutBulletins vient d'un module
// de types neutre (src/types/statuts.ts). Aucune logique de paie, aucun tri ici : le
// tri (periode decroissante) est fait en amont par le store / le contexte.
//
// On affiche UNIQUEMENT les entrees de la couche 4 (periode, heures, prime, conges),
// jamais les sorties du moteur. Une lecture d'historique en echec est cantonnee a ce
// composant : elle n'empeche ni la saisie ni le calcul ailleurs sur la page.

export function HistoriqueBulletins({
  statut,
  erreur,
  bulletins,
}: {
  statut: StatutBulletins;
  erreur: string | null;
  bulletins: BulletinMensuel[];
}) {
  return (
    <section className="bulletin-section">
      <h2>Historique des bulletins enregistres</h2>
      {statut === "chargement" ? (
        <p>Chargement de l'historique...</p>
      ) : statut === "erreur" ? (
        <p className="bulletin-erreur" role="alert">
          {erreur}
        </p>
      ) : bulletins.length === 0 ? (
        <p>Aucun mois enregistre pour ce salarie.</p>
      ) : (
        <table className="bulletin-table">
          <thead>
            <tr>
              <th>Periode</th>
              <th className="num">Heures</th>
              <th className="num">Prime soumise</th>
              <th className="num">Jours de conges</th>
            </tr>
          </thead>
          <tbody>
            {bulletins.map((b) => (
              <tr key={b.periode}>
                <td>{b.periode}</td>
                <td className="num">{b.heures}</td>
                <td className="num">{formaterMontant(b.primeSoumise ?? 0)}</td>
                <td className="num">{b.joursConges ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
