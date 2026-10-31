import { test } from "node:test";
import assert from "node:assert/strict";
import {
  memberAliases,
  reconcileProgression,
} from "../src/progression-members.js";
test("old device-only badge work follows the canonical shared member without overwriting newer completion records", () => {
  const aliases = memberAliases(
    [{ id: "old", name: " Marc Test " }],
    [{ id: "shared", name: "MARC TEST" }],
  );
  const payload = {
    progress: [{ id: "e", member: "old", text: "Morning work" }],
    badgeCompletions: {
      old: {
        4: { completed: true, date: "2026-10-30" },
        5: { completed: true, date: "2026-10-30" },
      },
      shared: { 4: { completed: false, date: "2026-10-31" } },
    },
  };
  const result = reconcileProgression(payload, aliases);
  assert.equal(result.progress[0].member, "shared");
  assert.equal(result.badgeCompletions.shared[4].completed, false);
  assert.equal(result.badgeCompletions.shared[5].completed, true);
  assert.equal(result.badgeCompletions.old, undefined);
  assert.equal(payload.progress[0].member, "old");
});
