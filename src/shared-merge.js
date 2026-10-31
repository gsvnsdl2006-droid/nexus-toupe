import { cloneData } from "./browser-compat.js";
import { mergePrivate } from "./private-sync.js";
// Completion dates describe a status, not a second independently editable field.
// Migrating two copies of the same completed badge must not block new notes.
export function mergeWorkspace(before, after, remote) {
  if (!after.badgeCompletions || !remote.badgeCompletions)
    return mergePrivate(before, after, remote);
  const base = cloneData(before),
    local = cloneData(after);
  for (const [member, badges] of Object.entries(local.badgeCompletions)) {
    for (const [badge, value] of Object.entries(badges)) {
      const theirs = remote.badgeCompletions[member]?.[badge],
        previous = base.badgeCompletions?.[member]?.[badge];
      if (!theirs) continue;
      if (value.completed === theirs.completed) value.date = theirs.date;
      else if (
        previous &&
        value.completed !== previous.completed &&
        theirs.completed === previous.completed
      ) {
        base.badgeCompletions[member][badge].date = theirs.date;
      } else if (previous && value.completed === previous.completed)
        value.date = previous.date;
    }
  }
  return mergePrivate(base, local, remote);
}
