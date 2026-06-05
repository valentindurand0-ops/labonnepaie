import type {
  Assiette,
  Bareme,
  BulletinCalcule,
  EntreeBulletin,
  LigneBareme,
  LigneCotisation,
  LigneGain,
  ParamsRgdu,
} from "./types";

// Libelles des lignes de cotisation. Centralises ici pour rester coherents
// entre le bareme, le calcul et les tests. Aucun tiret cadratin.
export const LIBELLES = {
  vieillessePlafonnee: "Vieillesse plafonnee",
  vieillesseDeplafonnee: "Vieillesse deplafonnee",
  maladie: "Maladie",
  famille: "Allocations familiales",
  retraiteT1: "Retraite complementaire Agirc-Arrco T1",
  retraiteT2: "Retraite complementaire Agirc-Arrco T2",
  cegT1: "CEG T1",
  cegT2: "CEG T2",
  cet: "CET",
  apec: "APEC",
  chomage: "Assurance chomage",
  ags: "AGS",
  atMp: "AT/MP",
  fnal: "FNAL",
  prevoyanceCadre: "Prevoyance cadre T1",
  prevoyanceNonCadre: "Prevoyance non cadre",
  csgDeductible: "CSG deductible",
  csgCrdsNonDeductible: "CSG/CRDS non deductible",
  allegementGeneral: "Allegement general (reduction generale)",
  salaireBase: "Salaire de base",
  primeSoumise: "Prime soumise",
  retenueAbsenceConges: "Retenue absence conges payes",
  indemniteConges: "Indemnite conges payes",
} as const;

// Base mensuelle moyenne de jours ouvres servant a valoriser une journee de
// conge (salaire de base / JOURS_OUVRES_MOYENS). 21,67 = 260 jours ouvres / 12.
// A VALIDER par expert-comptable : le decompte exact depend du calendrier reel
// du mois (jours ouvres ou ouvrables effectifs). Ici on pose la mecanique du
// maintien de salaire, pas le decompte parfait.
const JOURS_OUVRES_MOYENS = 21.67;

// Arrondi au centime. Le moteur arrondit chaque montant de ligne, puis somme
// les montants deja arrondis, pour rester coherent avec un bulletin reel.
function arrondirCentime(valeur: number): number {
  return Math.round((valeur + Number.EPSILON) * 100) / 100;
}

// Construit une ligne de sortie a partir d'une base et d'un taux en pourcentage.
function ligne(libelle: string, base: number, taux: number): LigneCotisation {
  return {
    libelle,
    base,
    taux,
    montant: arrondirCentime((base * taux) / 100),
  };
}

function sommeMontants(lignes: LigneCotisation[]): number {
  return arrondirCentime(lignes.reduce((total, l) => total + l.montant, 0));
}

// Resout le montant d'assiette d'une ligne a partir du brut et des tranches.
function montantAssiette(
  assiette: Assiette,
  brut: number,
  t1: number,
  t2: number,
): number {
  switch (assiette) {
    case "brut":
      return brut;
    case "t1":
      return t1;
    case "t2":
      return t2;
    case "t1t2":
      return t1 + t2;
  }
}

// Verifie si la condition d'une ligne est remplie pour ce salarie / ce brut.
function conditionRemplie(
  ligneBareme: LigneBareme,
  estCadre: boolean,
  brut: number,
  pmss: number,
): boolean {
  switch (ligneBareme.condition) {
    case undefined:
      return true;
    case "cadre":
      return estCadre;
    case "nonCadre":
      return !estCadre;
    case "brutSuperieurPmss":
      return brut > pmss;
  }
}

// Fonction PURE isolee : calcul du coefficient de reduction generale degressive
// (RGDU, ex reduction Fillon). Retourne le coefficient C arrondi a 4 decimales.
//
// Formule : C = Tmin + Tdelta * ( 0.5 * (3 * smicAnnuelRgdu / remuAnnuelle - 1) ) ^ P
// avec deux garde-fous indispensables :
//   1. si remuAnnuelle >= 3 * smicAnnuelRgdu  ->  C = 0
//   2. C plafonne a Tmin + Tdelta, et plancher a 0 si negatif
//
// NOTE proto : ici remuAnnuelle = brutMensuel * 12. Le VRAI calcul est annuel et
// cumulatif (somme des bruts de l'annee civile). Quand les cumuls multi bulletins
// arriveront, seul l'argument remuAnnuelle changera, pas cette fonction.
export function calculerRgdu(
  remuAnnuelle: number,
  smicAnnuelRgdu: number,
  params: Pick<ParamsRgdu, "tmin" | "tdelta" | "p">,
): number {
  const { tmin, tdelta, p } = params;
  const plafond = tmin + tdelta;
  // Garde-fou division et remuneration nulle.
  if (remuAnnuelle <= 0) {
    return 0;
  }
  // Garde-fou 1 : au-dela de 3 SMIC, plus aucun allegement.
  if (remuAnnuelle >= 3 * smicAnnuelRgdu) {
    return 0;
  }
  const ratio = 0.5 * ((3 * smicAnnuelRgdu) / remuAnnuelle - 1);
  let c = tmin + tdelta * Math.pow(ratio, p);
  // Garde-fou 2 : plafond a Tmin + Tdelta, plancher a 0.
  if (c > plafond) {
    c = plafond;
  }
  if (c < 0) {
    c = 0;
  }
  return Math.round(c * 10000) / 10000;
}

// Fonction PURE : (entree, bareme) -> bulletin calcule.
// Moteur generique : il itere sur les lignes declaratives du bareme et applique
// l'assiette et les conditions. Aucune assiette codee en dur ligne par ligne.
export function calculerBulletin(
  entree: EntreeBulletin,
  bareme: Bareme,
): BulletinCalcule {
  if (entree.legal.bareme !== bareme.reference) {
    throw new Error(
      `Bareme incoherent : l'entree demande "${entree.legal.bareme}" mais le bareme fourni est "${bareme.reference}".`,
    );
  }

  // Brut soumis a cotisations = salaire de base + prime soumise du mois. TOUT le
  // calcul (tranches T1/T2, cotisations, CSG, RGDU, net) decoule de ce brut, sans
  // logique en double : il suffit que la prime entre ici.
  const salaireBase = entree.salarie.brutMensuel;
  const primeSoumise = entree.mensuel.primeSoumise ?? 0;
  const brut = arrondirCentime(salaireBase + primeSoumise);
  const estCadre = entree.salarie.statut === "cadre";
  const pmss = bareme.pmss;

  // Composition du brut, affichee comme des gains distincts (lisibilite). La
  // prime n'apparait que si elle est non nulle.
  const lignesBrut: LigneGain[] = [
    { libelle: LIBELLES.salaireBase, montant: salaireBase },
  ];
  if (primeSoumise !== 0) {
    lignesBrut.push({ libelle: LIBELLES.primeSoumise, montant: primeSoumise });
  }

  // Conges payes, methode du MAINTIEN DE SALAIRE. Le salarie en conge percoit le
  // meme brut que s'il avait travaille : on ne change pas le total, on le ventile.
  // On retire une part du salaire de base au titre des jours d'absence, puis on la
  // reajoute en indemnite de conges du MEME montant. Somme nulle : le brut soumis
  // (et donc tranches, cotisations, CSG, RGDU, net, cout employeur) est IDENTIQUE
  // a un mois sans conges au meme salaire. Seule la decomposition du brut differe.
  //
  // NON GERE dans le proto mono-bulletin (viendra avec les cumuls annuels) : la
  // regle du dixieme et l'obligation de retenir la methode la plus favorable au
  // salarie. Ici, uniquement le maintien de salaire.
  const joursConges = entree.mensuel.joursConges ?? 0;
  if (joursConges !== 0) {
    const valeurJournee = salaireBase / JOURS_OUVRES_MOYENS;
    const montantConges = arrondirCentime(valeurJournee * joursConges);
    lignesBrut.push({
      libelle: LIBELLES.retenueAbsenceConges,
      montant: -montantConges,
    });
    lignesBrut.push({
      libelle: LIBELLES.indemniteConges,
      montant: montantConges,
    });
  }

  // Tranches : T1 = part du brut sous le PMSS, T2 = part au-dessus.
  const t1 = Math.min(brut, pmss);
  const t2 = Math.max(0, brut - pmss);

  // Parts mutuelle (defaut 0). Seule la part patronale entre dans l'assiette CSG.
  const mutuellePartPatronale = entree.salarie.mutuellePartPatronale ?? 0;

  const lignesSalariales: LigneCotisation[] = [];
  const lignesPatronales: LigneCotisation[] = [];
  // Les lignes CSG/CRDS sont traitees en second passage : leur base depend des
  // parts patronales reintegrees (prevoyance, mutuelle), donc des autres lignes.
  const lignesCsg: LigneBareme[] = [];
  // Cumul des parts patronales reintegrees a 100 % dans l'assiette CSG.
  let reintegrationCsg = 0;

  for (const l of bareme.lignes) {
    if (!conditionRemplie(l, estCadre, brut, pmss)) {
      continue;
    }
    if (l.baseSpeciale === "csgCrds") {
      lignesCsg.push(l);
      continue;
    }

    let base = montantAssiette(l.assiette, brut, t1, t2);
    if (l.plafondPmss != null) {
      base = Math.min(base, l.plafondPmss * pmss);
    }

    const tauxPatronal = l.tauxPatronalDepuisEntreprise
      ? entree.entreprise.tauxAtMp
      : l.tauxPatronal;

    if (l.tauxSalarial !== 0) {
      lignesSalariales.push(ligne(l.libelle, base, l.tauxSalarial));
    }
    if (tauxPatronal !== 0) {
      const lp = ligne(l.libelle, base, tauxPatronal);
      lignesPatronales.push(lp);
      if (l.reintegrerCsg) {
        reintegrationCsg += lp.montant;
      }
    }
  }

  // Assiette CSG/CRDS legale :
  //   98.25 % du brut dans la limite de 4 PMSS  (abattement 1.75 % plafonne)
  // + 100 % de la part du brut au-dela de 4 PMSS
  // + parts patronales reintegrees (prevoyance) + part patronale mutuelle.
  // A VALIDER par expert-comptable (perimetre exact des reintegrations).
  const plafond4Pmss = 4 * pmss;
  const brutPlafonne = Math.min(brut, plafond4Pmss);
  const brutAuDela = Math.max(0, brut - plafond4Pmss);
  const baseCsg = arrondirCentime(
    0.9825 * brutPlafonne + brutAuDela + reintegrationCsg + mutuellePartPatronale,
  );
  for (const l of lignesCsg) {
    if (l.tauxSalarial !== 0) {
      lignesSalariales.push(ligne(l.libelle, baseCsg, l.tauxSalarial));
    }
    if (l.tauxPatronal !== 0) {
      lignesPatronales.push(ligne(l.libelle, baseCsg, l.tauxPatronal));
    }
  }

  // Reduction generale degressive (RGDU). Imputee uniquement sur les cotisations
  // patronales concernees (maladie, allocations familiales, vieillesse plafonnee
  // et deplafonnee, retraite complementaire, CEG, chomage, FNAL). Le montant
  // global est affiche comme une seule ligne patronale negative.
  // IMPERFECTION CONNUE du proto mono-bulletin (a corriger avec les cumuls
  // annuels, ne PAS corriger maintenant) : la RGDU se calcule sur la remuneration
  // ANNUELLE, estimee ici par brut mensuel x 12. Or le brut du mois inclut la
  // prime soumise. Une prime PONCTUELLE est donc comptee douze fois, ce qui gonfle
  // la remuneration annuelle estimee et fait baisser A TORT le coefficient RGDU du
  // mois de prime. Le vrai calcul annuel cumulatif (somme reelle des bruts de
  // l'annee) corrigera ce biais ; seul l'argument remuAnnuelle changera.
  const remuAnnuelle = brut * 12; // proto mono-bulletin, voir calculerRgdu.
  const coefficientRgdu = calculerRgdu(
    remuAnnuelle,
    bareme.rgdu.smicAnnuelRgdu,
    bareme.rgdu,
  );
  const montantAllegement = arrondirCentime(coefficientRgdu * brut);
  if (montantAllegement !== 0) {
    lignesPatronales.push({
      libelle: LIBELLES.allegementGeneral,
      base: brut,
      taux: -(coefficientRgdu * 100),
      montant: -montantAllegement,
    });
  }

  const totalRetenuesSalariales = sommeMontants(lignesSalariales);
  const totalCotisationsPatronales = sommeMontants(lignesPatronales);

  // Net social : brut moins les retenues salariales.
  const netSocial = arrondirCentime(brut - totalRetenuesSalariales);
  // Pas d'autre element (prime, absence, frais) a ce stade.
  const netAPayerAvantImpot = netSocial;

  // Cout total employeur : brut + cotisations patronales (l'allegement est deja
  // compris, en negatif, dans totalCotisationsPatronales).
  const coutTotalEmployeur = arrondirCentime(brut + totalCotisationsPatronales);

  return {
    brutTotal: brut,
    lignesBrut,
    lignesSalariales,
    lignesPatronales,
    totalRetenuesSalariales,
    totalCotisationsPatronales,
    allegementCotisations: montantAllegement,
    netSocial,
    netAPayerAvantImpot,
    coutTotalEmployeur,
  };
}
