-- LaBonnePaie - Migration 0001 : schema metier initial.
--
-- Pose les trois tables qui refletent les trois couches stockables du modele
-- TypeScript (src/model/types.ts) : entreprise (couche 2), salarie (couche 3),
-- bulletin_mensuel (couche 4), avec leurs liens.
--
-- FRONTIERE : ce schema est du STOCKAGE PUR. Le moteur (src/engine) et le modele
-- (src/model) ne lisent jamais la base et n'importent jamais ce dossier. La lecture
-- Supabase, l'assemblage en memoire et le passage de l'entree plate au moteur se
-- font ailleurs.
--
-- NE SONT PAS des tables, volontairement :
--   - la couche 1 (baremes legaux) reste versionnee dans le code (src/engine/baremes) ;
--   - les Cumuls annuels sont DERIVES des bulletins precedents, jamais stockes (la
--     verite est la liste des bulletins ; stocker les cumuls = risque de divergence).
--
-- Metadonnees de stockage ABSENTES du modele TS (owner_id, created_at) : ajoutees
-- ici, retirees par la couche d'acces avant de reconstruire les objets du modele.
--
-- Conventions de type :
--   - montants et taux en numeric (JAMAIS float : pas d'erreur d'arrondi sur la paie) ;
--   - effectif en integer (compte d'individus) ;
--   - periode en text "AAAA-MM" (un mois, pas une date) ; date_entree en date (un jour) ;
--   - camelCase TS <-> snake_case SQL : mapping assure par la couche d'acces.

-- Schema auto-suffisant et rejouable sur une instance neuve (CLI, environnement
-- vierge) : gen_random_uuid() depend de pgcrypto, qu'on active explicitement plutot
-- que de supposer une Supabase ou l'extension est preactivee.
create extension if not exists pgcrypto;

-- =====================================================================
-- COUCHE 2 : ENTREPRISE (objet racine)
-- =====================================================================
create table public.entreprise (
  id                    uuid primary key default gen_random_uuid(),

  -- Proprietaire : compte authentifie. Metadonnee de stockage (absente du modele).
  owner_id              uuid not null references auth.users (id) on delete cascade,

  -- Identite (Entreprise.siret / raisonSociale / codeApe).
  siret                 text not null,
  raison_sociale        text not null,
  code_ape              text not null,

  -- Adresse aplatie (Entreprise.adresse : AdressePostale).
  adresse_ligne1        text not null,
  adresse_code_postal   text not null,
  adresse_commune       text not null,

  -- Effectif : compte d'individus, pilote des regles legales (FNAL, Tdelta RGDU).
  effectif              integer not null,

  -- Taux AT/MP en pourcentage (Entreprise.tauxAtMp). Engage la conformite.
  taux_at_mp            numeric not null,

  -- Emplacements reserves (modele : communeInsee?, organismes?).
  commune_insee         text,
  organismes            jsonb,

  created_at            timestamptz not null default now()
);

create index entreprise_owner_id_idx on public.entreprise (owner_id);

-- =====================================================================
-- COUCHE 3 : SALARIE / CONTRAT
-- =====================================================================
create table public.salarie (
  id                        uuid primary key default gen_random_uuid(),

  owner_id                  uuid not null references auth.users (id) on delete cascade,

  -- Reference vers l'entreprise (Salarie.entrepriseId). Supprimer l'entreprise
  -- supprime ses salaries.
  entreprise_id             uuid not null references public.entreprise (id) on delete cascade,

  -- Identite.
  prenom                    text not null,
  nom                       text not null,

  -- Statut : meme domaine que le type Statut du moteur ("cadre" | "etam").
  statut                    text not null check (statut in ('cadre', 'etam')),

  -- Convention collective (type ConventionCollective). Une seule valeur au proto ;
  -- etendre la liste du CHECK quand une 2e convention arrive.
  convention                text not null check (convention in ('IDCC_1486')),

  -- Classification GENERIQUE (string libre cote modele).
  classification            text not null,

  -- Type de contrat (string libre cote modele).
  type_contrat              text not null,

  -- Salaire de base brut mensuel en euros.
  salaire_base_mensuel      numeric not null,

  -- Date d'entree (ISO AAAA-MM-JJ) : un vrai jour.
  date_entree               date not null,

  -- Emplacements reserves / optionnels (modele : tauxPas?, mutuelle*).
  taux_pas                  numeric,
  mutuelle_part_patronale   numeric,
  mutuelle_part_salariale   numeric,

  created_at                timestamptz not null default now()
);

create index salarie_owner_id_idx on public.salarie (owner_id);
create index salarie_entreprise_id_idx on public.salarie (entreprise_id);

-- =====================================================================
-- COUCHE 4 : BULLETIN MENSUEL (variable du mois)
-- =====================================================================
-- BulletinMensuel n'a pas d'id dans le modele (identifie par salarieId + periode).
-- On ajoute un id de surrogate pour la cle technique, et on garantit l'unicite
-- metier par unique(salarie_id, periode) : un seul bulletin par salarie et par mois.
create table public.bulletin_mensuel (
  id              uuid primary key default gen_random_uuid(),

  owner_id        uuid not null references auth.users (id) on delete cascade,

  -- Reference vers le salarie (BulletinMensuel.salarieId). Supprimer le salarie
  -- supprime ses bulletins.
  salarie_id      uuid not null references public.salarie (id) on delete cascade,

  -- Periode de paie au format "AAAA-MM" (un mois, pas une date).
  periode         text not null,

  -- Couche variable du mois.
  heures          numeric not null,
  prime_soumise   numeric,
  jours_conges    numeric,

  created_at      timestamptz not null default now(),

  unique (salarie_id, periode)
);

create index bulletin_mensuel_owner_id_idx on public.bulletin_mensuel (owner_id);
create index bulletin_mensuel_salarie_id_idx on public.bulletin_mensuel (salarie_id);
