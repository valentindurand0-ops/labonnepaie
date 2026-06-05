// Types du moteur de calcul de paie.
// Module PUR : aucun import React, DOM ou Supabase ici.

// Statut du salarie (couche salarie).
export type Statut = "cadre" | "etam";

// --- FORMAT D'ENTREE : les 4 couches de donnees ---

// Couche 1 : reference du bareme legal a appliquer (versionne par date).
export interface EntreeLegal {
  // Reference d'un bareme date, ex "syntec-2026-06".
  bareme: string;
}

// Couche 2 : donnees entreprise.
export interface EntreeEntreprise {
  // Taux AT/MP en pourcentage, ex 1.4. Engage la conformite : jamais de valeur
  // par defaut silencieuse, c'est l'entreprise qui le fournit (CARSAT).
  tauxAtMp: number;
}

// Couche 3 : donnees salarie / contrat.
export interface EntreeSalarie {
  statut: Statut;
  // Salaire de base brut mensuel en euros.
  brutMensuel: number;
  // Part patronale de la mutuelle en euros (defaut 0). Reintegree a 100 % dans
  // l'assiette CSG/CRDS. A VALIDER par expert-comptable.
  mutuellePartPatronale?: number;
  // Part salariale de la mutuelle en euros (defaut 0). Reservee pour une future
  // ligne de retenue (non encore deduite du net a ce stade du proto).
  // A VALIDER par expert-comptable.
  mutuellePartSalariale?: number;
}

// Couche 4 : donnees mensuelles / variables.
export interface EntreeMensuel {
  // Nombre d'heures du mois, ex 151.67. Pas d'autre variable pour l'instant.
  heures: number;
  // Prime soumise a cotisations, en euros (defaut 0). Saisie par l'utilisateur.
  // Elle s'ajoute au salaire de base pour former le brut soumis : tout le calcul
  // (tranches T1/T2, cotisations, CSG, RGDU, net) en decoule.
  primeSoumise?: number;
}

export interface EntreeBulletin {
  legal: EntreeLegal;
  entreprise: EntreeEntreprise;
  salarie: EntreeSalarie;
  mensuel: EntreeMensuel;
}

// --- BAREME (couche 1, versionne par date d'application) ---

// Assiette d'une ligne de cotisation. Le moteur derive le montant a partir du
// brut et des tranches : T1 = min(brut, PMSS), T2 = max(0, brut - PMSS).
//   "brut"  -> brut entier
//   "t1"    -> T1
//   "t2"    -> T2
//   "t1t2"  -> T1 + T2 (egal au brut, sauf plafonnement eventuel)
export type Assiette = "brut" | "t1" | "t2" | "t1t2";

// Condition d'application d'une ligne, portee par la donnee (pas codee en dur).
//   "cadre"             -> ligne appliquee seulement si statut cadre
//   "nonCadre"          -> ligne appliquee seulement si statut etam
//   "brutSuperieurPmss" -> ligne appliquee seulement si brut > PMSS (ex CET)
export type Condition = "cadre" | "nonCadre" | "brutSuperieurPmss";

// Une ligne declarative du bareme. Le moteur de calcul est generique : il itere
// sur ces lignes et applique l'assiette. Aucune assiette n'est codee en dur dans
// calcul.ts. Tous les taux sont en pourcentage (ex 6.90 pour 6,90 %).
export interface LigneBareme {
  libelle: string;
  assiette: Assiette;
  // Taux salarial en pourcentage (peut etre 0 : ligne purement patronale).
  tauxSalarial: number;
  // Taux patronal en pourcentage (peut etre 0 : ligne purement salariale).
  tauxPatronal: number;
  // Condition optionnelle portee par la donnee (voir type Condition).
  condition?: Condition;
  // Plafonnement de l'assiette exprime en nombre de PMSS (ex 4 pour le chomage
  // et l'AGS, plafonnes a 4 PMSS).
  plafondPmss?: number;
  // Si vrai, le taux patronal effectif est le taux AT/MP saisi par l'entreprise
  // (EntreeEntreprise.tauxAtMp), et non le tauxPatronal du bareme.
  tauxPatronalDepuisEntreprise?: boolean;
  // Si vrai, la part patronale de cette ligne est reintegree a 100 % dans
  // l'assiette CSG/CRDS (ex prevoyance).
  reintegrerCsg?: boolean;
  // Si "csgCrds", la base n'est pas derivee de l'assiette ci-dessus mais de
  // l'assiette CSG/CRDS legale calculee par le moteur (voir calcul.ts).
  baseSpeciale?: "csgCrds";
}

// Parametres du calcul de la reduction generale degressive (RGDU / ex Fillon).
// Tous A VALIDER par expert-comptable.
export interface ParamsRgdu {
  // Coefficient minimum, ex 0.0200.
  tmin: number;
  // Coefficient delta (entreprise de moins de 50 salaries, FNAL 0.10 %),
  // ex 0.3781.
  tdelta: number;
  // Exposant de la formule, ex 1.75.
  p: number;
  // SMIC annuel de reference pour la RGDU. Gele a 12.02 EUR pour 2026, distinct
  // du SMIC reel (12.31 EUR). Calcul : 151.67 * 12.02 * 12.
  smicAnnuelRgdu: number;
}

export interface Bareme {
  reference: string;
  // Date d'application au format ISO (AAAA-MM-JJ).
  dateApplication: string;
  // Plafond mensuel de la securite sociale en euros (ex 4005).
  pmss: number;
  // Lignes declaratives de cotisation (voir LigneBareme).
  lignes: LigneBareme[];
  // Parametres de la reduction generale degressive.
  rgdu: ParamsRgdu;
}

// --- FORMAT DE SORTIE : le bulletin calcule ---

export interface LigneCotisation {
  libelle: string;
  // Base de calcul en euros.
  base: number;
  // Taux applique en pourcentage.
  taux: number;
  // Montant en euros, arrondi au centime.
  montant: number;
}

// Element constitutif du brut (un gain, pas une retenue) : salaire de base,
// prime soumise, etc. La somme des montants est egale au brut soumis.
export interface LigneGain {
  libelle: string;
  // Montant en euros, arrondi au centime.
  montant: number;
}

export interface BulletinCalcule {
  brutTotal: number;
  // Composition du brut soumis (salaire de base + primes soumises). La somme des
  // montants est egale a brutTotal.
  lignesBrut: LigneGain[];
  lignesSalariales: LigneCotisation[];
  lignesPatronales: LigneCotisation[];
  totalRetenuesSalariales: number;
  totalCotisationsPatronales: number;
  // Montant de l'allegement general (positif), egalement present comme ligne
  // patronale negative dans lignesPatronales.
  allegementCotisations: number;
  netSocial: number;
  netAPayerAvantImpot: number;
  coutTotalEmployeur: number;
}
