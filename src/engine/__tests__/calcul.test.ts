// Tests STRUCTURELS du moteur recode sur base legale 2026 (tranches T1/T2, RGDU,
// CSG legale). On NE fige aucun montant exact pour l'instant : les valeurs seront
// gelees plus tard, apres validation visuelle d'un bulletin de reference. On
// verifie ici la STRUCTURE : presence des bonnes lignes, bonnes assiettes, et les
// invariants (net = brut - retenues, T1 + T2 = brut, lignes T2 nulles sous PMSS).

import { describe, it, expect } from "vitest";
import { calculerBulletin, calculerRgdu, LIBELLES } from "../calcul";
import { baremeSyntec202606 } from "../baremes/syntec-2026-06";
import type { EntreeBulletin, LigneCotisation } from "../types";

const PMSS = baremeSyntec202606.pmss;

// Recupere une ligne par son libelle, ou undefined si absente.
function ligne(
  lignes: LigneCotisation[],
  libelle: string,
): LigneCotisation | undefined {
  return lignes.find((l) => l.libelle === libelle);
}

// Somme des montants d'une liste de lignes.
function sommeMontants(lignes: LigneCotisation[]): number {
  return Math.round(lignes.reduce((t, l) => t + l.montant, 0) * 100) / 100;
}

function entree(
  statut: "cadre" | "etam",
  brutMensuel: number,
  extra: Partial<EntreeBulletin["salarie"]> = {},
): EntreeBulletin {
  return {
    legal: { bareme: "syntec-2026-06" },
    entreprise: { tauxAtMp: 1.4 },
    salarie: { statut, brutMensuel, ...extra },
    mensuel: { heures: 151.67 },
  };
}

describe("structure cadre 4000 (brut < PMSS, T2 = 0)", () => {
  const b = calculerBulletin(entree("cadre", 4000), baremeSyntec202606);

  it("brutTotal = 4000", () => {
    expect(b.brutTotal).toBe(4000);
  });

  it("vieillesse plafonnee : assiette T1 (base 4000)", () => {
    const l = ligne(b.lignesSalariales, LIBELLES.vieillessePlafonnee);
    expect(l?.base).toBe(4000);
  });

  it("vieillesse deplafonnee : assiette brut (base 4000)", () => {
    const l = ligne(b.lignesSalariales, LIBELLES.vieillesseDeplafonnee);
    expect(l?.base).toBe(4000);
  });

  it("retraite et CEG T1 presents", () => {
    expect(ligne(b.lignesSalariales, LIBELLES.retraiteT1)).toBeDefined();
    expect(ligne(b.lignesSalariales, LIBELLES.cegT1)).toBeDefined();
  });

  it("APEC presente (cadre), prevoyance cadre presente (patronale)", () => {
    expect(ligne(b.lignesSalariales, LIBELLES.apec)).toBeDefined();
    expect(ligne(b.lignesPatronales, LIBELLES.prevoyanceCadre)).toBeDefined();
  });

  it("aucune prevoyance non cadre", () => {
    expect(ligne(b.lignesSalariales, LIBELLES.prevoyanceNonCadre)).toBeUndefined();
    expect(ligne(b.lignesPatronales, LIBELLES.prevoyanceNonCadre)).toBeUndefined();
  });

  it("aucune ligne CET sous le PMSS", () => {
    expect(ligne(b.lignesSalariales, LIBELLES.cet)).toBeUndefined();
    expect(ligne(b.lignesPatronales, LIBELLES.cet)).toBeUndefined();
  });

  it("assiette CSG legale : 0.9825*4000 + prevoyance cadre patronale (60) = 3990", () => {
    const l = ligne(b.lignesSalariales, LIBELLES.csgDeductible);
    expect(l?.base).toBe(3990);
  });

  it("net = brut - somme des retenues salariales", () => {
    const net = Math.round((4000 - sommeMontants(b.lignesSalariales)) * 100) / 100;
    expect(b.netSocial).toBe(net);
  });

  it("allegement RGDU present comme ligne patronale negative", () => {
    const l = ligne(b.lignesPatronales, LIBELLES.allegementGeneral);
    expect(l).toBeDefined();
    expect(l!.montant).toBeLessThan(0);
    expect(b.allegementCotisations).toBeGreaterThan(0);
  });
});

describe("structure ETAM 4000", () => {
  const b = calculerBulletin(entree("etam", 4000), baremeSyntec202606);

  it("prevoyance non cadre presente (salariale ET patronale)", () => {
    expect(ligne(b.lignesSalariales, LIBELLES.prevoyanceNonCadre)).toBeDefined();
    expect(ligne(b.lignesPatronales, LIBELLES.prevoyanceNonCadre)).toBeDefined();
  });

  it("aucune APEC ni prevoyance cadre", () => {
    expect(ligne(b.lignesSalariales, LIBELLES.apec)).toBeUndefined();
    expect(ligne(b.lignesPatronales, LIBELLES.apec)).toBeUndefined();
    expect(ligne(b.lignesPatronales, LIBELLES.prevoyanceCadre)).toBeUndefined();
  });

  it("assiette CSG : 3930 + prevoyance etam patronale (5) = 3935", () => {
    const l = ligne(b.lignesSalariales, LIBELLES.csgDeductible);
    expect(l?.base).toBe(3935);
  });

  it("net = brut - somme des retenues salariales", () => {
    const net = Math.round((4000 - sommeMontants(b.lignesSalariales)) * 100) / 100;
    expect(b.netSocial).toBe(net);
  });
});

describe("invariant tranches : T1 + T2 = brut", () => {
  it("brut sous le PMSS : T1 = brut, T2 = 0, lignes T2 a 0", () => {
    const b = calculerBulletin(entree("cadre", 4000), baremeSyntec202606);
    // T1 = vieillesse plafonnee, base 4000 ; T2 = 0 -> retraite/CEG T2 nuls.
    const retraiteT2 = ligne(b.lignesSalariales, LIBELLES.retraiteT2);
    const cegT2 = ligne(b.lignesSalariales, LIBELLES.cegT2);
    expect(retraiteT2?.base ?? 0).toBe(0);
    expect(retraiteT2?.montant ?? 0).toBe(0);
    expect(cegT2?.base ?? 0).toBe(0);
    expect(cegT2?.montant ?? 0).toBe(0);
  });

  it("brut au-dessus du PMSS (4500) : T2 > 0, retraite T2 et CET apparaissent", () => {
    const b = calculerBulletin(entree("cadre", 4500), baremeSyntec202606);
    const t2 = 4500 - PMSS; // 495
    expect(t2).toBeGreaterThan(0);

    const retraiteT2 = ligne(b.lignesSalariales, LIBELLES.retraiteT2);
    expect(retraiteT2?.base).toBe(t2);
    expect(retraiteT2!.montant).toBeGreaterThan(0);

    const cet = ligne(b.lignesSalariales, LIBELLES.cet);
    expect(cet).toBeDefined();
    expect(cet?.base).toBe(4500); // t1t2 = T1 + T2 = brut
    expect(cet!.montant).toBeGreaterThan(0);

    // Invariant : la base T1 (vieillesse plafonnee) + T2 = brut.
    const vieillesseT1 = ligne(b.lignesSalariales, LIBELLES.vieillessePlafonnee);
    expect((vieillesseT1?.base ?? 0) + (retraiteT2?.base ?? 0)).toBe(4500);
  });
});

describe("mutuelle patronale reintegree dans l'assiette CSG", () => {
  it("une part patronale mutuelle augmente la base CSG d'autant", () => {
    const sans = calculerBulletin(entree("cadre", 4000), baremeSyntec202606);
    const avec = calculerBulletin(
      entree("cadre", 4000, { mutuellePartPatronale: 40 }),
      baremeSyntec202606,
    );
    const baseSans = ligne(sans.lignesSalariales, LIBELLES.csgDeductible)?.base ?? 0;
    const baseAvec = ligne(avec.lignesSalariales, LIBELLES.csgDeductible)?.base ?? 0;
    expect(baseAvec).toBe(baseSans + 40);
  });
});

describe("calculerRgdu : garde-fous", () => {
  const { tmin, tdelta, p, smicAnnuelRgdu } = baremeSyntec202606.rgdu;

  it("coefficient = 0 au-dela de 3 SMIC", () => {
    expect(calculerRgdu(3 * smicAnnuelRgdu, smicAnnuelRgdu, { tmin, tdelta, p })).toBe(0);
    expect(
      calculerRgdu(3 * smicAnnuelRgdu + 1000, smicAnnuelRgdu, { tmin, tdelta, p }),
    ).toBe(0);
  });

  it("coefficient plafonne a Tmin + Tdelta (0.3981) au SMIC", () => {
    const c = calculerRgdu(smicAnnuelRgdu, smicAnnuelRgdu, { tmin, tdelta, p });
    expect(c).toBe(Math.round((tmin + tdelta) * 10000) / 10000);
    expect(c).toBe(0.3981);
  });

  it("coefficient strictement positif entre 1 et 3 SMIC", () => {
    const c = calculerRgdu(2 * smicAnnuelRgdu, smicAnnuelRgdu, { tmin, tdelta, p });
    expect(c).toBeGreaterThan(0);
    expect(c).toBeLessThan(tmin + tdelta);
  });
});
