// Modele de donnees PRODUIT de LaBonnePaie : les QUATRE couches (legal, entreprise,
// salarie, mensuel) posees separement, plus l'ASSEMBLEUR vers l'entree plate du
// moteur de calcul.
//
// PERIMETRE STRICT de ce fichier : uniquement des TYPES et des FONCTIONS PURES.
//   - AUCUNE persistance, AUCUN Supabase, AUCUN composant React ici.
//   - Le moteur (src/engine) reste un module pur qui ne lit jamais la base et
//     recoit toujours une entree deja assemblee A PLAT (EntreeBulletin).
//   - Ce fichier est le SEUL endroit qui connait les quatre couches a la fois :
//     il les aplatit pour le moteur via assemblerEntree(). Le moteur, lui, ignore
//     totalement cette structure en couches.
//
// Multi-convention : on ne code qu'UNE seule convention (Syntec IDCC 1486), mais on
// la DESIGNE par identifiant partout (type ConventionCollective), pour que l'ajout
// d'une 2e convention soit un AJOUT (un membre d'union, un case) et pas une refonte.

import type { Bareme, EntreeBulletin, Statut } from "../engine";
import { REFERENCE_BAREME_COURANT, tauxFnalPatronal } from "../engine";

// Re-export du statut : le modele salarie reutilise le meme type que le moteur,
// pour qu'il n'y ait pas deux definitions de "cadre | etam" a maintenir.
export type { Statut };

// --- Identifiants (references entre couches, pas de duplication de donnees) ---

export type EntrepriseId = string;
export type SalarieId = string;

// Identifiant de convention collective. Une seule valeur pour l'instant (Syntec).
// Etendre par UNION (ex "IDCC_1486" | "IDCC_xxxx") quand une 2e convention arrive :
// le compilateur forcera alors a traiter le nouveau cas partout ou il manque.
export type ConventionCollective = "IDCC_1486";

// Convention par defaut du proto : Syntec.
export const CONVENTION_SYNTEC: ConventionCollective = "IDCC_1486";

// --- COUCHE 2 : ENTREPRISE (objet RACINE, gere par le dirigeant) ---
//
// Porte ce qui est juridiquement attache a la SOCIETE. Un utilisateur = une
// entreprise pour le proto (pas de gestion multi-entreprises par compte), mais la
// reference salarie -> entreprise par identifiant reste posee pour ne pas se fermer
// la porte.
//
// La convention collective n'est PAS ici : elle est portee par le SALARIE (une meme
// entreprise peut avoir plusieurs conventions selon les populations).
export interface Entreprise {
  id: EntrepriseId;

  // Identite (pre-remplissable via l'API Recherche d'entreprises, cf. CLAUDE.md).
  siret: string;
  raisonSociale: string;
  codeApe: string; // code APE / NAF
  adresse: AdressePostale;

  // Effectif : NOMBRE de salaries. Determine des regles legales (FNAL via
  // deduireFnal, Tdelta de la reduction generale cote moteur). N'est JAMAIS un taux
  // stocke : toute deduction se fait par fonction pure a partir de ce nombre.
  effectif: number;

  // Taux AT/MP en pourcentage (ex 1.4). Engage la conformite : propre a CHAQUE
  // entreprise, notifie chaque annee par la CARSAT. Jamais de defaut silencieux.
  // A VALIDER par expert-comptable (donnee entreprise, pas une regle legale).
  tauxAtMp: number;

  // Commune (code INSEE) pour le versement mobilite (semi-general, depend de la
  // commune). EMPLACEMENT RESERVE : le versement mobilite n'est pas encore calcule.
  communeInsee?: string;

  // Organismes rattaches (retraite complementaire, prevoyance, OPCO...).
  // EMPLACEMENT RESERVE pour la DSN ; non utilise par le calcul a ce stade.
  organismes?: Organismes;
}

export interface AdressePostale {
  ligne1: string;
  codePostal: string;
  commune: string;
}

// EMPLACEMENT RESERVE (DSN a venir) : references des organismes par identifiant
// normalise. On pose la forme des maintenant pour preparer le terrain DSN, sans
// l'implementer.
export interface Organismes {
  retraiteComplementaire?: string;
  prevoyance?: string;
  opco?: string;
}

// Deduction du taux FNAL patronal (en pourcentage) a partir de l'effectif. Le FNAL
// n'est JAMAIS un champ saisi ni stocke sur l'entreprise : il se deduit.
//
// SOURCE UNIQUE : le seuil (50) et les taux (0.10 / 0.50) ne sont ecrits qu'une
// fois, dans le bareme versionne (couche 1). Ce helper cote modele NE LES REECRIT
// PAS : il LIT le bareme via tauxFnalPatronal. Le modele a le droit de connaitre le
// bareme legal ; c'est exactement la meme valeur que celle appliquee au bulletin.
export function deduireFnal(effectif: number, bareme: Bareme): number {
  return tauxFnalPatronal(effectif, bareme);
}

// --- COUCHE 3 : SALARIE / CONTRAT (gere dans le profil salarie) ---
//
// Reference son entreprise par IDENTIFIANT (pas de duplication des donnees
// entreprise). Porte la convention collective (jamais l'entreprise).
export interface Salarie {
  id: SalarieId;
  // Reference vers l'entreprise (couche 2). Pas de copie des champs entreprise.
  entrepriseId: EntrepriseId;

  // Identite.
  prenom: string;
  nom: string;

  // Statut : pilote les lignes cadre / non cadre du moteur. Meme type que le moteur.
  statut: Statut;

  // Convention collective applicable A CE salarie. Defaut Syntec IDCC 1486.
  convention: ConventionCollective;

  // Classification conventionnelle. GENERIQUE (string libre) pour l'instant : on la
  // structurera (position + coefficient) quand une 2e convention arrivera, pour ne
  // pas figer prematurement une grille propre a Syntec.
  classification: string;

  // Type de contrat (CDI, CDD...). String libre a ce stade.
  typeContrat: string;

  // Salaire de base brut MENSUEL en euros.
  salaireBaseMensuel: number;

  // Date d'entree (ISO AAAA-MM-JJ). L'anciennete n'est PAS stockee : elle se deduit
  // de cette date a la periode du bulletin (pas encore exploitee par le moteur).
  dateEntree: string;

  // Taux de prelevement a la source en pourcentage (ex 3.5). EMPLACEMENT RESERVE :
  // le PAS n'est pas encore applique au net par le moteur.
  tauxPas?: number;

  // Mutuelle (heritee de l'entreprise dans l'UX cible, cf. CLAUDE.md). Parts en
  // euros. A VALIDER par expert-comptable.
  mutuellePartPatronale?: number;
  mutuellePartSalariale?: number;
}

// --- CUMULS ANNUELS (emplacement RESERVE, passe a zero pour l'instant) ---
//
// Un bulletin n'est jamais isole : le calcul juste a besoin des cumuls des mois
// PRECEDENTS de l'annee civile. On RESERVE l'emplacement des maintenant, meme vide,
// pour pouvoir plus tard, SANS REECRITURE du moteur ni de l'assembleur :
//   - corriger le biais RGDU x12 (remuneration annuelle REELLE au lieu de
//     brut mensuel x 12) via baseRgduAnnuelle ;
//   - regulariser progressivement les tranches T1/T2 via plafondSsConsomme ;
//   - calculer le net imposable annuel via netImposableCumule.
// Tant que les cumuls ne sont pas branches, l'assembleur passe CUMULS_ZERO.
export interface Cumuls {
  // Brut soumis cumule sur l'annee civile, mois precedents inclus.
  brutCumule: number;
  // Net imposable cumule sur l'annee civile.
  netImposableCumule: number;
  // Plafond de securite sociale deja consomme sur l'annee (proratisation).
  plafondSsConsomme: number;
  // Base de remuneration annuelle servant a la reduction generale (RGDU).
  baseRgduAnnuelle: number;
}

// Cumuls a zero : etat du tout premier bulletin de l'annee, et valeur passee tant
// que les cumuls multi-bulletins ne sont pas branches.
export const CUMULS_ZERO: Cumuls = {
  brutCumule: 0,
  netImposableCumule: 0,
  plafondSsConsomme: 0,
  baseRgduAnnuelle: 0,
};

// --- COUCHE 4 : BULLETIN MENSUEL (variable du mois, saisi chaque mois) ---
//
// Rattache un SALARIE et une PERIODE, porte la couche variable du mois.
export interface BulletinMensuel {
  // Reference vers le salarie (couche 3).
  salarieId: SalarieId;

  // Periode de paie au format AAAA-MM (ex "2026-06").
  periode: string;

  // Nombre d'heures du mois (ex 151.67).
  heures: number;

  // Prime soumise a cotisations en euros (defaut 0 cote moteur).
  primeSoumise?: number;

  // Jours de conges payes pris dans le mois (defaut 0). Methode du maintien de
  // salaire cote moteur (voir src/engine/calcul.ts).
  joursConges?: number;
}

// --- ASSEMBLEUR : 4 couches (+ cumuls) -> entree plate du moteur ---
//
// SEUL endroit qui connait les quatre couches a la fois. Produit l'EntreeBulletin
// attendue par calculerBulletin. Le moteur ne change pas de contrat d'entree.
//
// Coherence des references : le bulletin doit concerner CE salarie, et le salarie
// CETTE entreprise. On le verifie pour ne jamais assembler des couches incoherentes
// (ex un salarie d'une autre societe).
export function assemblerEntree(
  entreprise: Entreprise,
  salarie: Salarie,
  bulletin: BulletinMensuel,
  cumuls: Cumuls = CUMULS_ZERO,
): EntreeBulletin {
  if (salarie.entrepriseId !== entreprise.id) {
    throw new Error(
      `Assemblage incoherent : le salarie ${salarie.id} depend de l'entreprise ${salarie.entrepriseId}, pas de ${entreprise.id}.`,
    );
  }
  if (bulletin.salarieId !== salarie.id) {
    throw new Error(
      `Assemblage incoherent : le bulletin concerne le salarie ${bulletin.salarieId}, pas ${salarie.id}.`,
    );
  }

  // cumuls est present dans la SIGNATURE mais pas encore exploite : il sera lu ICI
  // pour la RGDU annuelle, la regularisation des tranches et le net imposable
  // cumule (voir Cumuls). Aujourd'hui CUMULS_ZERO. Reference explicite pour marquer
  // l'emplacement reserve sans declencher d'avertissement "parametre inutilise".
  void cumuls;

  return {
    legal: {
      bareme: referenceBareme(salarie.convention, bulletin.periode),
    },
    entreprise: {
      tauxAtMp: entreprise.tauxAtMp,
      // L'assembleur est le seul a transmettre l'effectif a l'entree plate. Le
      // moteur en derive FNAL et Tdelta sans jamais relire l'entreprise.
      effectif: entreprise.effectif,
    },
    salarie: {
      statut: salarie.statut,
      brutMensuel: salarie.salaireBaseMensuel,
      mutuellePartPatronale: salarie.mutuellePartPatronale,
      mutuellePartSalariale: salarie.mutuellePartSalariale,
    },
    mensuel: {
      heures: bulletin.heures,
      primeSoumise: bulletin.primeSoumise,
      joursConges: bulletin.joursConges,
    },
  };
}

// Resout la reference du bareme legal (couche 1) en vigueur pour une convention a
// une periode donnee. Proto : une seule convention (Syntec), on renvoie le bareme
// COURANT du moteur. La selection par DATE d'application (parmi les baremes
// versionnes) viendra se brancher ICI, sans toucher au reste de l'assembleur.
//
// La convention est DESIGNEE par identifiant : l'ajout d'une 2e convention sera un
// case supplementaire de ce switch, pas une refonte.
function referenceBareme(
  convention: ConventionCollective,
  _periode: string,
): string {
  switch (convention) {
    case "IDCC_1486":
      return REFERENCE_BAREME_COURANT;
  }
}
