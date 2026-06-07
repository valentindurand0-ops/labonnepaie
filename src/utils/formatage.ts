// Helpers de PRESENTATION purs, couche neutre. AUCUN import de src/engine ni de
// src/model : ce module ne connait ni le moteur ni le modele de donnees, il ne fait
// que mettre en forme des valeurs deja calculees pour l'affichage. Reutilisable par
// n'importe quel composant sans creer de couplage de couche.

// Formate un montant en euros : 2 decimales et espace separateur de milliers.
// Ex : 5588.08 -> "5 588.08 €". N'effectue aucun calcul de paie.
export function formaterMontant(valeur: number): string {
  const fixe = valeur.toFixed(2);
  const [entier, decimales] = fixe.split(".");
  const signe = entier.startsWith("-") ? "-" : "";
  const chiffres = signe ? entier.slice(1) : entier;
  const avecEspaces = chiffres.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${signe}${avecEspaces}.${decimales} €`;
}
