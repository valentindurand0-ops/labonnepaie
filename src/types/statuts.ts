// Types de STATUT DE LECTURE des couches depuis le stockage. Module NEUTRE : ni
// domaine (src/model) ni moteur (src/engine), juste un vocabulaire partage entre le
// contexte de saisie (qui PRODUIT ces statuts) et les composants de presentation (qui
// les CONSOMMENT). Sortis de SaisieContext pour qu'un composant purement
// presentationnel (ex : HistoriqueBulletins) puisse typer son etat de lecture sans
// dependre du module contexte.
//
// Les trois couches suivent le MEME triptyque "chargement | pret | erreur". On les
// garde comme trois alias distincts (et non un seul type partage) pour que chaque
// couche reste nommee a son niveau d'appel, et qu'une evolution future de l'une
// n'entraine pas mecaniquement les autres.
//
// Dans les trois cas, le cas "vide" (pas d'entreprise / aucun salarie / aucun
// bulletin) n'est PAS un statut a part : il se DEDUIT de (statut === "pret" et la
// donnee correspondante absente).

// Cycle de lecture de l'entreprise (couche 2).
export type StatutEntreprise = "chargement" | "pret" | "erreur";

// Cycle de lecture des salaries (couche 3), en cascade apres l'entreprise.
export type StatutSalaries = "chargement" | "pret" | "erreur";

// Cycle de lecture de l'historique des bulletins (couche 4) du salarie actif, en
// cascade apres la selection.
export type StatutBulletins = "chargement" | "pret" | "erreur";
