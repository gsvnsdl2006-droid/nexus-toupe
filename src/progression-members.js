import { cloneData } from "./browser-compat.js";
const key = (name) => String(name).trim().toLocaleLowerCase("fr");
export function memberAliases(previous, current) {
  const names = new Map(current.map((member) => [key(member.name), member.id]));
  return Object.fromEntries(
    previous.flatMap((member) => {
      const id = names.get(key(member.name));
      return id && id !== member.id ? [[member.id, id]] : [];
    }),
  );
}
export function reconcileProgression(payload, aliases = {}) {
  const next = cloneData(payload);
  const target = (id) => {
    const seen = new Set();
    while (aliases[id] && !seen.has(id)) {
      seen.add(id);
      id = aliases[id];
    }
    return id;
  };
  next.progress = next.progress.map((entry) => ({
    ...entry,
    member: target(entry.member),
  }));
  const completions = {};
  // Canonical records win over old duplicate cards for the same member.
  for (const [member, badges] of Object.entries(next.badgeCompletions))
    if (target(member) !== member)
      completions[target(member)] = {
        ...completions[target(member)],
        ...badges,
      };
  for (const [member, badges] of Object.entries(next.badgeCompletions))
    if (target(member) === member)
      completions[member] = { ...completions[member], ...badges };
  next.badgeCompletions = completions;
  return next;
}
