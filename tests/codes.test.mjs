import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ALPHABET,
  MORSE,
  alphabetMap,
  normalizeText,
  transformCode,
} from "../src/codes.mjs";

test("international Morse encodes SOS and decodes words and punctuation", () => {
  assert.equal(transformCode("SOS", "morse").text, "... --- ...");
  assert.equal(
    transformCode("SOS 123?", "morse").text,
    "... --- ... / .---- ..--- ...-- ..--..",
  );
  assert.equal(
    transformCode("... --- ... / .---- ..--- ...-- ..--..", "morse", {
      decode: true,
    }).text,
    "SOS 123?",
  );
  assert.equal(new Set(Object.values(MORSE)).size, Object.keys(MORSE).length);
});
test("a numeric key C=9 generates the full shifted alphabet and reverses it", () => {
  const map = Object.fromEntries(
    alphabetMap("numbers", { from: "C", number: 9 }),
  );
  assert.equal(map.C, "9");
  assert.equal(map.D, "10");
  assert.equal(map.T, "26");
  assert.equal(map.U, "1");
  assert.equal(
    transformCode("CD TU", "numbers", { from: "C", number: 9 }).text,
    "9 10 / 26 1",
  );
  assert.equal(
    transformCode("9 10 / 26 1", "numbers", {
      from: "C",
      number: 9,
      decode: true,
    }).text,
    "CD TU",
  );
  const k = Object.fromEntries(
    alphabetMap("numbers", { from: "K", number: 7 }),
  );
  assert.equal(k.K, "7");
  assert.equal(k.L, "8");
});
test("every numeric anchor produces a bijection over 1–26", () => {
  for (const from of ALPHABET)
    for (let number = 1; number <= 26; number++) {
      const options = { from, number },
        map = alphabetMap("numbers", options);
      assert.equal(new Set(map.map(([, v]) => v)).size, 26);
      assert.equal(
        transformCode(
          transformCode(ALPHABET, "numbers", options).text,
          "numbers",
          { ...options, decode: true },
        ).text,
        ALPHABET,
      );
    }
});
test("custom A=K and reverse keys support automatic letter substitution and decoding", () => {
  assert.equal(
    transformCode("ABC XYZ", "letters", { from: "A", to: "K" }).text,
    "KLM HIJ",
  );
  assert.equal(
    transformCode("KLM HIJ", "letters", { from: "A", to: "K", decode: true })
      .text,
    "ABC XYZ",
  );
  assert.equal(
    transformCode("ZAB", "letters", { from: "Z", to: "A" }).text,
    "ABC",
  );
  for (const from of ALPHABET)
    for (const to of ALPHABET) {
      const encoded = transformCode(ALPHABET, "letters", { from, to }).text;
      assert.equal(
        transformCode(encoded, "letters", { from, to, decode: true }).text,
        ALPHABET,
      );
    }
});
test("accents normalize and unsupported text is preserved, not silently dropped", () => {
  assert.equal(
    normalizeText("Éclaireur, cœur, Æsir"),
    "ECLAIREUR, COEUR, AESIR",
  );
  for (const mode of ["morse", "numbers"]) {
    const text = "SCOUT 27 / [OK] مرحبا!";
    const encoded = transformCode(text, mode);
    assert.ok(encoded.unsupported.length);
    assert.equal(
      transformCode(encoded.text, mode, { decode: true }).text,
      normalizeText(text),
    );
  }
  assert.deepEqual(transformCode("... INVALID", "morse", { decode: true }), {
    text: "S[INVALID]",
    unsupported: ["INVALID"],
  });
});
test("Atbash reverses the alphabet and rejects invalid keys only for keyed modes", () => {
  assert.equal(transformCode("ABC XYZ", "atbash").text, "ZYX CBA");
  assert.equal(
    transformCode("ZYX CBA", "atbash", { decode: true }).text,
    "ABC XYZ",
  );
  assert.equal(
    transformCode("SOS", "morse", { from: "", to: "" }).text,
    "... --- ...",
  );
  for (const options of [
    { from: "AA" },
    { from: "" },
    { from: "A", number: 0 },
    { from: "A", number: 27 },
  ])
    assert.throws(() => alphabetMap("numbers", options), /invalid_key/);
  assert.throws(
    () => alphabetMap("letters", { from: "A", to: "9" }),
    /invalid_key/,
  );
});
