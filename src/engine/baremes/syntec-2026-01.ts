import type { Bareme } from "../types";

// Bareme Syntec applicable a partir du 2026-01-01.
// IMPORTANT : chaque valeur chiffree est "A VALIDER par expert-comptable".
// Aucune ne doit etre consideree comme exacte sans verification contre une
// source officielle (URSSAF / BOSS / avenant Syntec).
export const baremeSyntec202601: Bareme = {
  reference: "syntec-2026-01",
  dateApplication: "2026-01-01",

  salariales: {
    ssDeplafonnee: 0.4, // A VALIDER par expert-comptable
    ssPlafonnee: 6.9, // A VALIDER par expert-comptable
    retraiteComplTrancheA: 4.01, // A VALIDER par expert-comptable
    chomageApec: 0.024, // A VALIDER par expert-comptable
    prevoyanceNonCadreTrancheA: 0.25, // A VALIDER par expert-comptable
    csgNonImposable: 6.8, // A VALIDER par expert-comptable
    csgCrdsImposable: 2.9, // A VALIDER par expert-comptable
    // Abattement de 0.25 % tel que vu sur SimulPaie, A VALIDER par expert-comptable
    // (le taux d'abattement legal de reference est 1.75 %).
    abattementCsg: 0.9975,
    // Abattement CSG du non cadre cale sur SimulPaie (brut x 0.985 = 3940 pour
    // 4000, soit un abattement de 1.50 %). A VALIDER par expert-comptable :
    // l'assiette reelle (reintegration de la prevoyance) est a confirmer.
    abattementCsgNonCadre: 0.985,
  },

  patronales: {
    santeMaladie: 13.0, // A VALIDER par expert-comptable
    prevoyanceCadreTrancheA: 1.5, // A VALIDER par expert-comptable
    prevoyanceNonCadreTrancheA: 0.25, // A VALIDER par expert-comptable
    ssDeplafonnee: 2.11, // A VALIDER par expert-comptable
    ssPlafonnee: 8.55, // A VALIDER par expert-comptable
    retraiteComplTrancheA: 6.01, // A VALIDER par expert-comptable
    famille: 5.25, // A VALIDER par expert-comptable
    assuranceChomage: 4.0, // A VALIDER par expert-comptable
    chomageAgs: 0.25, // A VALIDER par expert-comptable
    apec: 0.036, // A VALIDER par expert-comptable
    autresContributions: 1.546, // A VALIDER par expert-comptable
  },

  // Valeur fixe pour ce cas de test. A VALIDER par expert-comptable : en realite
  // l'allegement general est calcule par une formule dependant du brut et du SMIC.
  allegementCotisations: 158.0,
};
