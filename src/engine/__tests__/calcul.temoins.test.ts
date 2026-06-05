// Tests TEMOINS : montants figes apres validation visuelle de trois bulletins de
// reference (cadre 4000, ETAM 4000, cadre 4500). Valeurs verifiees AU CENTIME.
//
// Parametres communs : entreprise de moins de 50 salaries, taux AT/MP 1,00 %,
// mutuelle part patronale 0, mutuelle part salariale 0, prevoyance aux valeurs
// par defaut du bareme, bareme Syntec 2026 par defaut (syntec-2026-06).
//
// NOTE IMPORTANTE sur le taux AT/MP (A VALIDER) : le 1,00 % utilise ici est une
// VALEUR DE TEST, et non une regle legale. Le taux AT/MP n'a pas de valeur
// universelle : c'est une donnee propre a CHAQUE entreprise, notifiee chaque
// annee par la CARSAT. Dans le produit final, le chef d'entreprise la saisit
// dans son espace entreprise (couche 2) ; le moteur la lit via
// EntreeEntreprise.tauxAtMp. Ne jamais traiter ce 1,00 % comme un defaut legal.

import { describe, it, expect } from "vitest";
import { calculerBulletin, LIBELLES } from "../calcul";
import { baremeSyntec202606 } from "../baremes/syntec-2026-06";
import type {
  Assiette,
  BulletinCalcule,
  EntreeBulletin,
  LigneCotisation,
} from "../types";

const PMSS = baremeSyntec202606.pmss; // 4005

// Construit une entree avec les parametres communs imposes.
function entree(statut: "cadre" | "etam", brutMensuel: number): EntreeBulletin {
  return {
    legal: { bareme: "syntec-2026-06" },
    entreprise: { tauxAtMp: 1.0, effectif: 10 }, // < 50 : temoins a effectif faible
    salarie: {
      statut,
      brutMensuel,
      mutuellePartPatronale: 0,
      mutuellePartSalariale: 0,
    },
    mensuel: { heures: 151.67 },
  };
}

// Recupere une ligne par son libelle, ou undefined si absente.
function ligne(
  lignes: LigneCotisation[],
  libelle: string,
): LigneCotisation | undefined {
  return lignes.find((l) => l.libelle === libelle);
}

// Coefficient RGDU reconstruit depuis la ligne d'allegement (taux = -(coeff*100)).
function coefficientRgdu(b: BulletinCalcule): number {
  const al = ligne(b.lignesPatronales, LIBELLES.allegementGeneral);
  return al ? Math.round((-al.taux / 100) * 10000) / 10000 : 0;
}

// Base de l'assiette CSG (lue sur la ligne CSG deductible).
function assietteCsg(b: BulletinCalcule): number | undefined {
  return ligne(b.lignesSalariales, LIBELLES.csgDeductible)?.base;
}

describe("temoin cas 1 : cadre 4000 (AT/MP 1,00 %)", () => {
  const b = calculerBulletin(entree("cadre", 4000), baremeSyntec202606);

  it("total retenues salariales = 840,39", () => {
    expect(b.totalRetenuesSalariales).toBe(840.39);
  });
  it("net social = 3159,61", () => {
    expect(b.netSocial).toBe(3159.61);
  });
  it("total cotisations patronales = 1512,24", () => {
    expect(b.totalCotisationsPatronales).toBe(1512.24);
  });
  it("cout total employeur = 5512,24", () => {
    expect(b.coutTotalEmployeur).toBe(5512.24);
  });
  it("coefficient RGDU = 0,0395 et montant allegement = 158,00", () => {
    expect(coefficientRgdu(b)).toBe(0.0395);
    expect(b.allegementCotisations).toBe(158.0);
    expect(ligne(b.lignesPatronales, LIBELLES.allegementGeneral)?.montant).toBe(
      -158.0,
    );
  });
  it("assiette CSG = 3990", () => {
    expect(assietteCsg(b)).toBe(3990);
  });
});

describe("temoin cas 2 : ETAM 4000 (AT/MP 1,00 %)", () => {
  const b = calculerBulletin(entree("etam", 4000), baremeSyntec202606);

  it("total retenues salariales = 839,10", () => {
    expect(b.totalRetenuesSalariales).toBe(839.1);
  });
  it("net social = 3160,90", () => {
    expect(b.netSocial).toBe(3160.9);
  });
  it("total cotisations patronales = 1455,80", () => {
    expect(b.totalCotisationsPatronales).toBe(1455.8);
  });
  it("cout total employeur = 5455,80", () => {
    expect(b.coutTotalEmployeur).toBe(5455.8);
  });
  it("coefficient RGDU = 0,0395 et montant allegement = 158,00", () => {
    expect(coefficientRgdu(b)).toBe(0.0395);
    expect(b.allegementCotisations).toBe(158.0);
    expect(ligne(b.lignesPatronales, LIBELLES.allegementGeneral)?.montant).toBe(
      -158.0,
    );
  });
  it("assiette CSG = 3935", () => {
    expect(assietteCsg(b)).toBe(3935);
  });
});

describe("temoin cas 3 : cadre 4500 (AT/MP 1,00 %)", () => {
  const b = calculerBulletin(entree("cadre", 4500), baremeSyntec202606);

  it("T1 = 4005 et T2 = 495", () => {
    // T1 = base de la vieillesse plafonnee ; T2 = base de la retraite compl. T2.
    expect(ligne(b.lignesSalariales, LIBELLES.vieillessePlafonnee)?.base).toBe(4005);
    expect(ligne(b.lignesSalariales, LIBELLES.retraiteT2)?.base).toBe(495);
  });
  it("total retenues salariales = 945,14", () => {
    expect(b.totalRetenuesSalariales).toBe(945.14);
  });
  it("net social = 3554,86", () => {
    expect(b.netSocial).toBe(3554.86);
  });
  it("total cotisations patronales = 1756,45", () => {
    expect(b.totalCotisationsPatronales).toBe(1756.45);
  });
  it("cout total employeur = 6256,45", () => {
    expect(b.coutTotalEmployeur).toBe(6256.45);
  });
  it("coefficient RGDU = 0,0277 et montant allegement = 124,65", () => {
    expect(coefficientRgdu(b)).toBe(0.0277);
    expect(b.allegementCotisations).toBe(124.65);
    expect(ligne(b.lignesPatronales, LIBELLES.allegementGeneral)?.montant).toBe(
      -124.65,
    );
  });
  it("ligne CET presente : salarial 0,14 % et patronal 0,21 %", () => {
    expect(ligne(b.lignesSalariales, LIBELLES.cet)?.taux).toBe(0.14);
    expect(ligne(b.lignesPatronales, LIBELLES.cet)?.taux).toBe(0.21);
  });
  it("assiette CSG = 4481,33", () => {
    expect(assietteCsg(b)).toBe(4481.33);
  });
});

// --- Invariants structurels generaux : valables pour TOUT bulletin ---

describe("invariants generaux sur les trois cas temoins", () => {
  const cas: ReadonlyArray<readonly ["cadre" | "etam", number]> = [
    ["cadre", 4000],
    ["etam", 4000],
    ["cadre", 4500],
  ];

  const assiettesConnues: ReadonlySet<Assiette> = new Set([
    "brut",
    "t1",
    "t2",
    "t1t2",
  ]);

  for (const [statut, brut] of cas) {
    const b = calculerBulletin(entree(statut, brut), baremeSyntec202606);

    it(`${statut} ${brut} : net = brut - total retenues salariales`, () => {
      const attendu =
        Math.round((brut - b.totalRetenuesSalariales) * 100) / 100;
      expect(b.netSocial).toBe(attendu);
    });

    it(`${statut} ${brut} : T1 + T2 = brut`, () => {
      const t1 = Math.min(brut, PMSS);
      const t2 = Math.max(0, brut - PMSS);
      expect(t1 + t2).toBe(brut);
    });
  }

  it("aucune ligne du bareme n'a une assiette inconnue", () => {
    for (const l of baremeSyntec202606.lignes) {
      expect(assiettesConnues.has(l.assiette)).toBe(true);
    }
  });
});
