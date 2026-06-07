// COUCHE D'ACCES BASE (stockage). Lecture/ecriture des salaries (couche 3) de
// l'entreprise courante, dans Supabase.
//
// FRONTIERE SACREE : ce module fait du STOCKAGE, rien d'autre. Le moteur
// (src/engine) et le modele (src/model) ne lisent JAMAIS la base et n'importent
// JAMAIS ce fichier. Le sens de dependance est a sens unique : ce module importe le
// client Supabase (src/lib/supabase) et des TYPES du modele (import type-only) ; le
// modele reste pur et ignore l'existence de la base. Le mapping base <-> modele est
// un secret de ce fichier : le reste de l'app ne voit que des objets Salarie.
//
// ISOLATION PAR COMPTE : on ne manipule JAMAIS owner_id cote client. A la lecture,
// la RLS (owner_id = auth.uid()) restreint deja les lignes visibles a celles du
// compte ; le filtre .eq("entreprise_id", ...) est une barriere METIER en plus (un
// compte = une entreprise au proto, mais le modele pose deja salarie -> entreprise
// par reference, donc on filtre des aujourd'hui sur l'entreprise courante). A
// l'ecriture, owner_id est OMIS du payload : le default auth.uid() en base le pose a
// l'insertion, infalsifiable (la verite vient du JWT, pas du client).

import { supabase } from "../lib/supabase";
import type { ConventionCollective, Salarie, Statut } from "../model/types";

// --- Forme exacte d'une ligne de la table salarie (telle que renvoyee par la base :
// snake_case, owner_id, created_at, entreprise_id). Ce type est PRIVE : il ne sort
// jamais du module. ---
interface LigneSalarie {
  id: string;
  owner_id: string;
  entreprise_id: string;
  prenom: string;
  nom: string;
  // statut / convention : la base ne garantit que le CHECK. On les typecaste sans
  // validation runtime (le store TRANSPORTE, ne valide pas les valeurs metier).
  // RACCOURCI ASSUME, trace dans CLAUDE.md (RESTE A FAIRE).
  statut: Statut;
  convention: ConventionCollective;
  classification: string;
  type_contrat: string;
  // numeric : PostgREST peut le renvoyer en CHAINE dans les cas de grande precision,
  // d'ou la coercition Number(...) systematique a la lecture.
  salaire_base_mensuel: number;
  // date en base : PostgREST serialise en chaine "AAAA-MM-JJ", format attendu par le
  // modele. Pas de Number, pas de conversion Date.
  date_entree: string;
  // Optionnels base (nullables). null en base -> undefined cote modele a la lecture.
  taux_pas: number | null;
  mutuelle_part_patronale: number | null;
  mutuelle_part_salariale: number | null;
  created_at: string;
}

// --- Payload d'ECRITURE (upsert). On y met TOUTES les colonnes NOT NULL sans default
// (id, entreprise_id, prenom, nom, statut, convention, classification, type_contrat,
// salaire_base_mensuel, date_entree) plus les nullables. On N'Y MET NI owner_id NI
// created_at : ils ont un default en base (auth.uid() et now()), c'est la base qui
// les pose. ---
interface PayloadSalarie {
  id: string;
  entreprise_id: string;
  prenom: string;
  nom: string;
  statut: Statut;
  convention: ConventionCollective;
  classification: string;
  type_contrat: string;
  salaire_base_mensuel: number;
  date_entree: string;
  taux_pas: number | null;
  mutuelle_part_patronale: number | null;
  mutuelle_part_salariale: number | null;
}

// --- Mapping LECTURE : ligne SQL -> objet Salarie du modele ---
// Passe en camelCase, JETTE owner_id et created_at (absents du modele), convertit
// null -> undefined pour les optionnels (avec Number() pour les numeric).
function ligneVersSalarie(row: LigneSalarie): Salarie {
  return {
    id: row.id,
    entrepriseId: row.entreprise_id,
    prenom: row.prenom,
    nom: row.nom,
    statut: row.statut,
    convention: row.convention,
    classification: row.classification,
    typeContrat: row.type_contrat,
    // numeric possiblement en chaine -> coercition systematique.
    salaireBaseMensuel: Number(row.salaire_base_mensuel),
    // date deja au format "AAAA-MM-JJ" : copie directe, surtout pas de Number.
    dateEntree: row.date_entree,
    // Numeric NULLABLES : on combine null -> undefined ET Number(). On NE FAIT JAMAIS
    // Number(null) (qui vaut 0) : "non renseigne" doit rester undefined, pas devenir
    // un taux PAS ou une part mutuelle de 0.
    tauxPas: row.taux_pas == null ? undefined : Number(row.taux_pas),
    mutuellePartPatronale:
      row.mutuelle_part_patronale == null
        ? undefined
        : Number(row.mutuelle_part_patronale),
    mutuellePartSalariale:
      row.mutuelle_part_salariale == null
        ? undefined
        : Number(row.mutuelle_part_salariale),
  };
}

// --- Mapping ECRITURE : objet Salarie du modele -> payload SQL ---
// Passe en snake_case, convertit undefined -> null. N'inclut NI owner_id NI
// created_at (poses par les defaults en base).
function salarieVersPayload(s: Salarie): PayloadSalarie {
  return {
    id: s.id,
    entreprise_id: s.entrepriseId,
    prenom: s.prenom,
    nom: s.nom,
    statut: s.statut,
    convention: s.convention,
    classification: s.classification,
    type_contrat: s.typeContrat,
    salaire_base_mensuel: s.salaireBaseMensuel,
    date_entree: s.dateEntree,
    taux_pas: s.tauxPas ?? null,
    mutuelle_part_patronale: s.mutuellePartPatronale ?? null,
    mutuelle_part_salariale: s.mutuellePartSalariale ?? null,
  };
}

// --- Gestion d'erreur : le client Supabase ne throw pas, il renvoie { data, error }.
// On convertit une erreur Supabase en Error standard avec un message francais et la
// cause d'origine conservee. L'appelant attrape une Error normale : il n'importe
// jamais Supabase et ne lit aucun code PostgREST.
//
// DUPLICATION ASSUMEE (proto) : ce helper est identique a celui de entrepriseStore.ts.
// Regle de trois : on factorisera (module partage) seulement si un 3e store le
// re-duplique. Au proto, deux copies cote a cote restent plus lisibles qu'une
// abstraction prematuree.
function echecStockage(message: string, cause: unknown): never {
  // L'option { cause } du constructeur Error est ES2022 ; la cible du projet est
  // ES2020. On assigne la cause apres construction (supportee au runtime), pour la
  // conserver sans elargir la cible TypeScript.
  const erreur = new Error(message);
  (erreur as Error & { cause?: unknown }).cause = cause;
  throw erreur;
}

// Lit les salaries de l'entreprise donnee, ordonnes par date de creation (ordre
// d'affichage stable). Renvoie [] si aucun salarie (jamais null) : l'absence se lit
// sur la longueur, pas besoin d'un null distinct. La RLS restreint deja aux lignes
// du compte ; le .eq("entreprise_id", ...) cible l'entreprise courante.
export async function chargerSalaries(
  entrepriseId: string,
): Promise<Salarie[]> {
  const { data, error } = await supabase
    .from("salarie")
    .select("*")
    .eq("entreprise_id", entrepriseId)
    .order("created_at", { ascending: true });

  if (error) {
    echecStockage("Lecture des salaries impossible (droits ou connexion).", error);
  }
  return (data as LigneSalarie[]).map(ligneVersSalarie);
}

// Cree OU met a jour un salarie (upsert sur la cle primaire id) :
//   - creation (ligne absente) : INSERT, owner_id pose par le default auth.uid(),
//     policy INSERT with check OK ;
//   - mise a jour (ligne presente) : UPDATE, owner_id absent du payload donc non
//     touche, policy UPDATE using + with check OK.
// Renvoie l'objet REELLEMENT persiste, re-mappe depuis la ligne renvoyee par la base
// (.select().single()), pour que l'appelant adopte l'id et les valeurs canoniques.
export async function enregistrerSalarie(salarie: Salarie): Promise<Salarie> {
  const payload = salarieVersPayload(salarie);

  const { data, error } = await supabase
    .from("salarie")
    .upsert(payload, { onConflict: "id" })
    .select()
    .single();

  if (error) {
    echecStockage("Enregistrement du salarie impossible (droits ou connexion).", error);
  }
  return ligneVersSalarie(data as LigneSalarie);
}
