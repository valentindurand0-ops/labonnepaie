// COUCHE D'ACCES BASE (stockage). Lecture/ecriture de l'entreprise (couche 2) du
// compte connecte, dans Supabase.
//
// FRONTIERE SACREE : ce module fait du STOCKAGE, rien d'autre. Le moteur
// (src/engine) et le modele (src/model) ne lisent JAMAIS la base et n'importent
// JAMAIS ce fichier. Le sens de dependance est a sens unique : ce module importe le
// client Supabase (src/lib/supabase) et des TYPES du modele (import type-only) ; le
// modele reste pur et ignore l'existence de la base. Le mapping base <-> modele est
// un secret de ce fichier : le reste de l'app ne voit que des objets Entreprise.
//
// ISOLATION PAR COMPTE : on ne manipule JAMAIS owner_id cote client. A la lecture,
// la RLS (owner_id = auth.uid()) restreint deja les lignes visibles a celles du
// compte. A l'ecriture, owner_id est OMIS du payload : le default auth.uid() en base
// le pose a l'insertion, infalsifiable (la verite vient du JWT, pas du client).

import { supabase } from "../lib/supabase";
import type { Entreprise, Organismes } from "../model/types";

// --- Forme exacte d'une ligne de la table entreprise (telle que renvoyee par la
// base : snake_case, owner_id, created_at, adresse aplatie en 3 colonnes). Ce type
// est PRIVE : il ne sort jamais du module. ---
interface LigneEntreprise {
  id: string;
  owner_id: string;
  siret: string;
  raison_sociale: string;
  code_ape: string;
  adresse_ligne1: string;
  adresse_code_postal: string;
  adresse_commune: string;
  effectif: number;
  taux_at_mp: number;
  commune_insee: string | null;
  organismes: Organismes | null;
  created_at: string;
}

// --- Payload d'ECRITURE (upsert). On y met TOUTES les colonnes NOT NULL sans
// default (id, siret, raison_sociale, code_ape, les 3 colonnes adresse, effectif,
// taux_at_mp) plus les nullables. On N'Y MET NI owner_id NI created_at : ils ont un
// default en base (auth.uid() et now()), c'est la base qui les pose. ---
interface PayloadEntreprise {
  id: string;
  siret: string;
  raison_sociale: string;
  code_ape: string;
  adresse_ligne1: string;
  adresse_code_postal: string;
  adresse_commune: string;
  effectif: number;
  taux_at_mp: number;
  commune_insee: string | null;
  organismes: Organismes | null;
}

// --- Mapping LECTURE : ligne SQL -> objet Entreprise du modele ---
// Reconstruit l'objet adresse, passe en camelCase, JETTE owner_id et created_at
// (absents du modele), convertit null -> undefined pour les champs optionnels.
function ligneVersEntreprise(row: LigneEntreprise): Entreprise {
  return {
    id: row.id,
    siret: row.siret,
    raisonSociale: row.raison_sociale,
    codeApe: row.code_ape,
    adresse: {
      ligne1: row.adresse_ligne1,
      codePostal: row.adresse_code_postal,
      commune: row.adresse_commune,
    },
    // effectif est integer en base, mais on coerce par securite. taux_at_mp est
    // numeric : PostgREST peut le renvoyer en CHAINE dans les cas de grande
    // precision, d'ou la coercition Number(...) systematique sur la paie.
    effectif: Number(row.effectif),
    tauxAtMp: Number(row.taux_at_mp),
    // null en base -> undefined cote modele (champs optionnels).
    communeInsee: row.commune_insee ?? undefined,
    // RACCOURCI ASSUME (proto) : organismes est du jsonb, on le typecaste en
    // Organismes SANS validation de schema au runtime. A SUPPRIMER (valider le
    // schema a la lecture) quand la DSN exploitera vraiment ces champs. Trace dans
    // CLAUDE.md (RESTE A FAIRE).
    organismes: row.organismes ?? undefined,
  };
}

// --- Mapping ECRITURE : objet Entreprise du modele -> payload SQL ---
// Aplatit l'adresse en 3 colonnes, passe en snake_case, convertit undefined -> null.
// N'inclut NI owner_id NI created_at (poses par les defaults en base).
function entrepriseVersPayload(e: Entreprise): PayloadEntreprise {
  return {
    id: e.id,
    siret: e.siret,
    raison_sociale: e.raisonSociale,
    code_ape: e.codeApe,
    adresse_ligne1: e.adresse.ligne1,
    adresse_code_postal: e.adresse.codePostal,
    adresse_commune: e.adresse.commune,
    effectif: e.effectif,
    taux_at_mp: e.tauxAtMp,
    commune_insee: e.communeInsee ?? null,
    organismes: e.organismes ?? null,
  };
}

// --- Gestion d'erreur : le client Supabase ne throw pas, il renvoie { data, error }.
// On convertit une erreur Supabase en Error standard avec un message francais et la
// cause d'origine conservee. L'appelant attrape une Error normale : il n'importe
// jamais Supabase et ne lit aucun code PostgREST.
//
// EVOLUTION (RESTE A FAIRE, trace dans CLAUDE.md) : si un jour l'UI doit discriminer
// PROGRAMMATIQUEMENT un echec de stockage d'une autre erreur, introduire une classe
// ErreurStockage extends Error ici. Au proto, une Error simple suffit.
function echecStockage(message: string, cause: unknown): never {
  // L'option { cause } du constructeur Error est ES2022 ; la cible du projet est
  // ES2020. On assigne la cause apres construction (supportee au runtime), pour la
  // conserver sans elargir la cible TypeScript.
  const erreur = new Error(message);
  (erreur as Error & { cause?: unknown }).cause = cause;
  throw erreur;
}

// Lit l'entreprise du compte connecte. Renvoie null si le compte n'en a pas encore
// (zero ligne via maybeSingle, SANS erreur) : l'ecran distingue ainsi "rien en base"
// (null, etat normal) de "erreur" (exception levee).
export async function chargerEntreprise(): Promise<Entreprise | null> {
  const { data, error } = await supabase
    .from("entreprise")
    .select("*")
    .maybeSingle();

  if (error) {
    echecStockage("Lecture de l'entreprise impossible (droits ou connexion).", error);
  }
  if (!data) {
    return null;
  }
  return ligneVersEntreprise(data as LigneEntreprise);
}

// Cree OU met a jour l'entreprise (upsert sur la cle primaire id) :
//   - creation (ligne absente) : INSERT, owner_id pose par le default auth.uid(),
//     policy INSERT with check OK ;
//   - mise a jour (ligne presente) : UPDATE, owner_id absent du payload donc non
//     touche, policy UPDATE using + with check OK.
// Renvoie l'objet REELLEMENT persiste, re-mappe depuis la ligne renvoyee par la base
// (.select().single()), pour que l'ecran adopte l'id et les valeurs canoniques.
export async function enregistrerEntreprise(
  entreprise: Entreprise,
): Promise<Entreprise> {
  const payload = entrepriseVersPayload(entreprise);

  const { data, error } = await supabase
    .from("entreprise")
    .upsert(payload, { onConflict: "id" })
    .select()
    .single();

  if (error) {
    echecStockage("Enregistrement de l'entreprise impossible (droits ou connexion).", error);
  }
  return ligneVersEntreprise(data as LigneEntreprise);
}
