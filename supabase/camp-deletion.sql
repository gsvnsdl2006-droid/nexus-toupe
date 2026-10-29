-- Run once in Supabase SQL Editor. Existing dossiers and access grants are preserved.
begin;
create or replace function public.guard_camp_deletion()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
 if auth.role() is distinct from 'authenticated' then return new; end if;
 if lower(coalesce(auth.jwt()->>'email','')) in ('gsvnsdl2006@gmail.com','troupeoriongsvn@gmail.com') then return new; end if;
 if exists (
  select 1 from jsonb_array_elements(coalesce(old.payload->'camps','[]'::jsonb)) previous
  where not exists (
   select 1 from jsonb_array_elements(coalesce(new.payload->'camps','[]'::jsonb)) current_item
   where current_item->>'id'=previous->>'id'
  )
 ) or exists (
  select 1 from jsonb_object_keys(coalesce(old.payload->'camp','{}'::jsonb)) previous_key
  where not coalesce(new.payload->'camp','{}'::jsonb) ? previous_key
 ) then
  raise exception 'Only the two troop leaders can delete camp dossiers.' using errcode='42501';
 end if;
 return new;
end $$;
drop trigger if exists protect_camp_deletions on public.patrol_records;
create trigger protect_camp_deletions before update of payload on public.patrol_records
for each row execute function public.guard_camp_deletion();
create or replace function public.camp_deletion_enabled()
returns boolean language sql stable security invoker set search_path = '' as $$
 select lower(coalesce(auth.jwt()->>'email','')) in ('gsvnsdl2006@gmail.com','troupeoriongsvn@gmail.com')
 and exists(select 1 from pg_catalog.pg_trigger where tgrelid='public.patrol_records'::regclass
 and tgname='protect_camp_deletions' and tgenabled<>'D' and not tgisinternal);
$$;
revoke all on function public.camp_deletion_enabled() from public,anon;
grant execute on function public.camp_deletion_enabled() to authenticated;
notify pgrst, 'reload schema';
commit;
