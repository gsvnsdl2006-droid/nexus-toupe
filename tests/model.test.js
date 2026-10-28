import { test } from "node:test";
import assert from "node:assert/strict";
import { initial, totals, attendance, validBackup } from "../src/model.js";
test("six patrols have isolated workspaces and 93 badge slots", () => {
  const d = initial();
  assert.equal(Object.keys(d.patrols).length, 6);
  assert.equal(d.badges.length, 93);
  d.patrols.Lions.members.push({ name: "Test" });
  assert.equal(d.patrols.Orcs.members.length, 0);
  assert.ok(validBackup(d));
  assert.equal(validBackup({ version: 1 }), false);
});
test("cashflow aggregates income and expenses separately", () => {
  assert.deepEqual(
    totals([
      { type: "in", amount: 120 },
      { type: "out", amount: 30 },
      { type: "in", amount: "5.5" },
    ]),
    { income: 125.5, expense: 30 },
  );
});
test("attendance excludes meetings before a member joined", () => {
  assert.deepEqual(
    attendance("a", [
      { attendance: {} },
      { attendance: { a: "present" } },
      { attendance: { a: "absent" } },
      { attendance: { b: "present" } },
    ]),
    { present: 1, total: 2 },
  );
});
