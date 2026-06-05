import { useState } from "react";
import {
  CONVENTION_SYNTEC,
  type EntrepriseId,
  type Salarie,
} from "../model/types";
import type { Statut } from "../engine";

// Onglet 2 : saisie de la COUCHE 3 (salarie / contrat).
//
// Comme EntrepriseForm, ce composant ne fait aucun calcul et ne connait pas le
// moteur : il produit un objet Salarie conforme a src/model/types.ts et le remonte
// via onSave. Le parent (SaisiePage) detient l'etat.
//
// DEPENDANCE DE COUCHE : un salarie reference son entreprise par identifiant. Le
// parent transmet l'entrepriseId (de l'entreprise deja creee) en prop ; le
// formulaire le pose tel quel sur salarie.entrepriseId, jamais saisi a la main.
// La coherence de cette reference sera verifiee par l'assembleur.
//
// La convention collective est FIGEE a Syntec (CONVENTION_SYNTEC) : affichee en
// lecture seule, pas saisie. Champ RESERVE non affiche : tauxPas (PAS pas encore
// applique par le moteur).

export function SalarieForm({
  entrepriseId,
  salarie,
  onSave,
}: {
  entrepriseId: EntrepriseId;
  salarie: Salarie | null;
  onSave: (salarie: Salarie) => void;
}) {
  const [prenom, setPrenom] = useState(salarie?.prenom ?? "");
  const [nom, setNom] = useState(salarie?.nom ?? "");
  const [statut, setStatut] = useState<Statut>(salarie?.statut ?? "cadre");
  const [classification, setClassification] = useState(
    salarie?.classification ?? "",
  );
  const [typeContrat, setTypeContrat] = useState(
    salarie?.typeContrat ?? "CDI",
  );
  const [salaireBaseMensuel, setSalaireBaseMensuel] = useState(
    salarie ? String(salarie.salaireBaseMensuel) : "",
  );
  const [dateEntree, setDateEntree] = useState(salarie?.dateEntree ?? "");
  const [mutuellePartPatronale, setMutuellePartPatronale] = useState(
    salarie?.mutuellePartPatronale != null
      ? String(salarie.mutuellePartPatronale)
      : "0",
  );
  const [mutuellePartSalariale, setMutuellePartSalariale] = useState(
    salarie?.mutuellePartSalariale != null
      ? String(salarie.mutuellePartSalariale)
      : "0",
  );
  const [erreur, setErreur] = useState<string | null>(null);

  function soumettre(e: React.FormEvent) {
    e.preventDefault();
    try {
      const salaireNum = Number(salaireBaseMensuel);
      const mutPatNum = Number(mutuellePartPatronale);
      const mutSalNum = Number(mutuellePartSalariale);

      if (prenom.trim() === "" || nom.trim() === "") {
        throw new Error("Le prenom et le nom sont obligatoires.");
      }
      if (
        salaireBaseMensuel.trim() === "" ||
        !Number.isFinite(salaireNum) ||
        salaireNum <= 0
      ) {
        throw new Error(
          "Le salaire de base mensuel doit etre un nombre strictement positif.",
        );
      }
      if (!Number.isFinite(mutPatNum) || mutPatNum < 0) {
        throw new Error(
          "La mutuelle part patronale doit etre un nombre positif ou nul.",
        );
      }
      if (!Number.isFinite(mutSalNum) || mutSalNum < 0) {
        throw new Error(
          "La mutuelle part salariale doit etre un nombre positif ou nul.",
        );
      }

      const salarieSaisi: Salarie = {
        id: salarie?.id ?? crypto.randomUUID(),
        // Reference de couche : posee depuis la prop, jamais saisie a la main.
        entrepriseId,
        prenom: prenom.trim(),
        nom: nom.trim(),
        statut,
        convention: CONVENTION_SYNTEC,
        classification: classification.trim(),
        typeContrat: typeContrat.trim(),
        salaireBaseMensuel: salaireNum,
        dateEntree: dateEntree.trim(),
        mutuellePartPatronale: mutPatNum,
        mutuellePartSalariale: mutSalNum,
      };

      setErreur(null);
      onSave(salarieSaisi);
    } catch (err) {
      setErreur(
        err instanceof Error ? err.message : "Saisie salarie invalide.",
      );
    }
  }

  return (
    <form className="bulletin-form" onSubmit={soumettre}>
      <label>
        Prenom
        <input
          type="text"
          value={prenom}
          onChange={(e) => setPrenom(e.target.value)}
        />
      </label>

      <label>
        Nom
        <input
          type="text"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
        />
      </label>

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
        Convention collective
        <input type="text" value={CONVENTION_SYNTEC} readOnly />
      </label>

      <label>
        Classification
        <input
          type="text"
          value={classification}
          onChange={(e) => setClassification(e.target.value)}
        />
      </label>

      <label>
        Type de contrat
        <input
          type="text"
          value={typeContrat}
          onChange={(e) => setTypeContrat(e.target.value)}
        />
      </label>

      <label>
        Salaire de base mensuel
        <input
          type="number"
          step="0.01"
          min="0"
          value={salaireBaseMensuel}
          onChange={(e) => setSalaireBaseMensuel(e.target.value)}
        />
      </label>

      <label>
        Date d'entree
        <input
          type="date"
          value={dateEntree}
          onChange={(e) => setDateEntree(e.target.value)}
        />
      </label>

      <label>
        Mutuelle part patronale
        <input
          type="number"
          step="0.01"
          min="0"
          value={mutuellePartPatronale}
          onChange={(e) => setMutuellePartPatronale(e.target.value)}
        />
      </label>

      <label>
        Mutuelle part salariale
        <input
          type="number"
          step="0.01"
          min="0"
          value={mutuellePartSalariale}
          onChange={(e) => setMutuellePartSalariale(e.target.value)}
        />
      </label>

      {erreur ? (
        <p className="bulletin-erreur" role="alert">
          {erreur}
        </p>
      ) : null}

      <div className="form-actions">
        <button type="submit">Enregistrer le salarie</button>
      </div>
    </form>
  );
}
