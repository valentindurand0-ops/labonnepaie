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
- ÉTAPE FAITE : recodage du moteur (src/engine) sur base légale 2026.
  L'ancienne logique calée sur SimulPaie a été remplacée.
  - Barème en lignes déclaratives : chaque ligne porte un libellé, une assiette
    (brut / t1 / t2 / t1t2), un taux salarial, un taux patronal et une condition
    optionnelle (cadre / nonCadre / brutSuperieurPmss). calcul.ts est un moteur
    générique qui itère sur les lignes et applique l'assiette ; plus aucune
    assiette codée en dur ligne par ligne.
  - Tranches : PMSS = 4005, T1 = min(brut, PMSS), T2 = max(0, brut - PMSS).
  - CSG/CRDS au légal : assiette = 98,25% du brut plafonné à 4 PMSS + 100% de la
    part au-delà + parts patronales réintégrées (prévoyance + mutuelle). Plus de
    facteurs d'abattement par statut ni de bases CSG en dur (3990 / 3940 supprimés).
  - La mutuelle est désormais une entrée du moteur (EntreeSalarie.mutuellePart-
    Patronale / mutuellePartSalariale, en euros, défaut 0). Seule la part
    patronale entre dans l'assiette CSG à ce stade.
  - Réduction générale dégressive (RGDU) dans une fonction pure isolée
    calculerRgdu : SMIC RGDU gelé à 12,02 pour 2026, garde-fous (0 au-delà de
    3 SMIC, plafond Tmin+Tdelta = 0,3981). Allègement affiché comme ligne
    patronale négative ; plus d'allègement en dur à 158.
  - Nouveau barème daté src/engine/baremes/syntec-2026-06.ts (SMIC réel changé au
    1er juin 2026). L'index pointe dessus par défaut. L'ancien fichier
    syntec-2026-01.ts est conservé mais dérive désormais du 2026-06 (mêmes taux,
    même SMIC RGDU 12,02), pour la continuité de l'UI.
  - Tous les taux portent un commentaire "A VALIDER par expert-comptable".
  - Tests : 20 tests STRUCTURELS verts (présence des lignes, assiettes, invariant
    T1+T2=brut, lignes T2 nulles sous PMSS, garde-fous RGDU). Les anciens tests
    SimulPaie (netSocial 3159.61, coûtEmployeur 5588.08, base CSG 3940, etc.) ont
    été supprimés.
- ÉTAPE FAITE : trois bulletins témoins validés visuellement et figés au centime
  (src/engine/__tests__/calcul.temoins.test.ts, 27 tests). Cas : cadre 4000,
  ETAM 4000, cadre 4500. Paramètres communs AT/MP 1,00 % (VALEUR DE TEST, pas une
  règle légale : le taux AT/MP est propre à chaque entreprise, notifié par la
  CARSAT, saisi couche 2, A VALIDER), mutuelle 0/0, prévoyance défaut, barème
  syntec-2026-06. Valeurs figées (extraits) : cadre 4000 -> net 3159,61 / cotis.
  pat. 1512,24 / coût 5512,24 / CSG 3990 ; ETAM 4000 -> net 3160,90 / cotis. pat.
  1455,80 / coût 5455,80 / CSG 3935 ; cadre 4500 -> T1 4005 / T2 495 / net 3554,86
  / cotis. pat. 1756,45 / coût 6256,45 / CSG 4481,33 + ligne CET.
  - RGDU CONFIRMÉ conforme à la formule officielle. À brut 4000 le coefficient est
    0,0395 et l'allègement 158,00 : le 158 est une COÏNCIDENCE réelle (la réduction
    générale légale vaut bien 158,00 à ce brut précis), pas un reliquat de l'ancien
    montant en dur. À 4500 le coefficient tombe à 0,0277 (allègement 124,65).
  - Suite complète : 47 tests verts (20 structurels + 27 témoins).
- ÉTAPE FAITE : prime soumise générique. EntreeMensuel.primeSoumise (défaut 0)
  s'ajoute au salaire de base pour former le brut soumis ; toute la cascade
  (tranches T1/T2, cotisations, CSG, RGDU, net) en découle sans logique dupliquée.
  Nouveau type LigneGain et champ BulletinCalcule.lignesBrut (composition du brut :
  salaire de base + primes). UI : champ "Prime soumise" et section "Elements de
  brut" dans BulletinPage. Verrouillée par un test d'ÉQUIVALENCE (pas de montants
  recopiés) : cadre 4000 + prime 500 == témoin cadre 4500 au centime
  (src/engine/__tests__/calcul.prime.test.ts). Suite complète : 59 tests verts.
  - IMPERFECTION CONNUE documentée (commentaire dans calcul.ts, A CORRIGER avec les
    cumuls) : la RGDU estime la rémunération annuelle par brut mensuel x 12, donc
    une prime ponctuelle est comptée 12 fois et baisse à tort le coefficient RGDU
    du mois de prime. Sera corrigé par le vrai calcul annuel cumulatif.
- ÉTAPE FAITE : congés payés en méthode MAINTIEN DE SALAIRE (dernier gros morceau
  moteur). EntreeMensuel.joursConges (défaut 0). Le brut soumis ne bouge pas : on
  le ventile en deux lignes de brut qui s'annulent, une retenue d'absence (négative)
  et une indemnité de congés (positive) du même montant. Valeur d'une journée =
  salaire de base / 21,67 jours ouvrés moyens (constante JOURS_OUVRES_MOYENS,
  A VALIDER expert-comptable). La cascade (tranches, cotisations, CSG, RGDU, net,
  coût employeur) est neutre PAR CONSTRUCTION. UI : champ "Jours de congés" ; les
  deux lignes apparaissent dans "Eléments de brut". Verrouillé par un test
  d'ÉQUIVALENCE (pas de montants recopiés) : cadre 4000 + 5 jours == témoin cadre
  4000 sec sur tous les agrégats, et la ventilation somme à 0,00 exactement
  (src/engine/__tests__/calcul.conges.test.ts, 8 tests). Suite complète : 67 tests
  verts.
  - NON GÉRÉ (à venir avec les cumuls annuels) : la règle du dixième et
    l'obligation de retenir la méthode la plus favorable au salarié. Le proto
    mono-bulletin ne fait que le maintien de salaire.
  - RESTE À FAIRE : faire pointer l'UI sur syntec-2026-06 (toujours sur
    syntec-2026-01). Prochaine étape = CONCEPTION DU MODÈLE DE DONNÉES (entreprise,
    salarié, héritage entreprise -> salarié, cumuls annuels) avant d'ouvrir les
    onglets de saisie. La prime de vacances Syntec et la correction du biais RGDU
    (prime/congé comptés x12) attendent ce socle de cumuls.
- Affichage du bulletin : src/pages/BulletinPage.tsx (route protégée /bulletin,
  lien depuis la home). Formulaire réactif (statut, brut, taux AT/MP, heures,
  barème en lecture seule) branché sur le moteur. Toute la logique de calcul
  reste dans src/engine ; la page ne fait qu'appeler calculerBulletin / getBareme
  et afficher le résultat (lignes salariales/patronales, totaux, gestion d'erreur).
