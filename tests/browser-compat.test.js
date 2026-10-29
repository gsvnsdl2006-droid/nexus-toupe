import { test } from "node:test";
import assert from "node:assert/strict";
import readPhotos from "../netlify/functions/photographer.mjs";
import { randomId, cloneData } from "../src/browser-compat.js";
test("Safari fallbacks generate canonical UUIDs and clone plain app data", () => {
  const uuid = Object.getOwnPropertyDescriptor(globalThis.crypto, "randomUUID");
  const clone = Object.getOwnPropertyDescriptor(globalThis, "structuredClone");
  try {
    Object.defineProperty(globalThis.crypto, "randomUUID", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(globalThis, "structuredClone", {
      configurable: true,
      value: undefined,
    });
    assert.match(
      randomId(),
      /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/,
    );
    const input = { members: [{ id: "a", name: "Élie" }] },
      copy = cloneData(input);
    copy.members[0].name = "Changed";
    assert.equal(input.members[0].name, "Élie");
    assert.equal(cloneData(undefined), undefined);
  } finally {
    if (uuid) Object.defineProperty(globalThis.crypto, "randomUUID", uuid);
    else delete globalThis.crypto.randomUUID;
    Object.defineProperty(globalThis, "structuredClone", clone);
  }
});
test("legacy photo uploads redirect with method preservation to the separately rate-limited write endpoint", async () => {
  for (const method of ["POST", "DELETE"]) {
    const response = await readPhotos(
      new Request(
        "https://app.test/.netlify/functions/photographer?patrol=2&event=existing",
        { method },
      ),
    );
    assert.equal(response.status, 307);
    assert.equal(
      response.headers.get("Location"),
      "https://app.test/.netlify/functions/photographer-write?patrol=2&event=existing",
    );
  }
});
