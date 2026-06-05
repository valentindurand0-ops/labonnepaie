// SERVICE UI (couche reseau). SEUL endroit du projet qui fait un appel reseau.
//
// FRONTIERE NON NEGOCIABLE : ce module vit cote UI. Le moteur (src/engine) et le
// modele (src/model) ne font JAMAIS d'appel reseau et n'importent JAMAIS ce
// fichier. La dependance est a sens unique : seul EntrepriseForm l'importe, pour
// PRE-REMPLIR ses champs locaux avant d'emettre l'objet Entreprise. L'objet emis
// par le formulaire ne change pas de forme : l'API ne fait que remplir des champs.
//
// API Recherche d'entreprises (annuaire-entreprises / api.gouv.fr) : GET, JSON,
// gratuite, sans cle, sans auth. Aucune valeur renvoyee n'est une regle de paie.

const URL_BASE = "https://recherche-entreprises.api.gouv.fr/search";

// Resultat NORMALISE expose au formulaire : UNIQUEMENT les champs que l'API peut
// remplir de facon fiable. Volontairement PAS un objet Entreprise complet : ni id,
// ni effectif, ni tauxAtMp (ces deux derniers se saisissent et s'engagent a la
// main, cf. CLAUDE.md). Cela materialise la frontiere "ce que l'API remplit".
export interface ResultatRechercheEntreprise {
  raisonSociale: string;
  siret: string;
  codeApe: string;
  adresseLigne1: string;
  codePostal: string;
  commune: string;
  // INDICE INSEE d'effectif : AFFICHAGE SEULEMENT. Jamais derive en effectif (la
  // tranche INSEE est souvent perimee ; le dirigeant saisit son nombre exact).
  // null si la tranche est inconnue / non employeur ("NN").
  trancheEffectifLabel: string | null;
  trancheEffectifAnnee: string | null;
}

// --- Forme PARTIELLE de la reponse API (champs utilises seulement) ---
// Tous optionnels / nullables : l'API renvoie souvent null sur certains champs.

interface SiegeApi {
  siret?: string | null;
  numero_voie?: string | null;
  type_voie?: string | null;
  libelle_voie?: string | null;
  code_postal?: string | null;
  libelle_commune?: string | null;
  activite_principale?: string | null;
}

interface EntrepriseApi {
  nom_complet?: string | null;
  nom_raison_sociale?: string | null;
  activite_principale?: string | null;
  tranche_effectif_salarie?: string | null;
  annee_tranche_effectif_salarie?: string | null;
  siege?: SiegeApi | null;
}

interface ReponseApi {
  results?: EntrepriseApi[] | null;
}

// Table des tranches d'effectif INSEE (code -> libelle lisible). AFFICHAGE
// SEULEMENT : sert d'indice a cote du champ effectif, jamais de source de calcul.
// Le code "NN" (non employeur / non renseigne) est volontairement absent -> null.
const TRANCHES_INSEE: Record<string, string> = {
  "00": "0 salarie",
  "01": "1 ou 2 salaries",
  "02": "3 a 5 salaries",
  "03": "6 a 9 salaries",
  "11": "10 a 19 salaries",
  "12": "20 a 49 salaries",
  "21": "50 a 99 salaries",
  "22": "100 a 199 salaries",
  "31": "200 a 249 salaries",
  "32": "250 a 499 salaries",
  "41": "500 a 999 salaries",
  "42": "1 000 a 1 999 salaries",
  "51": "2 000 a 4 999 salaries",
  "52": "5 000 a 9 999 salaries",
  "53": "10 000 salaries et plus",
};

// Normalise le code APE / NAF vers un format UNIQUE et coherent : "DD.DDL"
// (2 chiffres, point, 2 chiffres, 1 lettre), ex "6201Z" ou "62.01z" -> "62.01Z".
// L'API le renvoie tantot avec point, tantot sans, selon la source ; on impose le
// format canonique INSEE une seule fois ici. Si la valeur ne suit pas le schema
// attendu, on la renvoie nettoyee (trim + majuscules) sans inventer de structure.
function normaliserCodeApe(brut: string): string {
  const nettoye = brut.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
  const m = nettoye.match(/^(\d{2})(\d{2})([A-Z])$/);
  if (m) {
    return `${m[1]}.${m[2]}${m[3]}`;
  }
  return brut.trim().toUpperCase();
}

function libelleTranche(code: string | null | undefined): string | null {
  if (!code) return null;
  return TRANCHES_INSEE[code] ?? null;
}

// Mappe un resultat brut de l'API vers la forme normalisee du formulaire.
function mapResultat(e: EntrepriseApi): ResultatRechercheEntreprise {
  const siege = e.siege ?? {};
  // Ligne de rue reconstruite depuis les composants (sans CP ni commune), plutot
  // que le champ "adresse" agglomere de l'API.
  const adresseLigne1 = [siege.numero_voie, siege.type_voie, siege.libelle_voie]
    .filter((p) => p != null && String(p).trim() !== "")
    .join(" ");

  return {
    raisonSociale: e.nom_complet ?? e.nom_raison_sociale ?? "",
    siret: siege.siret ?? "",
    codeApe: normaliserCodeApe(
      e.activite_principale ?? siege.activite_principale ?? "",
    ),
    adresseLigne1,
    codePostal: siege.code_postal ?? "",
    commune: siege.libelle_commune ?? "",
    trancheEffectifLabel: libelleTranche(e.tranche_effectif_salarie),
    trancheEffectifAnnee: e.annee_tranche_effectif_salarie ?? null,
  };
}

// Lance la recherche. Renvoie une liste de resultats normalises. Leve une erreur
// en cas de probleme reseau / reponse non OK : c'est l'appelant (le formulaire)
// qui l'attrape et affiche un message, en laissant la saisie manuelle possible.
export async function rechercherEntreprises(
  query: string,
): Promise<ResultatRechercheEntreprise[]> {
  const q = query.trim();
  // Garde-fou : on n'interroge pas l'API pour une saisie trop courte.
  if (q.length < 3) return [];

  const url = `${URL_BASE}?q=${encodeURIComponent(q)}&per_page=10`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Recherche indisponible (code ${res.status}).`);
  }

  const data = (await res.json()) as ReponseApi;
  const resultats = Array.isArray(data.results) ? data.results : [];
  return resultats.map(mapResultat);
}
