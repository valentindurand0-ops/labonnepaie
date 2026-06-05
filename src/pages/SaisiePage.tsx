import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { assemblerEntree, type BulletinMensuel } from "../model/types";
import {
  calculerBulletin,
  getBareme,
  HEURES_MENSUELLES_LEGALES,
  type BulletinCalcule,
} from "../engine";
import { EntrepriseForm } from "../components/EntrepriseForm";
import { SalarieForm } from "../components/SalarieForm";
import { useSaisie } from "../context/SaisieContext";

// Page de SAISIE : onglets entreprise (couche 2) et salarie (couche 3), poses sur
// le modele a 4 couches (src/model/types.ts).
//
// ETAPE SANS PERSISTANCE : l'etat des couches (entreprise, salarie) vit dans le
// SaisieContext (partage avec BulletinPage), en memoire. Pas de Supabase a ce stade.
// Cette page ne DETIENT plus cet etat : elle le LIT et l'ECRIT via useSaisie. Seul
// l'onglet actif reste un etat local (pur UI, propre a cette page).
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
  // pas par cette page. On le lit et on l'ecrit via le contexte.
  const { entreprise, salarie, setEntreprise, setSalarie } = useSaisie();
  // Onglet actif : pur etat d'UI, local a cette page (rien a partager).
  const [ongletActif, setOngletActif] = useState<Onglet>("entreprise");

  // L'onglet salarie n'existe pas sans entreprise (dependance de couche).
  const salarieAccessible = entreprise !== null;

  // Bulletin minimal NON EDITABLE a cette etape (pas d'onglet bulletin). Il sert
  // uniquement a prouver l'assemblage bout en bout. La duree mensuelle vient du
  // moteur (HEURES_MENSUELLES_LEGALES), pas d'un nombre magique ecrit ici.
  const bulletinMinimal = useMemo<BulletinMensuel | null>(() => {
    if (!salarie) return null;
    return {
      salarieId: salarie.id,
      periode: "2026-06",
      heures: HEURES_MENSUELLES_LEGALES,
    };
  }, [salarie]);

  // Preuve : entreprise + salarie + bulletin minimal -> assembleur -> moteur.
  // On passe TOUJOURS par assemblerEntree ; on ne fabrique pas l'entree plate.
  const { bulletin, erreur } = useMemo<{
    bulletin: BulletinCalcule | null;
    erreur: string | null;
  }>(() => {
    if (!entreprise || !salarie || !bulletinMinimal) {
      return { bulletin: null, erreur: null };
    }
    try {
      const entree = assemblerEntree(entreprise, salarie, bulletinMinimal);
      return {
        bulletin: calculerBulletin(entree, getBareme(entree.legal.bareme)),
        erreur: null,
      };
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Erreur d'assemblage inconnue.";
      return { bulletin: null, erreur: message };
    }
  }, [entreprise, salarie, bulletinMinimal]);

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
          Salarie{salarie ? " (enregistre)" : ""}
        </button>
      </nav>

      {ongletActif === "entreprise" ? (
        <section className="bulletin-section">
          <h2>Entreprise</h2>
          <EntrepriseForm
            entreprise={entreprise}
            onSave={(e) => {
              setEntreprise(e);
              // Apres creation de l'entreprise, on oriente vers l'onglet salarie.
              setOngletActif("salarie");
            }}
          />
        </section>
      ) : null}

      {ongletActif === "salarie" ? (
        <section className="bulletin-section">
          <h2>Salarie</h2>
          {entreprise ? (
            <SalarieForm
              entrepriseId={entreprise.id}
              salarie={salarie}
              onSave={(s) => setSalarie(s)}
            />
          ) : (
            <p>Creez d'abord une entreprise dans l'onglet precedent.</p>
          )}
        </section>
      ) : null}

      <section className="bulletin-section">
        <h2>Verification de l'assemblage</h2>
        {!entreprise || !salarie ? (
          <p>
            Renseignez l'entreprise puis le salarie pour assembler un bulletin de
            controle.
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
