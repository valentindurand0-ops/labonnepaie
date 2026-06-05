import type { Bareme } from "../types";
import { LIBELLES } from "../calcul";

// Bareme Syntec applicable a partir du 2026-06-01 (revalorisation du SMIC reel
// au 1er juin 2026). Barreme en lignes declaratives : chaque ligne porte son
// assiette, ses taux salarial/patronal et une eventuelle condition.
//
// IMPORTANT : chaque valeur chiffree est "A VALIDER par expert-comptable".
// Aucune ne doit etre consideree comme exacte sans verification contre une
// source officielle (URSSAF / BOSS / avenant Syntec). Les montants exacts du
// bulletin restent a figer apres validation visuelle d'un bulletin de reference.
export const baremeSyntec202606: Bareme = {
  reference: "syntec-2026-06",
  dateApplication: "2026-06-01",

  // Plafond mensuel de la securite sociale. A VALIDER par expert-comptable.
  pmss: 4005,

  // Seuil d'effectif "50 salaries" : ecrit UNE SEULE FOIS ici. Sert au taux FNAL
  // (ligne ci-dessous) et au Tdelta de la RGDU. A VALIDER par expert-comptable.
  seuilEffectif: 50,

  lignes: [
    // --- Vieillesse (securite sociale) ---
    {
      libelle: LIBELLES.vieillessePlafonnee,
      assiette: "t1",
      tauxSalarial: 6.9, // A VALIDER par expert-comptable
      tauxPatronal: 8.55, // A VALIDER par expert-comptable
    },
    {
      libelle: LIBELLES.vieillesseDeplafonnee,
      assiette: "brut",
      tauxSalarial: 0.4, // A VALIDER par expert-comptable
      tauxPatronal: 2.11, // A VALIDER par expert-comptable
    },

    // --- Maladie et famille (patronales) ---
    {
      libelle: LIBELLES.maladie,
      assiette: "brut",
      tauxSalarial: 0,
      tauxPatronal: 13.0, // A VALIDER par expert-comptable
    },
    {
      libelle: LIBELLES.famille,
      assiette: "brut",
      tauxSalarial: 0,
      tauxPatronal: 5.25, // A VALIDER par expert-comptable
    },

    // --- Retraite complementaire Agirc-Arrco ---
    {
      libelle: LIBELLES.retraiteT1,
      assiette: "t1",
      tauxSalarial: 3.15, // A VALIDER par expert-comptable
      tauxPatronal: 4.72, // A VALIDER par expert-comptable
    },
    {
      libelle: LIBELLES.retraiteT2,
      assiette: "t2",
      tauxSalarial: 8.64, // A VALIDER par expert-comptable
      tauxPatronal: 12.95, // A VALIDER par expert-comptable
    },

    // --- Contribution d'equilibre general (CEG) ---
    {
      libelle: LIBELLES.cegT1,
      assiette: "t1",
      tauxSalarial: 0.86, // A VALIDER par expert-comptable
      tauxPatronal: 1.29, // A VALIDER par expert-comptable
    },
    {
      libelle: LIBELLES.cegT2,
      assiette: "t2",
      tauxSalarial: 1.08, // A VALIDER par expert-comptable
      tauxPatronal: 1.62, // A VALIDER par expert-comptable
    },

    // --- Contribution d'equilibre technique (CET) : uniquement si brut > PMSS ---
    {
      libelle: LIBELLES.cet,
      assiette: "t1t2",
      tauxSalarial: 0.14, // A VALIDER par expert-comptable
      tauxPatronal: 0.21, // A VALIDER par expert-comptable
      condition: "brutSuperieurPmss",
    },

    // --- APEC : cadres uniquement ---
    {
      libelle: LIBELLES.apec,
      assiette: "t1t2",
      tauxSalarial: 0.024, // A VALIDER par expert-comptable
      tauxPatronal: 0.036, // A VALIDER par expert-comptable
      condition: "cadre",
    },

    // --- Assurance chomage et AGS : assiette plafonnee a 4 PMSS ---
    {
      libelle: LIBELLES.chomage,
      assiette: "t1t2",
      tauxSalarial: 0, // chomage salarial supprime : 0 %
      tauxPatronal: 4.0, // A VALIDER par expert-comptable
      plafondPmss: 4,
    },
    {
      libelle: LIBELLES.ags,
      assiette: "t1t2",
      tauxSalarial: 0,
      tauxPatronal: 0.2, // A VALIDER par expert-comptable
      plafondPmss: 4,
    },

    // --- AT/MP : taux saisi par l'entreprise (CARSAT) ---
    {
      libelle: LIBELLES.atMp,
      assiette: "brut",
      tauxSalarial: 0,
      tauxPatronal: 0, // remplace par EntreeEntreprise.tauxAtMp
      tauxPatronalDepuisEntreprise: true,
    },

    // --- FNAL : taux selon l'effectif (seuil seuilEffectif ci-dessus) ---
    // 0.10 % sous le seuil, 0.50 % au seuil et au-dela. Ces deux taux ne sont
    // ecrits QUE LA, dans cette ligne du bareme versionne. A VALIDER expert-comptable.
    {
      libelle: LIBELLES.fnal,
      assiette: "brut",
      tauxSalarial: 0,
      tauxPatronal: 0.1, // effectif < seuilEffectif - A VALIDER par expert-comptable
      tauxPatronalAuSeuilEffectif: 0.5, // effectif >= seuilEffectif - A VALIDER
    },

    // --- Prevoyance Syntec (conventionnel, parametrable) ---
    // Cadre : 1.50 % patronal pur sur T1, reintegre dans l'assiette CSG.
    {
      libelle: LIBELLES.prevoyanceCadre,
      assiette: "t1",
      tauxSalarial: 0,
      tauxPatronal: 1.5, // A VALIDER par expert-comptable
      condition: "cadre",
      reintegrerCsg: true,
    },
    // Non cadre (ETAM) : 0.125 % salarial + 0.125 % patronal sur le brut.
    {
      libelle: LIBELLES.prevoyanceNonCadre,
      assiette: "brut",
      tauxSalarial: 0.125, // A VALIDER par expert-comptable
      tauxPatronal: 0.125, // A VALIDER par expert-comptable
      condition: "nonCadre",
      reintegrerCsg: true,
    },

    // --- CSG / CRDS : assiette legale calculee par le moteur (baseSpeciale) ---
    {
      libelle: LIBELLES.csgDeductible,
      assiette: "brut", // ignore : base = assiette CSG/CRDS legale
      tauxSalarial: 6.8, // A VALIDER par expert-comptable
      tauxPatronal: 0,
      baseSpeciale: "csgCrds",
    },
    {
      libelle: LIBELLES.csgCrdsNonDeductible,
      assiette: "brut", // ignore : base = assiette CSG/CRDS legale
      tauxSalarial: 2.9, // A VALIDER par expert-comptable
      tauxPatronal: 0,
      baseSpeciale: "csgCrds",
    },
  ],

  // Reduction generale degressive (RGDU). Tous parametres A VALIDER.
  rgdu: {
    tmin: 0.02, // A VALIDER par expert-comptable
    tdelta: 0.3781, // effectif < seuilEffectif, FNAL 0.10 % - A VALIDER
    tdeltaAuSeuilEffectif: 0.3821, // effectif >= seuilEffectif, FNAL 0.50 % - A VALIDER
    p: 1.75, // A VALIDER par expert-comptable
    // SMIC RGDU gele a 12.02 EUR pour 2026 (distinct du SMIC reel a 12.31).
    smicAnnuelRgdu: 151.67 * 12.02 * 12, // A VALIDER par expert-comptable
  },
};
