-- Run once in the EXISTING Supabase project. Existing records and access lists
-- are preserved. Treasury, meetings and camp records remain protected by RLS.
begin;
create or replace view public.public_patrol_records with (security_barrier = true) as
 select patrol, revision, jsonb_build_object(
   'members', coalesce(payload->'members','[]'::jsonb),
   'incidents', coalesce(payload->'incidents','[]'::jsonb)
 ) as payload from public.patrol_records;
grant usage on schema public to anon, authenticated;
grant select on public.public_patrol_records to anon, authenticated;
create or replace function public.workspace_public_read_enabled()
returns boolean language sql stable security invoker set search_path = '' as $$
 select true;
$$;
revoke all on function public.workspace_public_read_enabled() from public;
grant execute on function public.workspace_public_read_enabled() to anon, authenticated;

create or replace function public.save_public_patrol(
 target_patrol text, expected_revision bigint,
 public_members jsonb, public_incidents jsonb
) returns table(revision bigint)
language plpgsql security definer set search_path = '' as $$
begin
 if jsonb_typeof(public_members) is distinct from 'array'
 or jsonb_typeof(public_incidents) is distinct from 'array' then
   raise exception 'Invalid public records.' using errcode='22023';
 end if;
 if expected_revision is null then
   return query insert into public.patrol_records as r(patrol,payload,revision)
   values(target_patrol,jsonb_build_object('members',public_members,'incidents',public_incidents,
     'transactions','[]'::jsonb,'meetings','[]'::jsonb,'camp','{}'::jsonb,'camps','[]'::jsonb),1)
   on conflict (patrol) do nothing returning r.revision;
 else
   return query update public.patrol_records as r
   set payload=r.payload || jsonb_build_object('members',public_members,'incidents',public_incidents),
       revision=r.revision+1
   where r.patrol=target_patrol and r.revision=expected_revision
   returning r.revision;
 end if;
end;
$$;
revoke all on function public.save_public_patrol(text,bigint,jsonb,jsonb) from public,anon;
grant execute on function public.save_public_patrol(text,bigint,jsonb,jsonb) to anon, authenticated;
notify pgrst, 'reload schema';
commit;
