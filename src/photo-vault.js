import { get, set, entries, update as atomicUpdate } from "idb-keyval";
const prefix = "nexus-badge-photo:";
export const isImage = (value) =>
  typeof value === "string" &&
  /^data:image\/(png|jpeg|webp);base64,/.test(value);
export async function vaultEntries() {
  return (await entries())
    .filter(
      ([key, value]) =>
        typeof key === "string" &&
        key.startsWith(prefix) &&
        value?.image &&
        isImage(value.image),
    )
    .map(([key, value]) => ({
      badge: Number(key.slice(prefix.length)),
      ...value,
    }))
    .filter((x) => Number.isInteger(x.badge) && x.badge >= 0 && x.badge <= 96);
}
export async function recoverPhotos(data) {
  const copy = structuredClone(data);
  copy.badgeImages ??= {};
  const stored = await vaultEntries();
  const saved = new Map(stored.map((x) => [x.badge, x]));
  for (const [id, image] of Object.entries(copy.badgeImages)) {
    if (isImage(image) && !saved.has(Number(id))) {
      const item = {
        badge: Number(id),
        image,
        generation: crypto.randomUUID(),
        pending: true,
        expectedVersion: null,
      };
      await set(prefix + id, item);
      saved.set(Number(id), item);
    }
  }
  for (const item of saved.values()) copy.badgeImages[item.badge] = item.image;
  return copy;
}
export async function saveBadgeLocally(badge, image, expectedVersion = null) {
  if (!Number.isInteger(badge) || badge < 0 || badge > 96 || !isImage(image))
    throw Error("Invalid photo");
  const previous = await get(prefix + badge);
  const item = {
    badge,
    image,
    generation: crypto.randomUUID(),
    pending: true,
    expectedVersion: expectedVersion ?? previous?.uploadedVersion ?? null,
  };
  await set(prefix + badge, item);
  return item;
}
export async function markBadgeUploaded(badge, generation, version) {
  let matched = false;
  await atomicUpdate(prefix + badge, (item) => {
    if (item?.generation !== generation) return item;
    matched = true;
    return {
      ...item,
      pending: false,
      uploadedVersion: version,
      expectedVersion: version,
    };
  });
  return matched;
}
