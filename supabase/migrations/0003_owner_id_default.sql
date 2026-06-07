-- Migration corrective 0003
-- Pose le default auth.uid() sur owner_id des trois tables metier.
-- Raison : le contrat du projet veut que le client n'envoie jamais owner_id ;
-- c'est le default en base qui le pose a l'INSERT. La 0001 avait cree owner_id
-- not null sans default, ce qui faisait echouer tout INSERT en RLS (42501).

alter table public.entreprise        alter column owner_id set default auth.uid();
alter table public.salarie           alter column owner_id set default auth.uid();
alter table public.bulletin_mensuel  alter column owner_id set default auth.uid();
