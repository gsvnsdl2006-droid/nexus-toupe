import { badges } from "./badges.js";
export const patrols = [
  "Goélands",
  "Lions",
  "Guépards",
  "Orcs",
  "Renards",
  "Taureaux",
];
export const activities = [
  "concours cuisine",
  "journee de patrouille",
  "camp de patrouille",
  "caisse de patrouille",
];
export const uid = () => crypto.randomUUID();
export const today = () => new Date().toLocaleDateString("en-CA");
export const initial = () => ({
  version: 1,
  updated: Date.now(),
  badges: [...badges],
  patrols: Object.fromEntries(
    patrols.map((p) => [
      p,
      {
        members: [],
        transactions: [],
        meetings: [],
        camp: {},
        camps: [],
        progress: [],
      },
    ]),
  ),
});
export function totals(rows) {
  return rows.reduce(
    (a, r) => ({
      income: a.income + (r.type === "in" ? Number(r.amount) : 0),
      expense: a.expense + (r.type === "out" ? Number(r.amount) : 0),
    }),
    { income: 0, expense: 0 },
  );
}
export function attendance(member, meetings) {
  const relevant = meetings.filter((m) => Object.hasOwn(m.attendance, member));
  return {
    present: relevant.filter((m) => m.attendance[member] === "present").length,
    total: relevant.length,
  };
}
export function validBackup(d) {
  return (
    d?.version === 1 &&
    Array.isArray(d.badges) &&
    d.badges.length === 93 &&
    patrols.every((p) => {
      const x = d.patrols?.[p];
      return (
        x &&
        ["members", "transactions", "meetings", "progress"].every((k) =>
          Array.isArray(x[k]),
        ) &&
        x.camp &&
        typeof x.camp === "object" &&
        (!x.camps ||
          (Array.isArray(x.camps) &&
            x.camps.every(
              (c) =>
                typeof c.id === "string" &&
                typeof c.title === "string" &&
                c.fields &&
                typeof c.fields === "object",
            )))
      );
    })
  );
}
