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
  // Effectif (nombre de salaries), fourni par l'assembleur depuis l'entreprise.
  // Le moteur en DERIVE le taux FNAL et le Tdelta de la RGDU (seuil et valeurs
  // portes par le bareme, source unique). Le moteur ne lit jamais l'effectif
  // ailleurs que dans cette entree plate.
  effectif: number;
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
  // Nombre de jours de conges payes pris dans le mois (defaut 0). Methode du
  // MAINTIEN DE SALAIRE : le brut soumis ne bouge pas, on le decompose seulement
  // (retenue d'absence puis indemnite de conges du meme montant, somme nulle).
  // La regle du dixieme et le comparatif du plus favorable au salarie ne sont PAS
  // geres dans le proto mono-bulletin : ils viendront avec les cumuls annuels.
  joursConges?: number;
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
  // Taux patronal applique lorsque l'effectif de l'entreprise atteint le seuil
  // (Bareme.seuilEffectif). Si defini, tauxPatronal est le taux SOUS le seuil et
  // celui-ci le taux AU SEUIL et au-dela (ex FNAL : 0.10 % sous 50, 0.50 % a partir
  // de 50). C'est la SEULE ecriture de ces deux taux : ni le moteur ni le modele ne
  // les redefinissent, ils lisent cette ligne. A VALIDER par expert-comptable.
  tauxPatronalAuSeuilEffectif?: number;
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
  // Coefficient delta SOUS le seuil d'effectif (entreprise de moins de
  // Bareme.seuilEffectif salaries, FNAL 0.10 %), ex 0.3781.
  tdelta: number;
  // Coefficient delta AU SEUIL d'effectif et au-dela (FNAL 0.50 %), ex 0.3821. Le
  // moteur choisit entre tdelta et celui-ci selon l'effectif recu dans l'entree ;
  // le seuil est Bareme.seuilEffectif (source unique). A VALIDER expert-comptable.
  tdeltaAuSeuilEffectif: number;
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
  // Seuil d'effectif (nombre de salaries) qui fait basculer certaines regles
  // legales : taux FNAL (voir LigneBareme.tauxPatronalAuSeuilEffectif) et Tdelta de
  // la reduction generale (Partie 2). ECRIT UNE SEULE FOIS ici : c'est la valeur de
  // reference du seuil "50 salaries". A VALIDER par expert-comptable.
  seuilEffectif: number;
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
