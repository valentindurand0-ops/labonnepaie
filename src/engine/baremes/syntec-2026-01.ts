import type { Bareme } from "../types";
import { baremeSyntec202606 } from "./syntec-2026-06";

// Bareme Syntec "2026-01", conserve pour la continuite (l'UI et d'anciennes
// entrees peuvent encore le referencer). La reference legale COURANTE est
// syntec-2026-06 : c'est elle que l'index designe par defaut.
//
// Pour le moteur, les deux baremes sont identiques : les taux de cotisation 2026
// sont les memes et le SMIC RGDU est gele a 12.02 EUR sur toute l'annee 2026 (la
// revalorisation du 1er juin 2026 ne concerne que le SMIC reel, pas la RGDU).
// Ce fichier derive donc du bareme 2026-06 en ne changeant que la reference et
// la date d'application. Toutes les valeurs restent A VALIDER par expert-comptable.
export const baremeSyntec202601: Bareme = {
  ...baremeSyntec202606,
  reference: "syntec-2026-01",
  dateApplication: "2026-01-01",
};
