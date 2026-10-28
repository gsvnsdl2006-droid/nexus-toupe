export function progressionStats(patrol, member) {
  const completed = patrol.badgeCompletions?.[member] || {};
  const badges = Array.from({ length: 93 }, (_, n) => n + 4);
  const done = badges.filter((i) => completed[i]?.completed === true).length;
  const documented = new Set(
    patrol.progress
      .filter((e) => e.member === member)
      .map((e) => Number(e.badge))
      .filter(
        (i) =>
          Number.isInteger(i) &&
          i >= 4 &&
          i <= 96 &&
          completed[i]?.completed !== true,
      ),
  ).size;
  return {
    done,
    inProgress: documented,
    remaining: 93 - done - documented,
    percent: Math.round((done / 93) * 1000) / 10,
    stages: [0, 1, 2, 3].filter((i) => completed[i]?.completed === true).length,
  };
}
