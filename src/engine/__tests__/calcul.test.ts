// ECART CONNU vs SimulPaie (divergences VOLONTAIRES entre notre moteur juste
// et le simulateur de reference, a tracer ici au fur et a mesure) :
//   1. Cout employeur : notre moteur INCLUT la prevoyance cadre Tranche A
//      (60.00 sur ce cas) dans le cout total employeur, car c'est un cout
//      patronal reel. SimulPaie l'excluait a tort, d'ou son etalon a 5528.08.
//      Notre valeur comptablement correcte est 5588.08.
//   2. Abattement CSG : on suit pour l'instant SimulPaie (0.25 %, soit
//      base = brut x 0.9975), alors que le taux d'abattement legal de
//      reference est 1.75 %. A VALIDER par expert-comptable.

import { describe, it, expect } from "vitest";
import { calculerBulletin, LIBELLES } from "../calcul";
import { baremeSyntec202601 } from "../baremes/syntec-2026-01";
import type {
  BulletinCalcule,
  EntreeBulletin,
  LigneCotisation,
} from "../types";

// Recupere le montant d'une ligne par son libelle.
function montant(lignes: LigneCotisation[], libelle: string): number {
  const trouvee = lignes.find((l) => l.libelle === libelle);
  if (!trouvee) {
    throw new Error(`Ligne introuvable : "${libelle}".`);
  }
  return trouvee.montant;
}

// Cas etalon impose : cadre, brut 4000, AT/MP 1.4, 151.67 heures.
const entreeEtalon: EntreeBulletin = {
  legal: { bareme: "syntec-2026-01" },
  entreprise: { tauxAtMp: 1.4 },
  salarie: { statut: "cadre", brutMensuel: 4000 },
  mensuel: { heures: 151.67 },
};

describe("calculerBulletin : cas etalon cadre 4000 euros", () => {
  let bulletin: BulletinCalcule;

  // Recalcule avant chaque test pour garantir l'isolation (fonction pure).
  function calcul(): BulletinCalcule {
    return calculerBulletin(entreeEtalon, baremeSyntec202601);
  }

  bulletin = calcul();

  it("brutTotal = 4000.00", () => {
    expect(bulletin.brutTotal).toBe(4000.0);
  });

  // --- Cotisations salariales ---
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

  it("salariale chomage APEC = 0.96", () => {
    expect(montant(bulletin.lignesSalariales, LIBELLES.chomageApec)).toBe(0.96);
  });

  it("salariale CSG non imposable = 271.32", () => {
    expect(montant(bulletin.lignesSalariales, LIBELLES.csgNonImposable)).toBe(
      271.32,
    );
  });

  it("salariale CSG/CRDS imposable = 115.71", () => {
    expect(montant(bulletin.lignesSalariales, LIBELLES.csgCrdsImposable)).toBe(
      115.71,
    );
  });

  it("totalRetenuesSalariales = 840.39", () => {
    expect(bulletin.totalRetenuesSalariales).toBe(840.39);
  });

  it("netSocial = 3159.61", () => {
    expect(bulletin.netSocial).toBe(3159.61);
  });

  it("netAPayerAvantImpot = 3159.61", () => {
    expect(bulletin.netAPayerAvantImpot).toBe(3159.61);
  });

  // --- Cotisations patronales ---
  it("patronale sante maladie = 520.00", () => {
    expect(montant(bulletin.lignesPatronales, LIBELLES.santeMaladie)).toBe(520.0);
  });

  it("patronale prevoyance cadre Tranche A = 60.00", () => {
    expect(montant(bulletin.lignesPatronales, LIBELLES.prevoyanceCadre)).toBe(
      60.0,
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

  it("patronale assurance chomage = 160.00", () => {
    expect(montant(bulletin.lignesPatronales, LIBELLES.assuranceChomage)).toBe(
      160.0,
    );
  });

  it("patronale chomage AGS = 10.00", () => {
    expect(montant(bulletin.lignesPatronales, LIBELLES.chomageAgs)).toBe(10.0);
  });

  it("patronale APEC = 1.44", () => {
    expect(montant(bulletin.lignesPatronales, LIBELLES.apec)).toBe(1.44);
  });

  it("patronale autres contributions employeur = 61.84", () => {
    expect(
      montant(bulletin.lignesPatronales, LIBELLES.autresContributions),
    ).toBe(61.84);
  });

  it("allegementCotisations = 158.00", () => {
    expect(bulletin.allegementCotisations).toBe(158.0);
  });

  // Voir "ECART CONNU vs SimulPaie" en tete de fichier : l'etalon SimulPaie
  // donnait 5528.08 en excluant a tort la prevoyance cadre (60.00) du cout
  // employeur. Notre moteur applique le calcul comptablement correct :
  // brut (4000.00) + cotisations patronales (1746.08) - allegement (158.00).
  it("coutTotalEmployeur = 5588.08", () => {
    expect(bulletin.coutTotalEmployeur).toBe(5588.08);
  });
});
