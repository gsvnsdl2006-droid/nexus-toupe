import "fake-indexeddb/auto";
import { test } from "node:test";
import assert from "node:assert/strict";
import { clear, set } from "idb-keyval";
import { initial } from "../src/model.js";
import {
  recoverPhotos,
  saveBadgeLocally,
  vaultEntries,
  markBadgeUploaded,
} from "../src/photo-vault.js";
const a =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
  b = "data:image/jpeg;base64,/9j/AA==";
test("badge photos survive lost main snapshot and importing an older backup without photos", async () => {
  await clear();
  const old = initial();
  old.badgeImages = { 4: a };
  await recoverPhotos(old);
  await set("nexus-data", initial());
  const recovered = await recoverPhotos(initial());
  assert.equal(recovered.badgeImages[4], a);
  const replacement = initial();
  replacement.badgeImages = { 5: b };
  const merged = await recoverPhotos(replacement);
  assert.equal(merged.badgeImages[4], a);
  assert.equal(merged.badgeImages[5], b);
});
test("late completion of an old upload cannot erase a newer photo", async () => {
  await clear();
  const first = await saveBadgeLocally(4, a);
  const next = await saveBadgeLocally(4, b);
  assert.equal(
    await markBadgeUploaded(4, first.generation, "older-version"),
    false,
  );
  const pending = (await vaultEntries())[0];
  assert.equal(pending.image, b);
  assert.equal(pending.pending, true);
  assert.equal(
    await markBadgeUploaded(4, next.generation, "latest-version"),
    true,
  );
  assert.equal((await vaultEntries())[0].pending, false);
});
