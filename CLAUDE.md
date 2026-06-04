# LaBonnePaie

## Objectif du projet
Prototype d'un SaaS permettant à un dirigeant de PME relevant de la convention
collective Syntec (IDCC 1486) d'éditer en autonomie les bulletins de paie de ses
salariés. But : prouver la faisabilité technique. Priorité absolue à la JUSTESSE
du calcul et à la SIMPLICITÉ d'usage pour un dirigeant non spécialiste de la paie.

## Stack technique
- Frontend : React + Vite
- Backend / base de données / auth : Supabase (Postgres + Auth)
- Génération PDF : à décider lors de l'étape dédiée (react-pdf ou équivalent)
- Hébergement cible : à définir (Netlify probable)

## Règles d'or (à respecter dans tout le projet)
- Ne JAMAIS utiliser de tiret cadratin (—) dans le code, les commentaires ou les textes.
- Tous les barèmes légaux sont VERSIONNÉS par date d'application. Le moteur de calcul
  sélectionne toujours le barème en vigueur à la période du bulletin concerné.
- Les valeurs chiffrées légales et conventionnelles présentes dans ce fichier sont
  marquées "À VALIDER". Elles ne doivent jamais être considérées comme exactes sans
  vérification contre une source officielle (URSSAF / BOSS / avenant Syntec).
- UX : tout ce qui peut être pré-rempli depuis une source officielle fiable ne doit
  jamais être saisi à la main. Mais ne jamais masquer une donnée qui engage la
  conformité (ex : taux AT/MP) derrière une valeur par défaut silencieuse.
- Construire par incréments testables. Un commit par étape validée, poussé sur GitHub.

## Architecture du calcul : 4 couches de données
1. LÉGAL / GÉNÉRAL (maintenu par l'équipe LaBonnePaie, versionné par date)
   PMSS, SMIC, taux de cotisations (santé, retraite T1/T2, chômage, CSG/CRDS,
   CEG/CET, APEC, FNAL, formation, CSA), barème réduction générale, barème PAS,
   versement mobilité (semi-général, dépend de la commune).
2. ENTREPRISE (gérée par le dirigeant)
   SIRET, code APE/NAF, raison sociale, adresse, effectif, taux AT/MP (CARSAT),
   commune (versement mobilité), organismes (retraite complémentaire, prévoyance, OPCO).
   Convention collective figée : Syntec IDCC 1486.
3. SALARIÉ / CONTRAT (géré dans le profil salarié)
   Statut ETAM ou Ingénieur/Cadre, classification Syntec (position + coefficient),
   type de contrat, modalité de temps de travail (horaire / forfait heures / forfait
   jours), salaire de base brut, date d'entrée, ancienneté, taux de PAS, mutuelle.
4. MENSUEL / VARIABLE (saisi chaque mois)
   Congés payés pris, primes (vacances Syntec, exceptionnelle, 13e mois), heures
   supplémentaires, absences, avantages en nature, frais, période de paie.

## Dépendance transversale : les cumuls annuels
Un bulletin n'est jamais isolé. Le moteur doit lire les bulletins précédents du
salarié sur l'année civile pour : tranches de cotisations, régularisation progressive
de la réduction générale, plafond SS proratisé, net imposable et net social cumulés.

## Spécificités Syntec à implémenter
- Grille de classification ETAM (coefficients) et Ingénieurs/Cadres (positions 1.1
  à 3.3). Valeur du point et minima conventionnels : À VALIDER contre dernier avenant.
- Alerter si le salaire de base saisi est inférieur au minimum conventionnel de la
  classification choisie.
- Forfait jours (fréquent pour les cadres Syntec) : le bulletin diffère du bulletin
  horaire (mention du nombre de jours, pas d'heures). Plafond annuel de jours : À VALIDER.
- Prime de vacances Syntec : obligation conventionnelle, 10% de l'indemnité de congés
  payés de l'ensemble des salariés, versée traditionnellement vers juin. À VALIDER.

## Différenciateur UX prioritaire
- Création entreprise via API Recherche d'entreprises (gratuite, sans clé) :
  le dirigeant saisit nom ou SIRET, les champs entreprise se pré-remplissent.
- Wizard de classification Syntec : 2-3 questions simples qui déduisent
  position/coefficient, au lieu de demander la grille brute.
- Héritage des valeurs communes entreprise -> salarié (ex : contrat mutuelle).
- Génération mensuelle par reconduction du mois précédent : le dirigeant ne saisit
  que les exceptions du mois.

## Périmètre
- DANS le proto : couches 1 à 4, moteur de calcul, génération bulletin PDF, cumuls.
- HORS proto mais à anticiper : DSN (court terme après le proto). Normaliser dès
  maintenant les référentiels (codes organismes, types de personnel) pour préparer
  le terrain, sans implémenter la DSN.

## Méthode de validation
Le proto est "juste" quand un bulletin généré correspond AU CENTIME PRÈS à un
bulletin de référence réel (produit par un expert-comptable ou Silae/PayFit),
idéalement un cadre Syntec au forfait jours.

## Architecture de code imposée
Le moteur de calcul de paie doit être un MODULE PUR, isolé de toute UI React :
entrées (données des 4 couches) -> sortie (bulletin calculé), sans dépendance à
l'affichage. Il doit être testable seul, avec des tests unitaires par règle de calcul.

## État d'avancement
- Scaffolding React + Vite et authentification Supabase en place.
- Moteur de calcul pur (src/engine) : calculerBulletin + getBareme, barème
  Syntec 2026-01 versionné, 23 tests unitaires qui passent.
- Affichage du bulletin : src/pages/BulletinPage.tsx (route protégée /bulletin,
  lien depuis la home). Formulaire réactif (statut, brut, taux AT/MP, heures,
  barème en lecture seule) branché sur le moteur. Toute la logique de calcul
  reste dans src/engine ; la page ne fait qu'appeler calculerBulletin / getBareme
  et afficher le résultat (lignes salariales/patronales, totaux, gestion d'erreur).
