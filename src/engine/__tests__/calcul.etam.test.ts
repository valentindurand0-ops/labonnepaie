// Cas de test ETAM (Non Cadre). Les valeurs etalon proviennent d'un bulletin
// SimulPaie Non Cadre (au centime). Initialement ecrit en TEST-FIRST, ce cas est
// desormais couvert par le moteur (prevoyance non cadre Tranche A sal + pat, et
// base CSG non cadre calee sur SimulPaie). Voir l'en-tete "ECART CONNU" de
// calcul.test.ts pour la base CSG non cadre (assiette a confirmer, PRIORITE HAUTE).

import { describe, it, expect } from "vitest";
import { calculerBulletin, LIBELLES } from "../calcul";
import { baremeSyntec202601 } from "../baremes/syntec-2026-01";
import type {
  BulletinCalcule,
  EntreeBulletin,
  LigneCotisation,
} from "../types";

// Libelle attendu pour la prevoyance non cadre, dans le meme style que les
// libelles existants (ex LIBELLES.prevoyanceCadre = "Prevoyance cadre Tranche A").
// Volontairement pas tire de LIBELLES : cette ligne n'existe pas encore.
const LIBELLE_PREVOYANCE_NON_CADRE = "Prevoyance non cadre Tranche A";

// Recupere le montant d'une ligne par son libelle (echoue si introuvable).
function montant(lignes: LigneCotisation[], libelle: string): number {
  const trouvee = lignes.find((l) => l.libelle === libelle);
  if (!trouvee) {
    throw new Error(`Ligne introuvable : "${libelle}".`);
  }
  return trouvee.montant;
}

// Recupere une ligne par son libelle, ou undefined si absente.
function ligne(
  lignes: LigneCotisation[],
  libelle: string,
): LigneCotisation | undefined {
  return lignes.find((l) => l.libelle === libelle);
}

// Cas etalon impose : etam (non cadre), brut 4000, AT/MP 1.4, 151.67 heures.
const entreeEtalon: EntreeBulletin = {
  legal: { bareme: "syntec-2026-01" },
  entreprise: { tauxAtMp: 1.4 },
  salarie: { statut: "etam", brutMensuel: 4000 },
  mensuel: { heures: 151.67 },
};

describe("calculerBulletin : cas etalon ETAM (non cadre) 4000 euros", () => {
  const bulletin: BulletinCalcule = calculerBulletin(
    entreeEtalon,
    baremeSyntec202601,
  );

  it("brutTotal = 4000.00", () => {
    expect(bulletin.brutTotal).toBe(4000.0);
  });

  // --- Cotisations salariales ---
  it("salariale prevoyance non cadre Tranche A = 10.00", () => {
    expect(montant(bulletin.lignesSalariales, LIBELLE_PREVOYANCE_NON_CADRE)).toBe(
      10.0,
    );
  });

  it("salariale SS deplafonnee = 16.00", () => {
    expect(montant(bulletin.lignesSalariales, LIBELLES.ssDeplafonnee)).toBe(16.0);
  });

  it("salariale SS plafonnee = 276.00", () => {
    expect(montant(bulletin.lignesSalariales, LIBELLES.ssPlafonnee)).toBe(276.0);
  });

  it("salariale retraite complementaire Tranche A = 160.40", () => {
    expect(montant(bulletin.lignesSalariales, LIBELLES.retraiteTrancheA)).toBe(
      160.4,
    );
  });

  it("salariale CSG non imposable : base 3940, montant 267.92", () => {
    const l = ligne(bulletin.lignesSalariales, LIBELLES.csgNonImposable);
    expect(l).toBeDefined();
    expect(l?.base).toBe(3940.0);
    expect(l?.montant).toBe(267.92);
  });

  it("salariale CSG/CRDS imposable : base 3940, montant 114.26", () => {
    const l = ligne(bulletin.lignesSalariales, LIBELLES.csgCrdsImposable);
    expect(l).toBeDefined();
    expect(l?.base).toBe(3940.0);
    expect(l?.montant).toBe(114.26);
  });

  it("AUCUNE ligne APEC salariale ne doit exister", () => {
    expect(ligne(bulletin.lignesSalariales, LIBELLES.chomageApec)).toBeUndefined();
  });

  // --- Cotisations patronales ---
  it("patronale sante maladie = 520.00", () => {
    expect(montant(bulletin.lignesPatronales, LIBELLES.santeMaladie)).toBe(520.0);
  });

  it("patronale prevoyance non cadre Tranche A = 10.00", () => {
    expect(montant(bulletin.lignesPatronales, LIBELLE_PREVOYANCE_NON_CADRE)).toBe(
      10.0,
    );
  });

  it("patronale AT/MP = 56.00", () => {
    expect(montant(bulletin.lignesPatronales, LIBELLES.atMp)).toBe(56.0);
  });

  it("patronale SS deplafonnee = 84.40", () => {
    expect(montant(bulletin.lignesPatronales, LIBELLES.ssDeplafonnee)).toBe(84.4);
  });

  it("patronale SS plafonnee = 342.00", () => {
    expect(montant(bulletin.lignesPatronales, LIBELLES.ssPlafonnee)).toBe(342.0);
  });

  it("patronale retraite complementaire Tranche A = 240.40", () => {
    expect(montant(bulletin.lignesPatronales, LIBELLES.retraiteTrancheA)).toBe(
      240.4,
    );
  });

  it("patronale famille = 210.00", () => {
    expect(montant(bulletin.lignesPatronales, LIBELLES.famille)).toBe(210.0);
  });

  it("patronale chomage = 160.00", () => {
    expect(montant(bulletin.lignesPatronales, LIBELLES.assuranceChomage)).toBe(
      160.0,
    );
  });

  it("patronale AGS = 10.00", () => {
    expect(montant(bulletin.lignesPatronales, LIBELLES.chomageAgs)).toBe(10.0);
  });

  it("patronale autres contributions employeur = 61.84", () => {
    expect(
      montant(bulletin.lignesPatronales, LIBELLES.autresContributions),
    ).toBe(61.84);
  });

  it("AUCUNE ligne APEC patronale ne doit exister", () => {
    expect(ligne(bulletin.lignesPatronales, LIBELLES.apec)).toBeUndefined();
  });

  it("AUCUNE ligne prevoyance cadre 1.50% ne doit exister", () => {
    expect(
      ligne(bulletin.lignesPatronales, LIBELLES.prevoyanceCadre),
    ).toBeUndefined();
  });

  // --- Totaux ---
  // Somme des salariales etalon : 10 + 16 + 276 + 160.40 + 267.92 + 114.26.
  it("totalRetenuesSalariales = 844.58", () => {
    expect(bulletin.totalRetenuesSalariales).toBe(844.58);
  });

  it("netSocial = 3155.42", () => {
    expect(bulletin.netSocial).toBe(3155.42);
  });

  it("netAPayerAvantImpot = 3155.42", () => {
    expect(bulletin.netAPayerAvantImpot).toBe(3155.42);
  });

  it("allegementCotisations = 158.00", () => {
    expect(bulletin.allegementCotisations).toBe(158.0);
  });

  it("coutTotalEmployeur = 5536.64", () => {
    expect(bulletin.coutTotalEmployeur).toBe(5536.64);
  });
});
