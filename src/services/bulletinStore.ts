// COUCHE D'ACCES BASE (stockage). Lecture/ecriture des bulletins mensuels (couche 4)
// d'un salarie, dans Supabase.
//
// FRONTIERE SACREE : ce module fait du STOCKAGE, rien d'autre. Le moteur
// (src/engine) et le modele (src/model) ne lisent JAMAIS la base et n'importent
// JAMAIS ce fichier. Le sens de dependance est a sens unique : ce module importe le
// client Supabase (src/lib/supabase) et des TYPES du modele (import type-only) ; le
// modele reste pur et ignore l'existence de la base. Le mapping base <-> modele est
// un secret de ce fichier : le reste de l'app ne voit que des objets BulletinMensuel.
//
// ISOLATION PAR COMPTE : on ne manipule JAMAIS owner_id cote client. A la lecture,
// la RLS (owner_id = auth.uid()) restreint deja les lignes visibles a celles du
// compte ; le filtre .eq("salarie_id", ...) est une barriere METIER en plus (on cible
// l'historique du salarie courant). A l'ecriture, owner_id est OMIS du payload : le
// default auth.uid() en base le pose a l'insertion, infalsifiable (la verite vient du
// JWT, pas du client).
//
// ECARTS ASSUMES vis-a-vis de entrepriseStore / salarieStore (cale a l'identique
// sinon) :
//   1. ID SURROGATE FANTOME : BulletinMensuel n'a PAS de id dans le modele. La table
//      en porte un (cle technique), present dans LigneBulletin (prive) mais JETE par
//      ligneVersBulletin comme owner_id et created_at. Il ne remonte JAMAIS au modele :
//      l'UI identifie un bulletin par (salarieId, periode), jamais par id.
//   2. CLE NATURELLE METIER (salarie_id, periode) : l'upsert porte sur onConflict
//      "salarie_id,periode" (un seul bulletin par salarie et par mois, cf. la
//      contrainte unique en base), la ou entreprise/salarie upsertent sur id. Le
//      PayloadBulletin omet donc l'id : c'est la cle naturelle qui decide insert vs
//      update, pas une cle primaire fabriquee cote client.
//   3. TRI PAR PERIODE LEXICOGRAPHIQUE : l'historique se lit dans l'ordre du MOIS
//      (.order("periode")), pas par created_at. Le format "AAAA-MM" rend l'ordre
//      lexicographique == ordre chronologique. L'ordre metier de l'historique est le
//      mois, pas l'ordre d'insertion.

import { supabase } from "../lib/supabase";
import type { BulletinMensuel } from "../model/types";

// --- Forme exacte d'une ligne de la table bulletin_mensuel (telle que renvoyee par la
// base : snake_case, id surrogate, owner_id, created_at, salarie_id). Ce type est
// PRIVE : il ne sort jamais du module. ---
interface LigneBulletin {
  // ID SURROGATE : cle technique de la table. PRESENT ici mais JETE au mapping (le
  // modele BulletinMensuel n'a pas d'id, il s'identifie par salarie_id + periode).
  id: string;
  owner_id: string;
  salarie_id: string;
  // periode "AAAA-MM" : un mois, pas une date. Copie de chaine telle quelle.
  periode: string;
  // numeric NOT NULL : PostgREST peut le renvoyer en CHAINE dans les cas de grande
  // precision, d'ou la coercition Number(...) a la lecture.
  heures: number;
  // numeric NULLABLES : null en base -> undefined cote modele a la lecture.
  prime_soumise: number | null;
  jours_conges: number | null;
  created_at: string;
}

// --- Payload d'ECRITURE (upsert). On y met la cle naturelle (salarie_id, periode) et
// les colonnes de donnees (heures NOT NULL, prime/conges nullables). On N'Y MET PAS
// l'id surrogate (default gen_random_uuid() a l'insert, et l'upsert resout l'existence
// par la cle naturelle, pas par id), NI owner_id NI created_at (defaults auth.uid() et
// now() en base). ---
interface PayloadBulletin {
  salarie_id: string;
  periode: string;
  heures: number;
  prime_soumise: number | null;
  jours_conges: number | null;
}

// --- Mapping LECTURE : ligne SQL -> objet BulletinMensuel du modele ---
// Passe en camelCase, JETTE id (surrogate), owner_id et created_at (absents du
// modele), convertit null -> undefined pour les optionnels (avec Number() pour les
// numeric).
function ligneVersBulletin(row: LigneBulletin): BulletinMensuel {
  return {
    salarieId: row.salarie_id,
    // periode deja au format "AAAA-MM" : copie directe, surtout pas de Number.
    periode: row.periode,
    // numeric NOT NULL possiblement en chaine -> coercition systematique.
    heures: Number(row.heures),
    // Numeric NULLABLES : on combine null -> undefined ET Number(). On NE FAIT JAMAIS
    // Number(null) (qui vaut 0) : "non renseigne" doit rester undefined, pas devenir
    // une prime ou un nombre de jours de 0.
    primeSoumise: row.prime_soumise == null ? undefined : Number(row.prime_soumise),
    joursConges: row.jours_conges == null ? undefined : Number(row.jours_conges),
  };
}

// --- Mapping ECRITURE : objet BulletinMensuel du modele -> payload SQL ---
// Passe en snake_case, convertit undefined -> null. N'inclut NI id surrogate NI
// owner_id NI created_at (poses par les defaults en base, l'existence resolue par la
// cle naturelle).
function bulletinVersPayload(b: BulletinMensuel): PayloadBulletin {
  return {
    salarie_id: b.salarieId,
    periode: b.periode,
    heures: b.heures,
    prime_soumise: b.primeSoumise ?? null,
    jours_conges: b.joursConges ?? null,
  };
}

// --- Gestion d'erreur : le client Supabase ne throw pas, il renvoie { data, error }.
// On convertit une erreur Supabase en Error standard avec un message francais et la
// cause d'origine conservee. L'appelant attrape une Error normale : il n'importe
// jamais Supabase et ne lit aucun code PostgREST.
//
// DUPLICATION ASSUMEE (proto) : ce helper est identique a ceux de entrepriseStore.ts
// et salarieStore.ts. Regle de trois deja atteinte, mais on garde trois copies
// lisibles cote a cote au proto plutot qu'une abstraction ; la factorisation viendra
// avec un nettoyage dedie (meme dette ES2020 sur .cause deja tracee dans CLAUDE.md).
function echecStockage(message: string, cause: unknown): never {
  const erreur = new Error(message);
  (erreur as Error & { cause?: unknown }).cause = cause;
  throw erreur;
}

// Lit les bulletins d'un salarie, ordonnes par PERIODE croissante (ordre chronologique
// de l'historique, "AAAA-MM" => lexicographique == chronologique). Renvoie [] si aucun
// bulletin (jamais null) : l'absence se lit sur la longueur. La RLS restreint deja aux
// lignes du compte ; le .eq("salarie_id", ...) cible le salarie courant.
export async function chargerBulletins(
  salarieId: string,
): Promise<BulletinMensuel[]> {
  const { data, error } = await supabase
    .from("bulletin_mensuel")
    .select("*")
    .eq("salarie_id", salarieId)
    .order("periode", { ascending: true });

  if (error) {
    echecStockage("Lecture des bulletins impossible (droits ou connexion).", error);
  }
  return (data as LigneBulletin[]).map(ligneVersBulletin);
}

// Cree OU met a jour un bulletin (upsert sur la cle naturelle salarie_id + periode) :
//   - creation (aucun bulletin pour ce salarie ce mois) : INSERT, owner_id pose par le
//     default auth.uid(), policy INSERT with check OK ;
//   - mise a jour (bulletin deja present pour ce salarie ce mois) : UPDATE, owner_id
//     absent du payload donc non touche, policy UPDATE using + with check OK.
// Renvoie l'objet REELLEMENT persiste, re-mappe depuis la ligne renvoyee par la base
// (.select().single()), pour que l'appelant adopte les valeurs canoniques.
export async function enregistrerBulletin(
  bulletin: BulletinMensuel,
): Promise<BulletinMensuel> {
  const payload = bulletinVersPayload(bulletin);

  const { data, error } = await supabase
    .from("bulletin_mensuel")
    .upsert(payload, { onConflict: "salarie_id,periode" })
    .select()
    .single();

  if (error) {
    echecStockage("Enregistrement du bulletin impossible (droits ou connexion).", error);
  }
  return ligneVersBulletin(data as LigneBulletin);
}
