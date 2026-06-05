// Test d'EQUIVALENCE pour la prime soumise generique. On ne recopie AUCUN montant :
// on verifie qu'un cadre a 4000 avec une prime soumise de 500 produit un bulletin
// rigoureusement identique au temoin cadre 4500 (deja fige au centime dans
// calcul.temoins.test.ts). Le brut soumis est le meme (4500), donc toute la
// cascade (tranches, cotisations, CSG, RGDU, net, cout) doit coincider.
//
// Parametres communs identiques au temoin : AT/MP 1,00 % (valeur de test, voir la
// note dans calcul.temoins.test.ts), mutuelle 0/0, prevoyance defaut, barème
// syntec-2026-06.

import { describe, it, expect } from "vitest";
import { calculerBulletin, LIBELLES } from "../calcul";
import { baremeSyntec202606 } from "../baremes/syntec-2026-06";
import type { EntreeBulletin, LigneCotisation } from "../types";

// Cadre 4500 sans prime : c'est le cas temoin de reference.
const temoin4500: EntreeBulletin = {
  legal: { bareme: "syntec-2026-06" },
  entreprise: { tauxAtMp: 1.0, effectif: 10 },
  salarie: {
    statut: "cadre",
    brutMensuel: 4500,
    mutuellePartPatronale: 0,
    mutuellePartSalariale: 0,
  },
  mensuel: { heures: 151.67 },
};

// Cadre 4000 + prime soumise 500 : doit donner exactement le meme brut soumis.
const cadre4000Prime500: EntreeBulletin = {
  legal: { bareme: "syntec-2026-06" },
  entreprise: { tauxAtMp: 1.0, effectif: 10 },
  salarie: {
    statut: "cadre",
    brutMensuel: 4000,
    mutuellePartPatronale: 0,
    mutuellePartSalariale: 0,
  },
  mensuel: { heures: 151.67, primeSoumise: 500 },
};

function ligne(
  lignes: LigneCotisation[],
  libelle: string,
): LigneCotisation | undefined {
  return lignes.find((l) => l.libelle === libelle);
}

describe("equivalence : cadre 4000 + prime 500 == temoin cadre 4500", () => {
  const ref = calculerBulletin(temoin4500, baremeSyntec202606);
  const avecPrime = calculerBulletin(cadre4000Prime500, baremeSyntec202606);

  it("brut total soumis identique (4500)", () => {
    expect(avecPrime.brutTotal).toBe(ref.brutTotal);
  });

  it("T1 et T2 identiques (vieillesse plafonnee = T1, retraite T2 = T2)", () => {
    expect(ligne(avecPrime.lignesSalariales, LIBELLES.vieillessePlafonnee)?.base).toBe(
      ligne(ref.lignesSalariales, LIBELLES.vieillessePlafonnee)?.base,
    );
    expect(ligne(avecPrime.lignesSalariales, LIBELLES.retraiteT2)?.base).toBe(
      ligne(ref.lignesSalariales, LIBELLES.retraiteT2)?.base,
    );
  });

  it("total retenues salariales identique", () => {
    expect(avecPrime.totalRetenuesSalariales).toBe(ref.totalRetenuesSalariales);
  });

  it("net social identique", () => {
    expect(avecPrime.netSocial).toBe(ref.netSocial);
  });

  it("total cotisations patronales identique", () => {
    expect(avecPrime.totalCotisationsPatronales).toBe(
      ref.totalCotisationsPatronales,
    );
  });

  it("cout total employeur identique", () => {
    expect(avecPrime.coutTotalEmployeur).toBe(ref.coutTotalEmployeur);
  });

  it("coefficient RGDU et montant allegement identiques", () => {
    expect(ligne(avecPrime.lignesPatronales, LIBELLES.allegementGeneral)?.taux).toBe(
      ligne(ref.lignesPatronales, LIBELLES.allegementGeneral)?.taux,
    );
    expect(avecPrime.allegementCotisations).toBe(ref.allegementCotisations);
  });

  it("assiette CSG identique", () => {
    expect(ligne(avecPrime.lignesSalariales, LIBELLES.csgDeductible)?.base).toBe(
      ligne(ref.lignesSalariales, LIBELLES.csgDeductible)?.base,
    );
  });

  it("ligne CET presente dans les deux (salarial et patronal)", () => {
    expect(ligne(avecPrime.lignesSalariales, LIBELLES.cet)).toBeDefined();
    expect(ligne(avecPrime.lignesPatronales, LIBELLES.cet)).toBeDefined();
  });
});

describe("la prime apparait comme un gain distinct dans le brut", () => {
  const avecPrime = calculerBulletin(cadre4000Prime500, baremeSyntec202606);

  it("lignesBrut = salaire de base 4000 + prime soumise 500", () => {
    const base = avecPrime.lignesBrut.find((g) => g.libelle === LIBELLES.salaireBase);
    const prime = avecPrime.lignesBrut.find((g) => g.libelle === LIBELLES.primeSoumise);
    expect(base?.montant).toBe(4000);
    expect(prime?.montant).toBe(500);
  });

  it("la somme des gains egale le brut total soumis", () => {
    const somme = avecPrime.lignesBrut.reduce((t, g) => t + g.montant, 0);
    expect(somme).toBe(avecPrime.brutTotal);
  });

  it("sans prime, aucune ligne prime n'apparait", () => {
    const ref = calculerBulletin(temoin4500, baremeSyntec202606);
    expect(
      ref.lignesBrut.find((g) => g.libelle === LIBELLES.primeSoumise),
    ).toBeUndefined();
  });
});
