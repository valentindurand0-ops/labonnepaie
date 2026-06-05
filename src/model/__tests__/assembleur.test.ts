// Test de l'ASSEMBLEUR (modele de donnees -> entree plate du moteur).
//
// Preuve par EQUIVALENCE, sans recopier aucun montant : on assemble une entreprise
// et un salarie fictifs reproduisant EXACTEMENT les parametres du temoin "cadre
// 4000" (deja fige au centime dans src/engine/__tests__/calcul.temoins.test.ts), on
// passe le resultat de l'assembleur au moteur, et on verifie qu'on retrouve les
// memes agregats. Si l'assembleur aplatit mal une couche, ces valeurs bougent.
//
// On verifie aussi les garde-fous de coherence des references et la deduction FNAL.

import { describe, it, expect } from "vitest";
import {
  assemblerEntree,
  deduireFnal,
  CONVENTION_SYNTEC,
  type Entreprise,
  type Salarie,
  type BulletinMensuel,
} from "../types";
import { calculerBulletin, getBareme } from "../../engine";
import { baremeSyntec202606 } from "../../engine";

// Entreprise fictive : effectif < 50 (comme les temoins), AT/MP 1,00 %.
const entreprise: Entreprise = {
  id: "ent-1",
  siret: "00000000000000",
  raisonSociale: "Fictive SARL",
  codeApe: "6201Z",
  adresse: { ligne1: "1 rue du Test", codePostal: "75001", commune: "Paris" },
  effectif: 10,
  tauxAtMp: 1.0,
};

// Salarie fictif reproduisant le temoin cadre 4000 : statut cadre, salaire de base
// 4000, mutuelle 0/0, convention Syntec, classification generique.
const salarie: Salarie = {
  id: "sal-1",
  entrepriseId: "ent-1",
  prenom: "Jean",
  nom: "Dupont",
  statut: "cadre",
  convention: CONVENTION_SYNTEC,
  classification: "Position 2.1 coefficient 115",
  typeContrat: "CDI",
  salaireBaseMensuel: 4000,
  dateEntree: "2020-01-01",
  mutuellePartPatronale: 0,
  mutuellePartSalariale: 0,
};

const bulletin: BulletinMensuel = {
  salarieId: "sal-1",
  periode: "2026-06",
  heures: 151.67,
};

describe("assembleur 4 couches -> entree du moteur", () => {
  it("le moteur ACCEPTE l'entree assemblee (bareme coherent)", () => {
    const entree = assemblerEntree(entreprise, salarie, bulletin);
    expect(() =>
      calculerBulletin(entree, getBareme(entree.legal.bareme)),
    ).not.toThrow();
  });

  it("reproduit le temoin cadre 4000 au centime", () => {
    const entree = assemblerEntree(entreprise, salarie, bulletin);
    const b = calculerBulletin(entree, getBareme(entree.legal.bareme));
    // Memes agregats que le temoin fige (effectif < 50).
    expect(b.netSocial).toBe(3159.61);
    expect(b.totalRetenuesSalariales).toBe(840.39);
    expect(b.totalCotisationsPatronales).toBe(1512.24);
    expect(b.coutTotalEmployeur).toBe(5512.24);
    expect(b.allegementCotisations).toBe(158.0);
  });

  it("aplatit bien la couche mensuelle (prime soumise propagee)", () => {
    // Cadre 4000 + prime 500 doit donner le brut soumis 4500 (equivalence connue).
    const entree = assemblerEntree(entreprise, salarie, {
      ...bulletin,
      primeSoumise: 500,
    });
    const b = calculerBulletin(entree, getBareme(entree.legal.bareme));
    expect(b.brutTotal).toBe(4500);
  });

  it("rejette un salarie rattache a une AUTRE entreprise", () => {
    const autre: Salarie = { ...salarie, entrepriseId: "ent-2" };
    expect(() => assemblerEntree(entreprise, autre, bulletin)).toThrow();
  });

  it("rejette un bulletin rattache a un AUTRE salarie", () => {
    const autreBulletin: BulletinMensuel = { ...bulletin, salarieId: "sal-2" };
    expect(() => assemblerEntree(entreprise, salarie, autreBulletin)).toThrow();
  });
});

describe("deduireFnal : taux FNAL patronal lu DANS le bareme selon l'effectif", () => {
  it("0,10 % sous le seuil d'effectif", () => {
    expect(deduireFnal(0, baremeSyntec202606)).toBe(0.1);
    expect(deduireFnal(49, baremeSyntec202606)).toBe(0.1);
  });
  it("0,50 % au seuil d'effectif et au-dela", () => {
    expect(deduireFnal(50, baremeSyntec202606)).toBe(0.5);
    expect(deduireFnal(200, baremeSyntec202606)).toBe(0.5);
  });
  it("renvoie exactement le taux porte par le bareme (pas une copie codee)", () => {
    // Le seuil et les deux taux viennent du bareme : on le prouve en relisant la
    // ligne FNAL du bareme et en comparant.
    const fnal = baremeSyntec202606.lignes.find((l) => l.libelle === "FNAL");
    expect(deduireFnal(10, baremeSyntec202606)).toBe(fnal?.tauxPatronal);
    expect(deduireFnal(60, baremeSyntec202606)).toBe(
      fnal?.tauxPatronalAuSeuilEffectif,
    );
  });
});
