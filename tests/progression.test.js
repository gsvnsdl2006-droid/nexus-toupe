import { test } from "node:test";
import assert from "node:assert/strict";
import { progressionStats } from "../src/progression-stats.js";
test("progression counts completed badges, unique in-progress badges and stages independently per member", () => {
  const p = {
    badgeCompletions: {
      a: {
        0: { completed: true },
        4: { completed: true },
        5: { completed: true },
      },
    },
    progress: [
      { member: "a", badge: 4 },
      { member: "a", badge: 6 },
      { member: "a", badge: 6 },
      { member: "a", badge: "6" },
      { member: "a", badge: 0 },
      { member: "b", badge: 7 },
    ],
  };
  assert.deepEqual(progressionStats(p, "a"), {
    done: 2,
    inProgress: 1,
    remaining: 90,
    percent: 2.2,
    stages: 1,
  });
  assert.equal(progressionStats(p, "b").done, 0);
  p.badgeCompletions.a = Object.fromEntries(
    Array.from({ length: 93 }, (_, i) => [i + 4, { completed: true }]),
  );
  assert.equal(progressionStats(p, "a").percent, 100);
  assert.equal(progressionStats(p, "a").remaining, 0);
});
