import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";

test("public sections share member and incident edits without exposing treasury or secretary data", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      grant usage on schema auth to anon,authenticated;
      create function auth.jwt() returns jsonb language sql stable as $$
        select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
      create function auth.role() returns text language sql stable as $$ select auth.jwt()->>'role' $$;`);
    for (const file of ["setup.sql", "leader-deletion.sql", "camp-deletion.sql", "public-workspace.sql"])
      await db.exec(await readFile(new URL(`../supabase/${file}`, import.meta.url), "utf8"));
    // Running the migration twice must preserve all existing records and grants.
    const secret = {
      members: [{ id: "scout", name: "Shared scout" }], incidents: [],
      transactions: [{ id: "cash", amount: 50 }], meetings: [{ id: "meeting" }],
      camp: { sheet: { A1: "Private" } }, camps: [{ id: "camp" }],
    };
    await db.query("insert into public.patrol_records(patrol,payload) values ('Goélands',$1)", [JSON.stringify(secret)]);
    await db.exec(await readFile(new URL("../supabase/public-workspace.sql", import.meta.url), "utf8"));
    await db.exec("set role anon");
    assert.equal((await db.query("select public.workspace_public_read_enabled() as ready")).rows[0].ready, true);
    const visible = (await db.query("select payload from public.public_patrol_records")).rows[0].payload;
    assert.deepEqual(Object.keys(visible).sort(), ["incidents", "members"]);
    assert.equal(visible.members[0].name, "Shared scout");
    await assert.rejects(db.query("select * from public.patrol_records"), /permission denied/);
    await assert.rejects(db.query("update public.patrol_records set payload='{}'"), /permission denied/);
    const members = [...secret.members, { id: "phone", name: "Added without login" }];
    assert.equal((await db.query("select * from public.save_public_patrol('Goélands',1,$1,'[]')", [JSON.stringify(members)])).rows[0].revision, 2);
    assert.equal((await db.query("select * from public.save_public_patrol('Goélands',1,'[]','[]')")).rows.length, 0);
    await db.exec("reset role");
    const saved = (await db.query("select payload from public.patrol_records")).rows[0].payload;
    assert.deepEqual(saved.transactions, secret.transactions);
    assert.deepEqual(saved.meetings, secret.meetings);
    assert.deepEqual(saved.camps, secret.camps);
    assert.deepEqual(saved.camp, secret.camp);
    assert.equal(saved.members.length, 2);
    await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ role: "authenticated", email: "unassigned@example.com" })]);
    await db.exec("set role authenticated");
    assert.equal((await db.query("select * from public.patrol_records")).rows.length, 0);
    assert.equal((await db.query("update public.patrol_records set payload='{}' returning patrol")).rows.length, 0);
    assert.equal((await db.query("select * from public.public_patrol_records")).rows.length, 1);
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ role: "authenticated", email: "goelandaularge@gmail.com" })]);
    await db.exec("set role authenticated");
    assert.equal((await db.query("select payload from public.patrol_records")).rows[0].payload.transactions[0].amount, 50);
  } finally {
    await db.close();
  }
});
