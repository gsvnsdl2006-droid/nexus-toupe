export const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
export const MORSE = Object.freeze({
  A: ".-",
  B: "-...",
  C: "-.-.",
  D: "-..",
  E: ".",
  F: "..-.",
  G: "--.",
  H: "....",
  I: "..",
  J: ".---",
  K: "-.-",
  L: ".-..",
  M: "--",
  N: "-.",
  O: "---",
  P: ".--.",
  Q: "--.-",
  R: ".-.",
  S: "...",
  T: "-",
  U: "..-",
  V: "...-",
  W: ".--",
  X: "-..-",
  Y: "-.--",
  Z: "--..",
  0: "-----",
  1: ".----",
  2: "..---",
  3: "...--",
  4: "....-",
  5: ".....",
  6: "-....",
  7: "--...",
  8: "---..",
  9: "----.",
  ".": ".-.-.-",
  ",": "--..--",
  "?": "..--..",
  "'": ".----.",
  "!": "-.-.--",
  "/": "-..-.",
  "(": "-.--.",
  ")": "-.--.-",
  "&": ".-...",
  ":": "---...",
  ";": "-.-.-.",
  "=": "-...-",
  "+": ".-.-.",
  "-": "-....-",
  _: "..--.-",
  '"': ".-..-.",
  $: "...-..-",
  "@": ".--.-.",
});
const mod = (value) => ((value % 26) + 26) % 26;
export const normalizeText = (text) =>
  String(text)
    .replace(/œ/gi, "OE")
    .replace(/æ/gi, "AE")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase();
function letter(value) {
  const result = normalizeText(value);
  if (!/^[A-Z]$/.test(result)) throw new Error("invalid_key");
  return result;
}
export function alphabetMap(mode, options = {}) {
  if (mode === "atbash")
    return [...ALPHABET].map((key, index) => [key, ALPHABET[25 - index]]);
  if (mode === "morse") {
    const ordered = [
      ...ALPHABET,
      ..."0123456789",
      ...Object.keys(MORSE).filter((char) => !/^[A-Z0-9]$/.test(char)),
    ];
    return ordered.map((char) => [char, MORSE[char]]);
  }
  if (!["numbers", "letters"].includes(mode)) throw new Error("invalid_mode");
  const from = letter(options.from ?? "A");
  if (mode === "numbers") {
    const value = Number(options.number ?? 1);
    if (!Number.isInteger(value) || value < 1 || value > 26)
      throw new Error("invalid_key");
    return [...ALPHABET].map((key, index) => [
      key,
      String(mod(index - ALPHABET.indexOf(from) + value - 1) + 1),
    ]);
  }
  if (mode === "letters") {
    const to = letter(options.to ?? "K"),
      shift = ALPHABET.indexOf(to) - ALPHABET.indexOf(from);
    return [...ALPHABET].map((key, index) => [
      key,
      ALPHABET[mod(index + shift)],
    ]);
  }
  throw new Error("invalid_mode");
}

export function transformCode(text, mode, options = {}) {
  const mapping = Object.fromEntries(alphabetMap(mode, options));
  const reverse = Object.fromEntries(
    Object.entries(mapping).map(([a, b]) => [b, a]),
  );
  const decode = Boolean(options.decode),
    unknown = new Set();
  const input = normalizeText(text).trim();
  if (!input) return { text: "", unsupported: [] };
  if (mode === "letters" || mode === "atbash") {
    const map = decode ? reverse : mapping;
    return {
      text: [...input]
        .map((char) => {
          if (map[char]) return map[char];
          if (/\p{L}/u.test(char)) unknown.add(char);
          return char;
        })
        .join(""),
      unsupported: [...unknown],
    };
  }
  if (decode) {
    const output = input
      .split(/\s*\/\s*/)
      .map((word) =>
        word
          .trim()
          .split(/\s+/)
          .filter(Boolean)
          .map((token) => {
            if (/^\[.+\]$/u.test(token)) {
              let literal;
              try {
                literal = decodeURIComponent(token.slice(1, -1));
              } catch {
                literal = token.slice(1, -1);
              }
              unknown.add(literal);
              return literal;
            }
            if (reverse[token]) return reverse[token];
            unknown.add(token);
            return `[${token}]`;
          })
          .join(""),
      )
      .join(" ");
    return { text: output, unsupported: [...unknown] };
  }
  return {
    text: input
      .split(/\s+/)
      .map((word) =>
        [...word]
          .map((char) => {
            if (mapping[char]) return mapping[char];
            unknown.add(char);
            return `[${encodeURIComponent(char)}]`;
          })
          .join(" "),
      )
      .join(" / "),
    unsupported: [...unknown],
  };
}
