// Test d'EQUIVALENCE des conges payes en methode du MAINTIEN DE SALAIRE.
//
// Principe : on ne recopie AUCUN montant. On calcule deux bulletins (cadre 4000
// sec, et cadre 4000 avec 5 jours de conges) et on assert que le second est
// rigoureusement identique au premier sur tous les agregats. Le maintien de
// salaire est neutre par construction : seule la decomposition du brut (lignesBrut)
// differe, le brut soumis et toute la cascade (cotisations, CSG, RGDU, net, cout)
// restent identiques.
//
// Parametres communs : voir calcul.temoins.test.ts (AT/MP 1,00 % valeur de test,
// mutuelle 0/0, prevoyance par defaut, bareme syntec-2026-06).

import { describe, it, expect } from "vitest";
import { calculerBulletin, LIBELLES } from "../calcul";
import { baremeSyntec202606 } from "../baremes/syntec-2026-06";
import type {
  BulletinCalcule,
  EntreeBulletin,
  LigneCotisation,
} from "../types";

function entree(joursConges: number): EntreeBulletin {
  return {
    legal: { bareme: "syntec-2026-06" },
    entreprise: { tauxAtMp: 1.0 },
    salarie: {
      statut: "cadre",
      brutMensuel: 4000,
      mutuellePartPatronale: 0,
      mutuellePartSalariale: 0,
    },
    mensuel: { heures: 151.67, joursConges },
  };
}

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

function assietteCsg(b: BulletinCalcule): number | undefined {
  return ligne(b.lignesSalariales, LIBELLES.csgDeductible)?.base;
}

describe("conges payes (maintien de salaire) : equivalence cadre 4000", () => {
  const sec = calculerBulletin(entree(0), baremeSyntec202606);
  const avecConges = calculerBulletin(entree(5), baremeSyntec202606);

  it("meme brut total", () => {
    expect(avecConges.brutTotal).toBe(sec.brutTotal);
  });
  it("memes retenues salariales", () => {
    expect(avecConges.totalRetenuesSalariales).toBe(sec.totalRetenuesSalariales);
  });
  it("meme net social", () => {
    expect(avecConges.netSocial).toBe(sec.netSocial);
  });
  it("memes cotisations patronales", () => {
    expect(avecConges.totalCotisationsPatronales).toBe(
      sec.totalCotisationsPatronales,
    );
  });
  it("meme cout total employeur", () => {
    expect(avecConges.coutTotalEmployeur).toBe(sec.coutTotalEmployeur);
  });
  it("meme RGDU (coefficient et montant d'allegement)", () => {
    expect(coefficientRgdu(avecConges)).toBe(coefficientRgdu(sec));
    expect(avecConges.allegementCotisations).toBe(sec.allegementCotisations);
  });
  it("meme assiette CSG", () => {
    expect(assietteCsg(avecConges)).toBe(assietteCsg(sec));
  });

  it("ventilation des conges (retenue absence + indemnite) = 0,00 exactement", () => {
    const retenue = avecConges.lignesBrut.find(
      (g) => g.libelle === LIBELLES.retenueAbsenceConges,
    );
    const indemnite = avecConges.lignesBrut.find(
      (g) => g.libelle === LIBELLES.indemniteConges,
    );
    // Les deux lignes doivent exister...
    expect(retenue).toBeDefined();
    expect(indemnite).toBeDefined();
    // ...et leur somme doit etre rigoureusement nulle.
    const somme =
      Math.round(((retenue?.montant ?? 0) + (indemnite?.montant ?? 0)) * 100) /
      100;
    expect(somme).toBe(0);
    // Le bulletin sec, lui, n'a pas de ligne de ventilation.
    expect(
      sec.lignesBrut.some(
        (g) =>
          g.libelle === LIBELLES.retenueAbsenceConges ||
          g.libelle === LIBELLES.indemniteConges,
      ),
    ).toBe(false);
  });
});
