-- Run in the Supabase SQL editor. No service_role key belongs in the frontend.
begin;
create table if not exists public.patrol_access (
 patrol text not null check(patrol in ('Goélands','Lions','Guépards','Orcs','Renards','Taureaux')),
 email text not null check(email=lower(email)),
 primary key(patrol,email)
);
create table if not exists public.patrol_records (
 patrol text primary key check(patrol in ('Goélands','Lions','Guépards','Orcs','Renards','Taureaux')),
 payload jsonb not null,
 revision bigint not null default 1 check(revision>0)
);
alter table public.patrol_access enable row level security;
alter table public.patrol_records enable row level security;
revoke all on public.patrol_access,public.patrol_records from public,anon;
revoke all on public.patrol_records from authenticated;
revoke all on public.patrol_access from authenticated;
grant select on public.patrol_access to authenticated;
grant select,insert,update on public.patrol_records to authenticated;
drop policy if exists own_access on public.patrol_access;
create policy own_access on public.patrol_access for select to authenticated
using(email=lower(auth.jwt()->>'email'));
drop policy if exists allowed_read on public.patrol_records;
create policy allowed_read on public.patrol_records for select to authenticated
using(exists(select 1 from public.patrol_access a where a.patrol=patrol_records.patrol and a.email=lower(auth.jwt()->>'email')));
drop policy if exists allowed_insert on public.patrol_records;
create policy allowed_insert on public.patrol_records for insert to authenticated
with check(exists(select 1 from public.patrol_access a where a.patrol=patrol_records.patrol and a.email=lower(auth.jwt()->>'email')));
drop policy if exists allowed_update on public.patrol_records;
create policy allowed_update on public.patrol_records for update to authenticated
using(exists(select 1 from public.patrol_access a where a.patrol=patrol_records.patrol and a.email=lower(auth.jwt()->>'email')))
with check(exists(select 1 from public.patrol_access a where a.patrol=patrol_records.patrol and a.email=lower(auth.jwt()->>'email')));
-- The two confirmed leaders receive access to all six patrols.
insert into public.patrol_access(patrol,email)
select p,e from unnest(array['Goélands','Lions','Guépards','Orcs','Renards','Taureaux']) p
cross join unnest(array['gsvnsdl2006@gmail.com','troupeoriongsvn@gmail.com']) e
on conflict do nothing;
-- One confirmed address per patrol: exactly three authorized e-mails per patrol.
insert into public.patrol_access(patrol,email) values
('Goélands','goelandaularge@gmail.com'),
('Lions','vaillantlion0@gmail.com'),
('Guépards','guepardrapidegsvn@gmail.com'),
('Orcs','orcpuissantgsvn@gmail.com'),
('Renards','renardruseegsvn@gmail.com'),
('Taureaux','taureauvivacegsvn@gmail.com')
on conflict do nothing;
do $$ begin
 if exists(select 1 from public.patrol_access group by patrol having count(*)>3) then
 raise exception 'Une patrouille possède plus de trois adresses : vérifier la liste existante avant de continuer.';
 end if;
end $$;
commit;
