// Types du moteur de calcul de paie.
// Module PUR : aucun import React, DOM ou Supabase ici.

// Statut du salarie (couche salarie).
export type Statut = "cadre" | "etam";

// --- FORMAT D'ENTREE : les 4 couches de donnees ---

// Couche 1 : reference du bareme legal a appliquer (versionne par date).
export interface EntreeLegal {
  // Reference d'un bareme date, ex "syntec-2026-01".
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
}

// Couche 4 : donnees mensuelles / variables.
export interface EntreeMensuel {
  // Nombre d'heures du mois, ex 151.67. Pas d'autre variable pour l'instant.
  heures: number;
}

export interface EntreeBulletin {
  legal: EntreeLegal;
  entreprise: EntreeEntreprise;
  salarie: EntreeSalarie;
  mensuel: EntreeMensuel;
}

// --- BAREME (couche 1, versionne par date d'application) ---

// Tous les taux sont exprimes en pourcentage (ex 6.90 pour 6,90 %).
export interface BaremeSalariales {
  ssDeplafonnee: number;
  ssPlafonnee: number;
  retraiteComplTrancheA: number;
  chomageApec: number;
  // Prevoyance non cadre Tranche A, part salariale (ne s'applique qu'aux etam).
  prevoyanceNonCadreTrancheA: number;
  csgNonImposable: number;
  csgCrdsImposable: number;
  // Facteur d'abattement de la base CSG/CRDS pour un cadre, ex 0.9975.
  abattementCsg: number;
  // Facteur d'abattement de la base CSG/CRDS pour un non cadre (etam).
  // Cale sur SimulPaie, voir commentaire dans calcul.ts (assiette a confirmer).
  abattementCsgNonCadre: number;
}

export interface BaremePatronales {
  santeMaladie: number;
  prevoyanceCadreTrancheA: number;
  // Prevoyance non cadre Tranche A, part patronale (ne s'applique qu'aux etam).
  prevoyanceNonCadreTrancheA: number;
  ssDeplafonnee: number;
  ssPlafonnee: number;
  retraiteComplTrancheA: number;
  famille: number;
  assuranceChomage: number;
  chomageAgs: number;
  apec: number;
  autresContributions: number;
}

export interface Bareme {
  reference: string;
  // Date d'application au format ISO (AAAA-MM-JJ).
  dateApplication: string;
  salariales: BaremeSalariales;
  patronales: BaremePatronales;
  // Allegement general des cotisations patronales en euros.
  allegementCotisations: number;
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

export interface BulletinCalcule {
  brutTotal: number;
  lignesSalariales: LigneCotisation[];
  lignesPatronales: LigneCotisation[];
  totalRetenuesSalariales: number;
  totalCotisationsPatronales: number;
  allegementCotisations: number;
  netSocial: number;
  netAPayerAvantImpot: number;
  coutTotalEmployeur: number;
}
