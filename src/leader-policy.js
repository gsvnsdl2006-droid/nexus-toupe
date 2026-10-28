export const leaderEmails = Object.freeze([
  "gsvnsdl2006@gmail.com",
  "troupeoriongsvn@gmail.com",
]);
export const isLeader = (user) =>
  Boolean(user?.id) &&
  leaderEmails.includes(
    String(user.email || "")
      .trim()
      .toLowerCase(),
  );
export function removeMember(patrol, id) {
  const member = patrol.members.find((m) => m.id === id);
  if (!member) return;
  for (const meeting of patrol.meetings) {
    if (Object.hasOwn(meeting.attendance, id)) {
      meeting.memberNames ??= {};
      meeting.memberNames[id] = member.name;
    }
  }
  patrol.members = patrol.members.filter((m) => m.id !== id);
}
export function attendanceMembers(members, meetings) {
  const names = new Map(members.map((m) => [m.id, m]));
  for (const meeting of meetings)
    for (const [id, name] of Object.entries(meeting.memberNames || {})) {
      if (!names.has(id)) names.set(id, { id, name });
    }
  return [...names.values()];
}
