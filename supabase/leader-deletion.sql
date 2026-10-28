-- Run this ONE migration in Supabase SQL Editor to enable leader-only deletion.
-- It keeps the existing access list and data unchanged.
begin;
create or replace function public.guard_leader_deletion()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare field_name text;
begin
 if auth.role() is distinct from 'authenticated' then return new; end if;
 if lower(coalesce(auth.jwt()->>'email','')) in ('gsvnsdl2006@gmail.com','troupeoriongsvn@gmail.com') then return new; end if;
 foreach field_name in array array['members','meetings'] loop
  if exists (
   select 1 from jsonb_array_elements(coalesce(old.payload->field_name,'[]'::jsonb)) previous
   where not exists (
    select 1 from jsonb_array_elements(coalesce(new.payload->field_name,'[]'::jsonb)) current_item
    where current_item->>'id'=previous->>'id'
   )
  ) then
   raise exception 'Only the two troop leaders can delete members or events.' using errcode='42501';
  end if;
 end loop;
 return new;
end $$;
drop trigger if exists protect_member_event_deletions on public.patrol_records;
create trigger protect_member_event_deletions before update of payload on public.patrol_records
for each row execute function public.guard_leader_deletion();
create or replace function public.leader_deletion_enabled()
returns boolean language sql stable security invoker set search_path = '' as $$
 select lower(coalesce(auth.jwt()->>'email','')) in ('gsvnsdl2006@gmail.com','troupeoriongsvn@gmail.com')
 and exists(select 1 from pg_catalog.pg_trigger where tgrelid='public.patrol_records'::regclass
 and tgname='protect_member_event_deletions' and tgenabled<>'D' and not tgisinternal);
$$;
revoke all on function public.leader_deletion_enabled() from public,anon;
grant execute on function public.leader_deletion_enabled() to authenticated;
notify pgrst, 'reload schema';
commit;
