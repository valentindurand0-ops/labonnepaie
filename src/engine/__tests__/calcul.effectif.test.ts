// Temoin EFFECTIF >= 50 : oracle du rebranchement de l'effectif dans le moteur.
//
// Le moteur derive desormais deux regles depuis l'effectif recu dans l'entree plate
// (jamais lu ailleurs) :
//   - FNAL patronal : 0,10 % sous le seuil, 0,50 % au seuil (50) et au-dela ;
//   - Tdelta de la RGDU : 0,3781 sous le seuil, 0,3821 au seuil et au-dela.
// Le seuil (50) et les taux/Tdelta sont portes par le bareme versionne (source
// unique, voir syntec-2026-06.ts) ; le moteur ne fait que CHOISIR selon l'effectif.
//
// Cas : cadre 4000, effectif 50, AT/MP 1,00 %, mutuelle 0/0, bareme syntec-2026-06.
// Calcul detaille et valide avant figement :
//   smicAnnuelRgdu = 151,67 * 12,02 * 12 = 21876,8808 (SMIC RGDU GELE 12,02, pas
//     le SMIC reel 12,31).
//   ratio = 0,5 * (3*21876,8808 / 48000 - 1) = 0,18365253
//   ratio^1,75 = 0,05152289
//   C = 0,02 + 0,3821 * 0,05152289 = 0,03968690 -> arrondi 0,0397
//     (avec l'ancien Tdelta 0,3781 on retrouve 0,0395 : seul Tdelta change).
//   reduction RGDU = 0,0397 * 4000 = 158,80 ; FNAL = 4000 * 0,50 % = 20,00.
// Les agregats sont confrontes au temoin cadre 4000 effectif < 50
// (calcul.temoins.test.ts) : net et retenues salariales INCHANGES (FNAL et RGDU
// sont patronaux), cotisations patronales et cout employeur en hausse.

import { describe, it, expect } from "vitest";
import { calculerBulletin, LIBELLES } from "../calcul";
import { baremeSyntec202606 } from "../baremes/syntec-2026-06";
import type { BulletinCalcule, EntreeBulletin, LigneCotisation } from "../types";

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

// Cadre 4000, effectif 50 (>= seuil). Seul l'effectif change par rapport au temoin
// cadre 4000 fige dans calcul.temoins.test.ts (qui est a effectif 10).
const entree50: EntreeBulletin = {
  legal: { bareme: "syntec-2026-06" },
  entreprise: { tauxAtMp: 1.0, effectif: 50 },
  salarie: {
    statut: "cadre",
    brutMensuel: 4000,
    mutuellePartPatronale: 0,
    mutuellePartSalariale: 0,
  },
  mensuel: { heures: 151.67 },
};

// Le meme cadre 4000 a effectif < 50, pour prouver la NON-regression du net et
// l'isolement de l'effet effectif aux seules lignes patronales concernees.
const entree10: EntreeBulletin = {
  ...entree50,
  entreprise: { tauxAtMp: 1.0, effectif: 10 },
};

describe("temoin effectif >= 50 : cadre 4000 a 50 salaries", () => {
  const b = calculerBulletin(entree50, baremeSyntec202606);

  it("FNAL patronal passe a 0,50 % (montant 20,00 sur base 4000)", () => {
    const fnal = ligne(b.lignesPatronales, LIBELLES.fnal);
    expect(fnal?.taux).toBe(0.5);
    expect(fnal?.base).toBe(4000);
    expect(fnal?.montant).toBe(20.0);
  });

  it("coefficient RGDU recalcule avec Tdelta 0,3821 = 0,0397", () => {
    expect(coefficientRgdu(b)).toBe(0.0397);
  });

  it("reduction generale = 158,80 (0,0397 * 4000)", () => {
    expect(b.allegementCotisations).toBe(158.8);
    expect(ligne(b.lignesPatronales, LIBELLES.allegementGeneral)?.montant).toBe(
      -158.8,
    );
  });

  it("cotisations patronales = 1527,44", () => {
    expect(b.totalCotisationsPatronales).toBe(1527.44);
  });

  it("cout total employeur = 5527,44", () => {
    expect(b.coutTotalEmployeur).toBe(5527.44);
  });

  it("net social et retenues salariales INCHANGES (effet patronal seulement)", () => {
    expect(b.netSocial).toBe(3159.61);
    expect(b.totalRetenuesSalariales).toBe(840.39);
  });

  it("assiette CSG inchangee (3990), independante du FNAL et de la RGDU", () => {
    expect(ligne(b.lignesSalariales, LIBELLES.csgDeductible)?.base).toBe(3990);
  });
});

describe("effectif 50 vs effectif 10 : seules les lignes patronales bougent", () => {
  const grand = calculerBulletin(entree50, baremeSyntec202606);
  const petit = calculerBulletin(entree10, baremeSyntec202606);

  it("le FNAL passe de 0,10 % a 0,50 %", () => {
    expect(ligne(petit.lignesPatronales, LIBELLES.fnal)?.taux).toBe(0.1);
    expect(ligne(grand.lignesPatronales, LIBELLES.fnal)?.taux).toBe(0.5);
  });

  it("le coefficient RGDU passe de 0,0395 a 0,0397", () => {
    expect(coefficientRgdu(petit)).toBe(0.0395);
    expect(coefficientRgdu(grand)).toBe(0.0397);
  });

  it("net social identique (3159,61) dans les deux cas", () => {
    expect(grand.netSocial).toBe(petit.netSocial);
    expect(grand.netSocial).toBe(3159.61);
  });

  it("cout employeur strictement superieur a effectif >= 50", () => {
    expect(grand.coutTotalEmployeur).toBeGreaterThan(petit.coutTotalEmployeur);
    expect(petit.coutTotalEmployeur).toBe(5512.24);
    expect(grand.coutTotalEmployeur).toBe(5527.44);
  });
});
