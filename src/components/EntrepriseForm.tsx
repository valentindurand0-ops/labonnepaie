import { useState } from "react";
import type { Entreprise } from "../model/types";
import {
  rechercherEntreprises,
  type ResultatRechercheEntreprise,
} from "../services/rechercheEntreprises";

// Onglet 1 : saisie de la COUCHE 2 (entreprise, objet racine du modele).
//
// Le formulaire ne fait AUCUN calcul de paie et ne connait pas le moteur. Il
// produit un objet Entreprise conforme a src/model/types.ts et le remonte via
// onSave. C'est le parent (SaisiePage) qui detient l'etat ; ce composant ne fait
// que saisir, valider, et emettre l'objet de couche.
//
// PRE-REMPLISSAGE via l'API Recherche d'entreprises : le bloc recherche (sibling
// au-dessus du formulaire) appelle src/services/rechercheEntreprises. Au clic sur
// un resultat, on remplit les champs LOCAUX fiables (raison sociale, SIRET, APE,
// adresse) ; l'objet Entreprise emis garde EXACTEMENT la meme forme qu'avant. Tout
// reste editable, et la saisie 100% manuelle reste possible si l'API est indispo.
// L'effectif et le taux AT/MP ne sont JAMAIS pre-remplis (ils engagent la
// conformite : saisis et confirmes a la main).
//
// Champs RESERVES du modele (communeInsee, organismes) non affiches a cette etape :
// ce sont des emplacements reserves (versement mobilite, DSN), pas encore exploites.
// Le FNAL n'est PAS un champ : il se deduit de l'effectif (deduireFnal).

// Les champs numeriques sont stockes en chaine pour gerer proprement la saisie
// (vide, partielle) avant parsing, comme dans BulletinPage.
export function EntrepriseForm({
  entreprise,
  onSave,
}: {
  entreprise: Entreprise | null;
  onSave: (entreprise: Entreprise) => void;
}) {
  const [raisonSociale, setRaisonSociale] = useState(
    entreprise?.raisonSociale ?? "",
  );
  const [siret, setSiret] = useState(entreprise?.siret ?? "");
  const [codeApe, setCodeApe] = useState(entreprise?.codeApe ?? "");
  const [ligne1, setLigne1] = useState(entreprise?.adresse.ligne1 ?? "");
  const [codePostal, setCodePostal] = useState(
    entreprise?.adresse.codePostal ?? "",
  );
  const [commune, setCommune] = useState(entreprise?.adresse.commune ?? "");
  const [effectif, setEffectif] = useState(
    entreprise ? String(entreprise.effectif) : "",
  );
  const [tauxAtMp, setTauxAtMp] = useState(
    entreprise ? String(entreprise.tauxAtMp) : "",
  );
  const [erreur, setErreur] = useState<string | null>(null);

  // Etat du bloc de recherche (pre-remplissage via l'API). Independant de la
  // saisie : son seul effet est de remplir les champs locaux ci-dessus.
  const [recherche, setRecherche] = useState("");
  const [resultats, setResultats] = useState<ResultatRechercheEntreprise[]>([]);
  const [chargement, setChargement] = useState(false);
  const [erreurRecherche, setErreurRecherche] = useState<string | null>(null);
  const [rechercheLancee, setRechercheLancee] = useState(false);
  // Indice INSEE d'effectif du dernier resultat choisi : AFFICHAGE SEULEMENT, a
  // cote du champ effectif. Ne pre-remplit jamais l'effectif.
  const [indiceEffectif, setIndiceEffectif] = useState<{
    label: string;
    annee: string | null;
  } | null>(null);

  const rechercheTropCourte = recherche.trim().length < 3;

  async function lancerRecherche() {
    if (rechercheTropCourte) return;
    setChargement(true);
    setErreurRecherche(null);
    try {
      const trouves = await rechercherEntreprises(recherche);
      setResultats(trouves);
    } catch {
      // On n'expose pas le detail technique : message simple, saisie manuelle
      // toujours possible en repli.
      setErreurRecherche(
        "Recherche indisponible. Vous pouvez saisir l'entreprise manuellement.",
      );
      setResultats([]);
    } finally {
      setChargement(false);
      setRechercheLancee(true);
    }
  }

  // Remplit les champs LOCAUX fiables depuis un resultat. Ne touche jamais a
  // effectif ni tauxAtMp. Les champs restent editables ensuite.
  function choisirResultat(r: ResultatRechercheEntreprise) {
    setRaisonSociale(r.raisonSociale);
    setSiret(r.siret);
    setCodeApe(r.codeApe);
    setLigne1(r.adresseLigne1);
    setCodePostal(r.codePostal);
    setCommune(r.commune);
    setIndiceEffectif(
      r.trancheEffectifLabel
        ? { label: r.trancheEffectifLabel, annee: r.trancheEffectifAnnee }
        : null,
    );
    // On replie la liste de resultats apres selection.
    setResultats([]);
    setRechercheLancee(false);
  }

  function soumettre(e: React.FormEvent) {
    e.preventDefault();
    try {
      const effectifNum = Number(effectif);
      const tauxNum = Number(tauxAtMp);

      if (raisonSociale.trim() === "") {
        throw new Error("La raison sociale est obligatoire.");
      }
      if (
        effectif.trim() === "" ||
        !Number.isInteger(effectifNum) ||
        effectifNum < 0
      ) {
        throw new Error("L'effectif doit etre un entier positif ou nul.");
      }
      if (tauxAtMp.trim() === "" || !Number.isFinite(tauxNum) || tauxNum < 0) {
        throw new Error("Le taux AT/MP doit etre un nombre positif ou nul.");
      }

      // On conserve l'id existant en re-edition, on en genere un seul a la
      // premiere creation. La valeur de l'id importe peu tant que la reference
      // salarie -> entreprise concorde : c'est l'assembleur qui la verifie.
      const entrepriseSaisie: Entreprise = {
        id: entreprise?.id ?? crypto.randomUUID(),
        raisonSociale: raisonSociale.trim(),
        siret: siret.trim(),
        codeApe: codeApe.trim(),
        adresse: {
          ligne1: ligne1.trim(),
          codePostal: codePostal.trim(),
          commune: commune.trim(),
        },
        effectif: effectifNum,
        tauxAtMp: tauxNum,
      };

      setErreur(null);
      onSave(entrepriseSaisie);
    } catch (err) {
      setErreur(
        err instanceof Error ? err.message : "Saisie entreprise invalide.",
      );
    }
  }

  return (
    <>
      <section className="recherche-entreprise">
        <label>
          Rechercher mon entreprise (nom ou SIRET)
          <input
            type="text"
            value={recherche}
            placeholder="Ex : nom de la societe ou numero SIRET"
            onChange={(e) => setRecherche(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void lancerRecherche();
              }
            }}
          />
        </label>
        <div className="form-actions">
          <button
            type="button"
            onClick={() => void lancerRecherche()}
            disabled={chargement || rechercheTropCourte}
          >
            Rechercher
          </button>
        </div>

        {chargement ? <p className="recherche-statut">Recherche en cours...</p> : null}

        {erreurRecherche ? (
          <p className="recherche-statut recherche-erreur" role="alert">
            {erreurRecherche}
          </p>
        ) : null}

        {!chargement &&
        !erreurRecherche &&
        rechercheLancee &&
        resultats.length === 0 ? (
          <p className="recherche-statut">Aucune entreprise trouvee.</p>
        ) : null}

        {resultats.length > 0 ? (
          <ul className="recherche-resultats">
            {resultats.map((r) => (
              <li key={`${r.siret}-${r.raisonSociale}`}>
                <button type="button" onClick={() => choisirResultat(r)}>
                  <span className="resultat-nom">{r.raisonSociale}</span>
                  <span className="resultat-detail">
                    SIRET {r.siret || "inconnu"}
                    {r.commune ? ` - ${r.commune}` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <form className="bulletin-form" onSubmit={soumettre}>
        <label>
          Raison sociale
          <input
            type="text"
            value={raisonSociale}
            onChange={(e) => setRaisonSociale(e.target.value)}
          />
        </label>

        <label>
          SIRET
          <input
            type="text"
            value={siret}
            onChange={(e) => setSiret(e.target.value)}
          />
        </label>

        <label>
          Code APE / NAF
          <input
            type="text"
            value={codeApe}
            onChange={(e) => setCodeApe(e.target.value)}
          />
        </label>

        <label>
          Adresse
          <input
            type="text"
            value={ligne1}
            onChange={(e) => setLigne1(e.target.value)}
          />
        </label>

        <label>
          Code postal
          <input
            type="text"
            value={codePostal}
            onChange={(e) => setCodePostal(e.target.value)}
          />
        </label>

        <label>
          Commune
          <input
            type="text"
            value={commune}
            onChange={(e) => setCommune(e.target.value)}
          />
        </label>

        <label>
          Effectif
          <input
            type="number"
            step="1"
            min="0"
            value={effectif}
            onChange={(e) => setEffectif(e.target.value)}
          />
          {indiceEffectif ? (
            <small className="form-aide">
              INSEE indique : {indiceEffectif.label}
              {indiceEffectif.annee ? ` (en date de ${indiceEffectif.annee})` : ""}.
              Saisissez votre nombre exact de salaries.
            </small>
          ) : null}
        </label>

        <label>
          Taux AT/MP (%)
          <input
            type="number"
            step="0.01"
            min="0"
            value={tauxAtMp}
            onChange={(e) => setTauxAtMp(e.target.value)}
          />
          <small className="form-aide">
            Notifie chaque annee par la CARSAT, propre a votre entreprise. A VALIDER
            par expert-comptable.
          </small>
        </label>

        {erreur ? (
          <p className="bulletin-erreur" role="alert">
            {erreur}
          </p>
        ) : null}

        <div className="form-actions">
          <button type="submit">Enregistrer l'entreprise</button>
        </div>
      </form>
    </>
  );
}
