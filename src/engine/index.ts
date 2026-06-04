// Exports publics du moteur de calcul de paie (module pur).

export type {
  Statut,
  EntreeLegal,
  EntreeEntreprise,
  EntreeSalarie,
  EntreeMensuel,
  EntreeBulletin,
  Assiette,
  Condition,
  LigneBareme,
  ParamsRgdu,
  Bareme,
  LigneCotisation,
  BulletinCalcule,
} from "./types";

export { calculerBulletin, calculerRgdu, LIBELLES } from "./calcul";
export { baremeSyntec202606 } from "./baremes/syntec-2026-06";
export { baremeSyntec202601 } from "./baremes/syntec-2026-01";

import type { Bareme } from "./types";
import { baremeSyntec202606 } from "./baremes/syntec-2026-06";
import { baremeSyntec202601 } from "./baremes/syntec-2026-01";

// Reference du bareme legal courant. L'index pointe sur le nouveau bareme 2026-06.
export const REFERENCE_BAREME_COURANT = baremeSyntec202606.reference;

// Registre des baremes disponibles, indexes par reference. Le bareme 2026-01 est
// conserve pour la continuite (voir baremes/syntec-2026-01.ts).
const baremes: Record<string, Bareme> = {
  [baremeSyntec202606.reference]: baremeSyntec202606,
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
