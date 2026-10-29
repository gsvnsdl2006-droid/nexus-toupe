import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import {
  isLeader,
  removeMember,
  attendanceMembers,
} from "../src/leader-policy.js";
test("removing a member retains named historical attendance and export membership", () => {
  const p = {
    members: [{ id: "a", name: "Scout A" }],
    meetings: [{ id: "m", attendance: { a: "present" } }],
  };
  removeMember(p, "a");
  assert.equal(p.members.length, 0);
  assert.equal(p.meetings[0].attendance.a, "present");
  assert.equal(p.meetings[0].memberNames.a, "Scout A");
  assert.deepEqual(attendanceMembers(p.members, p.meetings), [
    { id: "a", name: "Scout A" },
  ]);
  assert.equal(
    isLeader({ id: "leader", email: "GSVNSDL2006@GMAIL.COM" }),
    true,
  );
  assert.equal(
    isLeader({ id: "patrol", email: "goelandaularge@gmail.com" }),
    false,
  );
});
test("PostgreSQL RLS and deletion trigger permit only the two leaders to remove members/events/camp dossiers", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon;create role authenticated;create schema auth;grant usage on schema auth to authenticated;create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;create function auth.role() returns text language sql stable as $$ select auth.jwt()->>'role' $$;`,
    );
    await db.exec(
      await readFile(new URL("../supabase/setup.sql", import.meta.url), "utf8"),
    );
    await db.exec(
      await readFile(
        new URL("../supabase/leader-deletion.sql", import.meta.url),
        "utf8",
      ),
    );
    await db.exec(
      await readFile(
        new URL("../supabase/camp-deletion.sql", import.meta.url),
        "utf8",
      ),
    );
    assert.equal(
      await readFile(
        new URL("../public/setup/camp-deletion.sql", import.meta.url),
        "utf8",
      ),
      await readFile(
        new URL("../supabase/camp-deletion.sql", import.meta.url),
        "utf8",
      ),
    );
    const original = {
      members: [{ id: "member", name: "Scout" }],
      meetings: [
        { id: "event", title: "Réunion", attendance: { member: "present" } },
      ],
      transactions: [
        { id: "cashflow-a", amount: 10, description: "Cotisation" },
      ],
      camp: { "Camp original": { A1: "Souvenir" } },
      camps: [
        { id: "camp-a", title: "Camp été", fields: { title: "Camp été" } },
      ],
    };
    async function reset() {
      await db.exec(`reset role;set request.jwt.claims='{}';`);
      await db.query(
        `insert into public.patrol_records(patrol,payload) values ('Goélands',$1::jsonb) on conflict(patrol) do update set payload=excluded.payload`,
        [JSON.stringify(original)],
      );
    }
    async function login(email) {
      await db.query(`select set_config('request.jwt.claims',$1,false)`, [
        JSON.stringify({ role: "authenticated", email }),
      ]);
      await db.exec("set role authenticated");
    }
    for (const email of [
      "gsvnsdl2006@gmail.com",
      "troupeoriongsvn@gmail.com",
    ]) {
      await reset();
      await login(email);
      assert.equal(
        (await db.query("select public.leader_deletion_enabled() as ready"))
          .rows[0].ready,
        true,
      );
      assert.equal(
        (await db.query("select public.camp_deletion_enabled() as ready"))
          .rows[0].ready,
        true,
      );
      await db.exec(
        `update public.patrol_records set payload=jsonb_set(jsonb_set(payload,'{camps}','[]'),'{camp}','{}') where patrol='Goélands'`,
      );
      await db.exec(
        `update public.patrol_records set payload=jsonb_set(jsonb_set(payload,'{members}','[]'),'{meetings}','[]') where patrol='Goélands'`,
      );
      assert.equal(
        (
          await db.query(
            `select jsonb_array_length(payload->'members') as n from public.patrol_records`,
          )
        ).rows[0].n,
        0,
      );
    }
    await reset();
    await login("goelandaularge@gmail.com");
    assert.equal(
      (await db.query("select public.leader_deletion_enabled() as ready"))
        .rows[0].ready,
      false,
    );
    await db.exec(
      `update public.patrol_records set payload=jsonb_set(payload,'{members,0,name}','"Nom modifié"') where patrol='Goélands'`,
    );
    for (const update of [
      `jsonb_set(payload,'{members}','[]')`,
      `jsonb_set(payload,'{meetings}','[]')`,
      `jsonb_set(payload,'{members,0,id}','"replacement-id"')`,
      `payload-'members'`,
      `jsonb_set(payload,'{camps}','[]')`,
      `payload-'camps'`,
      `jsonb_set(payload,'{camps,0,id}','"new-camp-id"')`,
      `jsonb_set(payload,'{camp}','{}')`,
      `payload-'camp'`,
    ])
      await assert.rejects(
        () =>
          db.exec(
            `update public.patrol_records set payload=${update} where patrol='Goélands'`,
          ),
        (e) => e.code === "42501",
      );
    assert.equal(
      (await db.query("select public.camp_deletion_enabled() as ready")).rows[0]
        .ready,
      false,
    );
    await db.exec(
      `update public.patrol_records set payload=jsonb_set(payload,'{camps,0,title}','"Camp renommé"') where patrol='Goélands'`,
    );
    await db.exec(
      `update public.patrol_records set payload=jsonb_set(payload,'{transactions,0,amount}','25') where patrol='Goélands'`,
    );
    await db.exec(
      `update public.patrol_records set payload=jsonb_set(payload,'{transactions}','[]') where patrol='Goélands'`,
    );
    assert.equal(
      (
        await db.query(
          `select jsonb_array_length(payload->'transactions') as n from public.patrol_records`,
        )
      ).rows[0].n,
      0,
    );
    await db.exec("reset role");
    await login("outsider@gmail.com");
    assert.equal(
      (await db.query("select * from public.patrol_records")).rows.length,
      0,
    );
  } finally {
    await db.close();
  }
});
