import { Link } from "react-router-dom";
import { useAuth } from "../auth/useAuth";

// Page d'accueil protegee. Volontairement vide pour l'instant :
// aucune logique de paie n'est implementee a ce stade.
export function HomePage() {
  const { user, signOut } = useAuth();

  return (
    <main className="home-page">
      <header className="home-header">
        <h1>LaBonnePaie</h1>
        <div className="home-user">
          <span>{user?.email}</span>
          <button type="button" onClick={() => signOut()}>
            Se deconnecter
          </button>
        </div>
      </header>

      <section className="home-content">
        <p>Vous etes connecte. Le contenu sera ajoute dans les prochaines etapes.</p>
        <p>
          <Link to="/bulletin">Voir un bulletin de paie</Link>
        </p>
        <p>
          <Link to="/saisie">Saisir une entreprise et un salarie</Link>
        </p>
      </section>
    </main>
  );
}
