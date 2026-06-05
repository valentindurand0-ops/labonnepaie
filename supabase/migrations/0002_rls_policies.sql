-- LaBonnePaie - Migration 0002 : isolation par compte (RLS) + coherence proprietaire.
--
-- Pose, EN MEME TEMPS que les tables (pas dans un lot ulterieur), les deux barrieres
-- d'isolation entre comptes :
--
--   1. RLS (Row Level Security) : un compte ne lit/ecrit/supprime QUE ses lignes
--      (owner_id = auth.uid()).
--
--   2. Coherence du proprietaire LE LONG DES LIENS, via triggers. Le RLS seul ne
--      suffit pas : il laisserait un compte raccrocher SON salarie (owner_id = lui)
--      a l'entreprise_id d'un AUTRE compte. Les deux lignes passent le RLS chacune
--      de leur cote, mais le LIEN traverse la frontiere entre deux comptes. Sur un
--      produit de paie, l'isolation entre clients est une promesse dure : on ferme
--      ce trou des la pose. Les triggers refusent tout lien dont la cible appartient
--      a un autre owner_id.

-- =====================================================================
-- 1. RLS : activation + policies par operation
-- =====================================================================

-- --- entreprise ---
alter table public.entreprise enable row level security;

create policy entreprise_select_own
  on public.entreprise for select
  using (owner_id = auth.uid());

create policy entreprise_insert_own
  on public.entreprise for insert
  with check (owner_id = auth.uid());

create policy entreprise_update_own
  on public.entreprise for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy entreprise_delete_own
  on public.entreprise for delete
  using (owner_id = auth.uid());

-- --- salarie ---
alter table public.salarie enable row level security;

create policy salarie_select_own
  on public.salarie for select
  using (owner_id = auth.uid());

create policy salarie_insert_own
  on public.salarie for insert
  with check (owner_id = auth.uid());

create policy salarie_update_own
  on public.salarie for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy salarie_delete_own
  on public.salarie for delete
  using (owner_id = auth.uid());

-- --- bulletin_mensuel ---
alter table public.bulletin_mensuel enable row level security;

create policy bulletin_mensuel_select_own
  on public.bulletin_mensuel for select
  using (owner_id = auth.uid());

create policy bulletin_mensuel_insert_own
  on public.bulletin_mensuel for insert
  with check (owner_id = auth.uid());

create policy bulletin_mensuel_update_own
  on public.bulletin_mensuel for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy bulletin_mensuel_delete_own
  on public.bulletin_mensuel for delete
  using (owner_id = auth.uid());

-- =====================================================================
-- 2. Coherence du proprietaire le long des liens (triggers OBLIGATOIRES)
-- =====================================================================

-- salarie.entreprise_id doit pointer vers une entreprise du MEME owner_id.
create or replace function public.check_salarie_owner_coherence()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.entreprise e
    where e.id = new.entreprise_id
      and e.owner_id = new.owner_id
  ) then
    raise exception
      'Coherence proprietaire violee : entreprise % absente ou appartenant a un autre compte que le salarie (owner %).',
      new.entreprise_id, new.owner_id;
  end if;
  return new;
end;
$$;

create trigger salarie_owner_coherence
  before insert or update on public.salarie
  for each row
  execute function public.check_salarie_owner_coherence();

-- bulletin_mensuel.salarie_id doit pointer vers un salarie du MEME owner_id.
create or replace function public.check_bulletin_owner_coherence()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.salarie s
    where s.id = new.salarie_id
      and s.owner_id = new.owner_id
  ) then
    raise exception
      'Coherence proprietaire violee : salarie % absent ou appartenant a un autre compte que le bulletin (owner %).',
      new.salarie_id, new.owner_id;
  end if;
  return new;
end;
$$;

create trigger bulletin_mensuel_owner_coherence
  before insert or update on public.bulletin_mensuel
  for each row
  execute function public.check_bulletin_owner_coherence();
