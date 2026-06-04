import type {
  Bareme,
  BulletinCalcule,
  EntreeBulletin,
  LigneCotisation,
} from "./types";

// Libelles des lignes de cotisation. Centralises ici pour rester coherents
// entre le calcul et les tests. Aucun tiret cadratin.
export const LIBELLES = {
  ssDeplafonnee: "Securite sociale deplafonnee",
  ssPlafonnee: "Securite sociale plafonnee",
  retraiteTrancheA: "Retraite complementaire Tranche A",
  chomageApec: "Chomage APEC",
  csgNonImposable: "CSG non imposable",
  csgCrdsImposable: "CSG/CRDS imposable",
  santeMaladie: "Sante maladie",
  prevoyanceCadre: "Prevoyance cadre Tranche A",
  atMp: "AT/MP",
  famille: "Famille",
  assuranceChomage: "Assurance chomage",
  chomageAgs: "Chomage AGS",
  apec: "APEC",
  autresContributions: "Autres contributions employeur",
} as const;

// Arrondi au centime. Le moteur arrondit chaque montant de ligne, puis somme
// les montants deja arrondis, pour rester coherent avec un bulletin reel.
function arrondirCentime(valeur: number): number {
  return Math.round((valeur + Number.EPSILON) * 100) / 100;
}

// Construit une ligne de cotisation a partir d'une base et d'un taux en pourcentage.
function ligne(libelle: string, base: number, taux: number): LigneCotisation {
  return {
    libelle,
    base,
    taux,
    montant: arrondirCentime((base * taux) / 100),
  };
}

function sommeMontants(lignes: LigneCotisation[]): number {
  return arrondirCentime(
    lignes.reduce((total, l) => total + l.montant, 0),
  );
}

// Fonction PURE : (entree, bareme) -> bulletin calcule.
// Ne lit ni n'ecrit aucun etat externe.
export function calculerBulletin(
  entree: EntreeBulletin,
  bareme: Bareme,
): BulletinCalcule {
  if (entree.legal.bareme !== bareme.reference) {
    throw new Error(
      `Bareme incoherent : l'entree demande "${entree.legal.bareme}" mais le bareme fourni est "${bareme.reference}".`,
    );
  }

  const brutTotal = entree.salarie.brutMensuel;
  const estCadre = entree.salarie.statut === "cadre";

  const { salariales, patronales } = bareme;

  // Base abattue pour la CSG/CRDS.
  const baseCsg = arrondirCentime(brutTotal * salariales.abattementCsg);

  // --- Cotisations salariales ---
  const lignesSalariales: LigneCotisation[] = [
    ligne(LIBELLES.ssDeplafonnee, brutTotal, salariales.ssDeplafonnee),
    ligne(LIBELLES.ssPlafonnee, brutTotal, salariales.ssPlafonnee),
    ligne(LIBELLES.retraiteTrancheA, brutTotal, salariales.retraiteComplTrancheA),
  ];
  // L'APEC ne concerne que les cadres.
  if (estCadre) {
    lignesSalariales.push(
      ligne(LIBELLES.chomageApec, brutTotal, salariales.chomageApec),
    );
  }
  lignesSalariales.push(
    ligne(LIBELLES.csgNonImposable, baseCsg, salariales.csgNonImposable),
    ligne(LIBELLES.csgCrdsImposable, baseCsg, salariales.csgCrdsImposable),
  );

  // --- Cotisations patronales ---
  const lignesPatronales: LigneCotisation[] = [
    ligne(LIBELLES.santeMaladie, brutTotal, patronales.santeMaladie),
  ];
  // La prevoyance cadre Tranche A ne concerne que les cadres.
  if (estCadre) {
    lignesPatronales.push(
      ligne(LIBELLES.prevoyanceCadre, brutTotal, patronales.prevoyanceCadreTrancheA),
    );
  }
  lignesPatronales.push(
    ligne(LIBELLES.atMp, brutTotal, entree.entreprise.tauxAtMp),
    ligne(LIBELLES.ssDeplafonnee, brutTotal, patronales.ssDeplafonnee),
    ligne(LIBELLES.ssPlafonnee, brutTotal, patronales.ssPlafonnee),
    ligne(LIBELLES.retraiteTrancheA, brutTotal, patronales.retraiteComplTrancheA),
    ligne(LIBELLES.famille, brutTotal, patronales.famille),
    ligne(LIBELLES.assuranceChomage, brutTotal, patronales.assuranceChomage),
    ligne(LIBELLES.chomageAgs, brutTotal, patronales.chomageAgs),
  );
  // L'APEC patronale ne concerne que les cadres.
  if (estCadre) {
    lignesPatronales.push(ligne(LIBELLES.apec, brutTotal, patronales.apec));
  }
  lignesPatronales.push(
    ligne(LIBELLES.autresContributions, brutTotal, patronales.autresContributions),
  );

  const totalRetenuesSalariales = sommeMontants(lignesSalariales);
  const totalCotisationsPatronales = sommeMontants(lignesPatronales);
  const allegementCotisations = bareme.allegementCotisations;

  // Net social : brut moins les retenues salariales.
  const netSocial = arrondirCentime(brutTotal - totalRetenuesSalariales);
  // Pas d'autre element (prime, absence, frais) a ce stade.
  const netAPayerAvantImpot = netSocial;

  // Cout total employeur : brut + cotisations patronales - allegement.
  const coutTotalEmployeur = arrondirCentime(
    brutTotal + totalCotisationsPatronales - allegementCotisations,
  );

  return {
    brutTotal,
    lignesSalariales,
    lignesPatronales,
    totalRetenuesSalariales,
    totalCotisationsPatronales,
    allegementCotisations,
    netSocial,
    netAPayerAvantImpot,
    coutTotalEmployeur,
  };
}
