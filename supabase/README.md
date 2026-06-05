# Schema Supabase de LaBonnePaie

Schema metier VERSIONNE de la base. Avant ce dossier, le schema ne vivait que dans
le dashboard Supabase (un trou non trace) : il vit desormais dans le repo, lisible et
relisible en PR.

## Frontiere (a ne jamais franchir)

Ce dossier est du **stockage pur**. Le moteur (`src/engine`) et le modele
(`src/model`) ne lisent jamais la base et n'importent jamais ce dossier. La lecture
Supabase, l'assemblage en memoire et le passage de l'entree plate au moteur se font
ailleurs. Aucun fichier de `src/` ne depend de ce SQL.

## Contenu

- `migrations/0001_init_schema.sql` : les trois tables (`entreprise`, `salarie`,
  `bulletin_mensuel`), leurs colonnes calquees sur `src/model/types.ts`, la chaine de
  cles etrangeres bulletin -> salarie -> entreprise en `on delete cascade`, et les
  index.
- `migrations/0002_rls_policies.sql` : l'isolation par compte. RLS
  `SELECT/INSERT/UPDATE/DELETE` en `owner_id = auth.uid()` sur les trois tables, PLUS
  les triggers de coherence du proprietaire le long des liens (un salarie ne peut pas
  pointer vers l'entreprise d'un autre compte ; un bulletin ne peut pas pointer vers
  le salarie d'un autre compte).

Les migrations sont horodatees / numerotees et s'appliquent dans l'ordre (0001 puis
0002).

## Choix de modelisation (rappel)

- La **couche 1** (baremes legaux) reste dans le code (`src/engine/baremes`), pas en
  base.
- Les **Cumuls** annuels sont DERIVES des bulletins precedents, jamais stockes.
- `owner_id` et `created_at` sont des metadonnees de STOCKAGE, absentes du modele TS :
  la couche d'acces les retire avant de reconstruire les objets `Entreprise`,
  `Salarie`, `BulletinMensuel`.
- Montants et taux en `numeric` (jamais `float`) ; `effectif` en `integer` ;
  `periode` en `text` "AAAA-MM" ; `date_entree` en `date`.

## Application

Deux voies, au choix.

### Voie dashboard (sans CLI)

1. Ouvrir le projet sur https://supabase.com, onglet **SQL Editor**.
2. Coller puis executer le contenu de `migrations/0001_init_schema.sql`.
3. Coller puis executer le contenu de `migrations/0002_rls_policies.sql`.

### Voie CLI Supabase

Depuis la racine du repo, projet lie (`supabase link`) :

```
supabase db push
```

La CLI applique les fichiers de `supabase/migrations/` dans l'ordre.

## Prerequis

`gen_random_uuid()` provient de l'extension `pgcrypto`, activee par defaut sur les
projets Supabase. Si une erreur "function gen_random_uuid() does not exist" apparait,
executer d'abord `create extension if not exists pgcrypto;`.
