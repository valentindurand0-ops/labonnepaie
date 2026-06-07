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
  - SOLDÉ (bascule BulletinPage sur le contexte de saisie) : l'UI ne code plus
    syntec-2026-01 en dur. BulletinPage lit le barème depuis entree.legal.bareme,
    résolu par l'assembleur (REFERENCE_BAREME_COURANT = syntec-2026-06). Le passage
    de l'UI sur 2026-06 est donc fait. La prime de vacances Syntec et la correction
    du biais RGDU (prime/congé comptés x12) attendent toujours le socle de cumuls.
- ÉTAPE FAITE : modèle de données posé en TYPES uniquement (src/model/types.ts),
  sans aucune persistance, aucun Supabase, aucun composant React. Les quatre
  couches sont des interfaces séparées :
  - Entreprise = objet racine : identité (SIRET, raison sociale, code APE,
    adresse), effectif (nombre), taux AT/MP, commune INSEE et organismes réservés.
    Le FNAL n'est PAS un champ stocké : fonction pure deduireFnal(effectif, barème).
  - Salarie référence son entreprise par entrepriseId (pas de duplication). Porte
    la CONVENTION COLLECTIVE (jamais l'entreprise : une société peut avoir plusieurs
    conventions), désignée par identifiant (type ConventionCollective = "IDCC_1486",
    extensible par union). Classification GÉNÉRIQUE (string libre) tant qu'une 2e
    convention n'impose pas de structurer. Plus statut, type de contrat, salaire de
    base, date d'entrée, taux PAS (réservé), mutuelle.
  - BulletinMensuel = salarieId + période + couche variable (heures, primeSoumise,
    joursConges).
  - Cumuls (brutCumulé, netImposableCumulé, plafondSsConsommé, baseRgduAnnuelle) +
    CUMULS_ZERO : EMPLACEMENT RÉSERVÉ, passé à zéro. Présent dans la signature de
    l'assembleur pour brancher plus tard, sans réécriture, la correction du biais
    RGDU x12, la régularisation des tranches et le net imposable annuel.
  - assemblerEntree(entreprise, salarié, bulletin, cumuls=ZERO) : SEUL endroit qui
    connaît les 4 couches, aplatit vers l'EntreeBulletin du moteur, vérifie la
    cohérence des références (salarié -> entreprise, bulletin -> salarié). Le moteur
    ne change pas de contrat d'entrée.
  - Test d'ÉQUIVALENCE (src/model/__tests__/assembleur.test.ts) : entreprise +
    salarié fictifs reproduisant le témoin cadre 4000 -> le moteur redonne net
    3159,61 / cotis. pat. 1512,24 / coût 5512,24, sans montant recopié au hasard.
- ÉTAPE FAITE : SOURCE UNIQUE pour la règle FNAL et le Tdelta RGDU. Le seuil
  d'effectif (50) et les taux ne sont écrits QU'UNE FOIS, dans le barème versionné
  (couche 1, src/engine/baremes/syntec-2026-06.ts) : Bareme.seuilEffectif = 50,
  ligne FNAL tauxPatronal 0,10 % + tauxPatronalAuSeuilEffectif 0,50 %, rgdu.tdelta
  0,3781 + tdeltaAuSeuilEffectif 0,3821. Personne ne recopie ces valeurs : la
  fonction pure tauxPatronalSelonEffectif (src/engine/calcul.ts) est la SEULE logique
  seuil -> taux, et le helper modèle deduireFnal LIT le barème via tauxFnalPatronal.
  Le jour où un taux ou le seuil bouge : un seul endroit à éditer, daté et versionné.
- ÉTAPE FAITE : effectif REBRANCHÉ côté moteur. EntreeEntreprise.effectif est un
  champ REQUIS de l'entrée plate (pas optionnel, pas de fallback) : un appelant qui
  l'oublie ÉCHOUE au typecheck (TS2741), il ne retombe pas silencieusement sur le
  régime moins de 50. C'est l'assembleur qui le fournit depuis l'entreprise ; le
  moteur ne lit l'effectif que dans son entrée plate et en DÉRIVE le FNAL (via
  tauxPatronalSelonEffectif sur les lignes) et le Tdelta de la RGDU, valeurs et seuil
  toujours lus dans le barème. Nouveau TÉMOIN à effectif >= 50
  (src/engine/__tests__/calcul.effectif.test.ts) : cadre 4000 à 50 salariés ->
  FNAL 0,50 % (20,00), coefficient RGDU 0,0397 recalculé avec Tdelta 0,3821
  (réduction 158,80), cotis. pat. 1527,44, coût 5527,44 ; net 3159,61 INCHANGÉ
  (effet purement patronal). Calcul validé pas à pas avant figement (SMIC RGDU gelé
  12,02 -> 21876,88, surtout pas le SMIC réel 12,31). Les témoins existants, tous à
  effectif < 50, n'ont pas bougé d'un centime. UI : champ "Effectif" saisi
  explicitement (pas de défaut silencieux). Suite complète : 86 tests verts.
- ÉTAPE FAITE : ONGLETS de saisie ENTREPRISE et SALARIÉ posés sur le modèle à 4
  couches, état EN MÉMOIRE (aucune persistance, pas de Supabase à cette étape).
  Nouvelle page src/pages/SaisiePage.tsx (route protégée /saisie, lien depuis la
  home) qui DÉTIENT tout l'état (entreprise, salarié, onglet actif) et héberge deux
  formulaires de couche : src/components/EntrepriseForm.tsx (couche 2) et
  src/components/SalarieForm.tsx (couche 3).
  - FRONTIÈRE respectée : les formulaires produisent des objets de couches
    (Entreprise, Salarie) conformes à src/model/types.ts ; ils ne connaissent pas le
    moteur. L'UI ne fabrique JAMAIS l'entrée plate à la main : SaisiePage passe
    TOUJOURS par assemblerEntree avant calculerBulletin.
  - DÉPENDANCE DE COUCHE dans l'UI : l'entreprise est l'objet racine ; l'onglet
    salarié est VERROUILLÉ (bouton désactivé) tant qu'aucune entreprise n'existe. Le
    salarié reference l'entreprise par id, transmis en prop (entrepriseId) et posé
    par le formulaire, jamais saisi à la main. La convention est figée Syntec
    (CONVENTION_SYNTEC, lecture seule). Champs réservés non affichés (communeInsee,
    organismes, tauxPas). ids générés par crypto.randomUUID().
  - PREUVE BOUT EN BOUT : entreprise saisie + salarié saisi + un BulletinMensuel
    MINIMAL non éditable en mémoire (periode 2026-06, heures = durée légale) passent
    dans assemblerEntree et redonnent un calcul juste, affiché en zone de contrôle.
    L'assemblage tourne donc sur des données SAISIES À L'ÉCRAN, plus sur des fixtures.
  - SOURCE UNIQUE pour la durée mensuelle légale : nouvelle constante exportée
    HEURES_MENSUELLES_LEGALES = 151,67 (35 x 52 / 12) dans src/engine/calcul.ts,
    A VALIDER expert-comptable. Le barème (smicAnnuelRgdu) et l'UI l'IMPORTENT ; plus
    de 151,67 en dur. Déduplication à valeur identique : aucun témoin n'a bougé,
    suite complète toujours 86 tests verts, build de prod OK.
  - SUITE : la bascule de BulletinPage sur ces onglets et la suppression du
    hard-code cadre 4000 sont faites (voir l'étape dédiée plus bas). Reste à brancher
    Supabase (persistance des couches).
- ÉTAPE FAITE : PRE-REMPLISSAGE de l'onglet entreprise via l'API Recherche
  d'entreprises (recherche-entreprises.api.gouv.fr, gratuite, sans clé, sans auth).
  Le dirigeant tape un nom ou un SIRET, choisit dans une liste, et les champs
  fiables se remplissent seuls (et restent éditables).
  - FRONTIÈRE respectée : l'appel réseau vit dans un module UI dédié,
    src/services/rechercheEntreprises.ts, SEUL endroit du projet qui fait un fetch.
    Le moteur (src/engine) et le modèle (src/model) ne font aucun appel réseau et
    n'importent JAMAIS ce module ; seul EntrepriseForm l'importe. L'objet Entreprise
    émis par le formulaire garde EXACTEMENT la même forme qu'avant : l'API ne fait
    que remplir des champs locaux avant émission. types.ts, engine et assembleur non
    touchés.
  - Mapping API -> champs : raison sociale (nom_complet ?? nom_raison_sociale),
    SIRET du siège, code APE, adresse du siège (numero_voie + type_voie +
    libelle_voie, code postal, libellé commune). Le code APE est NORMALISÉ une fois
    dans le service au format canonique "DD.DDL" (l'API le renvoie avec ou sans
    point selon la source) ; cohérence de donnée, pas de calcul.
  - EFFECTIF ET AT/MP TOUJOURS SAISIS À LA MAIN, jamais pré-remplis : ils engagent
    la conformité (effectif décide FNAL et Tdelta au seuil de 50). La tranche INSEE
    (tranche_effectif_salarie) est souvent périmée et n'est qu'un nombre de tranche :
    affichée comme simple INDICE à côté du champ effectif ("INSEE indique : 10 à 19
    salariés..."), jamais dérivée en effectif. AT/MP garde sa mention CARSAT /
    A VALIDER.
  - États gérés (chargement, aucun résultat, erreur réseau) sans plantage : en cas
    d'API indisponible, message d'invite et SAISIE 100% MANUELLE toujours possible en
    repli. Bloc de recherche en sibling AU-DESSUS du form (la touche Entrée lance la
    recherche, ne soumet jamais le formulaire). Déclenchement par bouton + Entrée
    (pas de recherche à la frappe, pour ne pas marteler l'API).
- ÉTAPE FAITE : BASCULE de BulletinPage sur le CONTEXTE DE SAISIE et SUPPRESSION du
  hard-code cadre 4000. Il n'y a plus qu'UN SEUL chemin de saisie : BulletinPage
  affiche le bulletin à partir de l'entreprise et du salarié RÉELLEMENT saisis dans
  /saisie, plus à partir de données en dur.
  - ÉTAT PARTAGÉ : nouveau src/context/SaisieContext.tsx (SaisieProvider + useSaisie)
    placé au-dessus de toutes les routes dans src/App.tsx (version simple enveloppant
    <Routes>, pas de route layout / Outlet à ce stade). Le contexte ne porte QUE des
    objets de couches : entreprise (couche 2), salarié (couche 3) et leurs setters.
    AUCUNE logique de calcul, AUCUN appel au moteur, AUCUN assemblerEntree dedans. Le
    moteur (src/engine) et le modèle (src/model) n'importent jamais le contexte.
    Garde-fou : useSaisie hors d'un SaisieProvider lève une erreur.
  - SaisiePage ne DÉTIENT plus l'état entreprise/salarié : elle le lit et l'écrit via
    useSaisie. Seul l'onglet actif reste un état local (pur UI). La zone de
    vérification de l'assemblage reste en place et passe toujours par assemblerEntree.
  - BulletinPage consomme useSaisie pour entreprise + salarié. La couche MENSUELLE
    (couche 4 : période, heures, prime soumise, jours de congés) reste un état LOCAL
    à la page (donnée saisie chaque mois, pas dans le contexte partagé). FRONTIÈRE
    inchangée : la page passe TOUJOURS par assemblerEntree puis calculerBulletin,
    jamais d'entrée plate fabriquée à la main. Le barème affiché vient de
    entree.legal.bareme (résolu par l'assembleur), plus d'identifiant en dur.
  - GARDE-FOU : si l'entreprise OU le salarié manque, BulletinPage n'affiche AUCUN
    bulletin par défaut ; elle invite à compléter la saisie avec un lien vers /saisie,
    sans planter. Un récapitulatif lecture seule de l'entreprise et du salarié saisis
    est affiché au-dessus du formulaire mensuel.
  - VALIDATIONS : les contrôles de brut, taux AT/MP et effectif ont été retirés de
    BulletinPage car ils sont faits EN AMONT à la saisie (SalarieForm valide le
    salaire de base > 0 ; EntrepriseForm valide l'effectif entier >= 0 et le taux
    AT/MP >= 0). Aucune validation perdue. BulletinPage ne valide plus que sa couche 4
    (période, heures > 0, prime >= 0, congés >= 0).
  - Suite complète : 86 tests verts (témoins du moteur intacts, non touchés : ils
    vivent dans src/engine et ne dépendent pas de l'UI), build de prod OK.
- ÉTAPE FAITE : passage du SALARIÉ UNIQUE à une LISTE de salariés dans le contexte
  de saisie. Toujours sans persistance, état en mémoire (Supabase reste une étape
  séparée). Une entreprise a plusieurs salariés ; la reconduction mensuelle et
  l'héritage entreprise -> salarié à venir supposent une liste.
  - CONTEXTE (src/context/SaisieContext.tsx) : salarie: Salarie | null est remplacé
    par salaries: Salarie[] (vide au départ) et salarieSelectionneId: string | null.
    On stocke l'ID du salarié actif, JAMAIS une copie : pas de risque d'avoir deux
    versions du même salarié qui divergent. Le salarié courant est exposé comme
    DÉRIVÉ salarieSelectionne: Salarie | null, recalculé par salaries.find à chaque
    rendu (pas de useState dédié) ; salaries et salarieSelectionneId restent les
    seules sources de vérité. Fonctions exposées : ajouterSalarie(s) (ajoute ET
    sélectionne le nouveau), selectionnerSalarie(id), modifierSalarie(s) (remplace
    dans la liste celui de même id, sans toucher la sélection). entreprise inchangé.
    FRONTIÈRE intacte : le contexte ne porte que des objets de couches et de l'état
    d'UI, aucun calcul, aucun appel moteur, aucun assemblerEntree.
  - SaisiePage : l'onglet salarié LISTE les salariés créés (chacun sélectionnable,
    l'actif est marqué), permet d'en AJOUTER un (SalarieForm inchangé, émet un objet
    Salarie via onSave ; c'est SaisiePage qui appelle ajouterSalarie ; entrepriseId
    toujours posé depuis la prop, jamais saisi). Le verrou de couche est conservé :
    onglet salarié désactivé tant qu'aucune entreprise. Après ajout, un compteur de
    remontage (key) remet le formulaire à vide. La zone de vérification d'assemblage
    porte désormais sur le salarié sélectionné.
  - BulletinPage : lit le salarié SÉLECTIONNÉ (salarieSelectionne) au lieu du salarié
    unique. Sélecteur de salarié affiché dès qu'il y a au moins deux salariés (change
    selectionnerSalarie, tout le bulletin se recalcule). Garde-fou inchangé : sans
    entreprise OU sans salarié sélectionné, message "complétez la saisie" + lien vers
    /saisie. Chemin assemblerEntree -> calculerBulletin identique.
  - Suite complète : 86 tests verts (moteur intact, non touché), typecheck propre,
    build de prod OK.
  - RESTE À FAIRE :
    - modifierSalarie est exposé dans le contexte mais PAS encore branché à une UI :
      prise laissée volontairement, à câbler lors de l'étape "édition d'un salarié
      existant" (cliquer un salarié charge le formulaire, réenregistrer appelle
      modifierSalarie). Tracé ici pour que cette fonction non utilisée ne devienne
      pas du code mort silencieux.
    - reconduction mensuelle (reconduire le mois précédent, ne saisir que les
      exceptions) et héritage des valeurs communes entreprise -> salarié.
    - wizard de classification Syntec (2-3 questions déduisant position/coefficient).
    - brancher Supabase (persistance des couches).
- ÉTAPE FAITE : PERSISTANCE Supabase, étape 1 (schéma) puis étape 2 (couche d'accès
  ENTREPRISE). Le schéma SQL des 3 tables (entreprise, salarie, bulletin_mensuel) est
  versionné sous supabase/migrations/ avec RLS par compte (owner_id = auth.uid()) et
  triggers de cohérence propriétaire le long des liens. Nouveau module d'accès
  src/services/entrepriseStore.ts (couche STOCKAGE, même famille que
  rechercheEntreprises) :
  - FRONTIÈRE intacte : le moteur (src/engine) et le modèle (src/model) ne lisent
    jamais la base et n'importent jamais ce module. Sens unique : entrepriseStore
    importe src/lib/supabase + des types-only de src/model/types. Le mapping base
    <-> modèle est un secret du fichier (type privé LigneEntreprise + deux fonctions
    privées ligneVersEntreprise / entrepriseVersPayload) ; le reste de l'app ne voit
    que des objets Entreprise.
  - Deux fonctions exposées : chargerEntreprise() -> Entreprise | null (via
    maybeSingle : null = "rien en base", distinct d'une erreur levée) ;
    enregistrerEntreprise(Entreprise) -> Entreprise (upsert idempotent sur la PK id,
    re-mappé depuis la ligne renvoyée par .single() pour adopter l'id/les valeurs
    canoniques côté base).
  - ISOLATION : owner_id jamais manipulé côté client. Lecture restreinte par la RLS ;
    écriture omet owner_id du payload, le default auth.uid() le pose à l'INSERT
    (infalsifiable). created_at idem (default now()). Les deux sont jetés à la lecture
    (absents du modèle).
  - Coercition Number(...) sur les numeric à la lecture (PostgREST peut renvoyer un
    numeric en chaîne) ; null <-> undefined pour communeInsee / organismes.
  - Gestion d'erreur : le client Supabase renvoie { data, error } ; le module convertit
    en Error standard (message français + cause conservée), l'appelant n'importe jamais
    Supabase.
  - PÉRIMÈTRE de l'étape : juste le module. Aucun écran, aucun contexte de saisie,
    aucun model/engine touché. Branchement à l'UI = étape suivante. Typecheck propre,
    86 tests verts inchangés.
  - RESTE À FAIRE (dettes assumées du proto, tracées ici pour ne pas les oublier) :
    - classe ErreurStockage (extends Error) à introduire si un jour l'UI doit
      discriminer PROGRAMMATIQUEMENT un échec de stockage d'une autre erreur. Au proto,
      une Error simple suffit.
    - validation runtime du schéma de organismes (jsonb) À LA LECTURE quand la DSN
      exploitera vraiment ces champs. Aujourd'hui typecast jsonb -> Organismes sans
      validation, raccourci assumé.
    - dette ES2020 sur la cause d'erreur : la cible du projet est ES2020, donc
      new Error(msg, { cause }) (ES2022) est refusé ; on assigne .cause après
      construction via un cast. Quand la cible passera à ES2022, remplacer par
      new Error(msg, { cause }) et retirer le cast.
    - étapes 3 et 4 de la persistance : salarieStore.ts et bulletinStore.ts (même
      patron), puis branchement des trois stores à l'UI / au contexte de saisie.
- ÉTAPE FAITE : BRANCHEMENT du store entreprise à l'UI (intercalaire entre étapes 2
  et 3 de la persistance). L'entreprise devient DURABLE : lue depuis Supabase au
  changement de session, réécrite à la création / modification. Ce branchement prouve
  enfin la RLS en tant qu'utilisateur connecté.
  - FRONTIÈRE SACRÉE CONFIRMÉE INTACTE : seule la couche contexte/UI importe le store
    (et, indirectement, Supabase). Le moteur (src/engine) et le modèle (src/model)
    n'importent JAMAIS le store ni Supabase et restent purs. Ce branchement N'EST PAS
    un précédent pour faire entrer Supabase dans le moteur : le sens de dépendance
    reste à sens unique (UI -> services -> Supabase ; engine/model n'en savent rien).
  - SaisieContext.tsx N'EST PLUS "pur mémoire" : il ORCHESTRE désormais la
    persistance de l'entreprise via entrepriseStore (documenté dans son en-tête). Il
    importe useAuth + chargerEntreprise + enregistrerEntreprise. Il ne fait toujours
    AUCUN calcul de paie, AUCUN appel au moteur, AUCUN assemblerEntree. La couche 3
    (salaries) reste en mémoire (sa persistance = étape ultérieure salarieStore).
  - LECTURE : un useEffect dépendant de user?.id et de authLoading. On attend que la
    session soit prête (authLoading false) AVANT d'appeler chargerEntreprise, sinon la
    requête partirait sans JWT et la RLS renverrait 0 ligne à tort. Au logout (user
    null), l'état de saisie est VIDÉ (entreprise, salaries, sélection) : indispensable
    à l'isolation par compte (l'entreprise du compte précédent ne doit pas rester en
    mémoire). Garde annule contre les résolutions tardives.
  - STATUT EXPLICITE : statutEntreprise: 'chargement' | 'pret' | 'erreur' +
    erreurEntreprise: string | null exposés par le contexte. Le cas "pas encore
    d'entreprise" n'est PAS un 4e statut : il se DÉDUIT de (statutEntreprise === 'pret'
    && entreprise === null). Évite que les écrans confondent chargement, vide et
    erreur (sinon BulletinPage afficherait "complétez la saisie" pendant le
    chargement).
  - ÉCRITURE : action sauvegarderEntreprise(e) dans le PROVIDER. Elle appelle
    enregistrerEntreprise PUIS pose dans l'état l'objet RE-MAPPÉ renvoyé par la base.
    INVARIANT : setEntreprise n'est jamais appelé qu'avec un objet venu de la base
    (lecture ou écriture) ; setEntreprise n'est plus exposé par le contexte. En cas
    d'échec d'écriture, l'action rejette SANS toucher l'état mémoire ; l'écran attrape
    et affiche, la saisie n'est pas perdue.
  - ÉCRANS : SaisiePage appelle sauvegarderEntreprise (async), ne bascule sur l'onglet
    salarié qu'au SUCCÈS, affiche chargement / erreur de lecture (du contexte) et
    enregistrement en cours / erreur d'écriture (état local). BulletinPage distingue
    désormais statutEntreprise === 'chargement' (message neutre) du cas "vraiment pas
    d'entreprise" (invite à compléter). EntrepriseForm INCHANGÉ : il émet toujours un
    objet Entreprise via onSave, ignore tout du store.
  - PREUVE RLS (parcours manuel) : compte A saisit + enregistre une entreprise ->
    recharge la page connecté A -> l'entreprise A revient (SELECT RLS). Logout ->
    login compte B -> aucune entreprise (B ne voit pas celle de A). B enregistre la
    sienne. Re-login A -> l'entreprise A réapparaît inchangée. Côté base : deux lignes
    avec owner_id distincts (INSERT with check via default auth.uid()).
