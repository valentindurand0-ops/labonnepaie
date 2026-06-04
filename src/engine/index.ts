// Exports publics du moteur de calcul de paie (module pur).

export type {
  Statut,
  EntreeLegal,
  EntreeEntreprise,
  EntreeSalarie,
  EntreeMensuel,
  EntreeBulletin,
  Bareme,
  BaremeSalariales,
  BaremePatronales,
  LigneCotisation,
  BulletinCalcule,
} from "./types";

export { calculerBulletin, LIBELLES } from "./calcul";
export { baremeSyntec202601 } from "./baremes/syntec-2026-01";

import type { Bareme } from "./types";
import { baremeSyntec202601 } from "./baremes/syntec-2026-01";

// Registre des baremes disponibles, indexes par reference.
const baremes: Record<string, Bareme> = {
  [baremeSyntec202601.reference]: baremeSyntec202601,
};

// Recupere un bareme par sa reference. Leve une erreur si inconnu.
export function getBareme(reference: string): Bareme {
  const bareme = baremes[reference];
  if (!bareme) {
    throw new Error(`Bareme inconnu : "${reference}".`);
  }
  return bareme;
}
