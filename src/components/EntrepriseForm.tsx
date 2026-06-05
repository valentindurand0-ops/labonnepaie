import { useState } from "react";
import type { Entreprise } from "../model/types";

// Onglet 1 : saisie de la COUCHE 2 (entreprise, objet racine du modele).
//
// Le formulaire ne fait AUCUN calcul de paie et ne connait pas le moteur. Il
// produit un objet Entreprise conforme a src/model/types.ts et le remonte via
// onSave. C'est le parent (SaisiePage) qui detient l'etat ; ce composant ne fait
// que saisir, valider, et emettre l'objet de couche.
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
  );
}
