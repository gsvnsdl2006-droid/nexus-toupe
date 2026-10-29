import React, { useMemo, useState, useEffect } from "react";
import {
  Copy,
  Download,
  Radio,
  Hash,
  ArrowRightLeft,
  KeyRound,
  Check,
  Flag,
  ChevronUp,
} from "lucide-react";
import { SemaphoreSymbol, VowelSymbol } from "./CodeSymbols";
import { ALPHABET, alphabetMap, transformCode } from "./codes.mjs";
const modes = [
  ["morse", "Morse international", "· · · — — — · · ·", Radio],
  ["numbers", "Alphabet numéroté", "A = 1, B = 2…", Hash],
  ["letters", "Substitution de lettres", "A = K, B = L…", KeyRound],
  ["atbash", "Alphabet inversé", "A = Z, B = Y…", ArrowRightLeft],
  ["vowels", "Code des voyelles", "Grands et petits chapeaux", ChevronUp],
  ["semaphore", "Sémaphore", "L’alphabet aux deux drapeaux", Flag],
];
function draft() {
  try {
    const d = JSON.parse(sessionStorage.getItem("nexus-codes-draft") || "null");
    return {
      mode: modes.some((m) => m[0] === d?.mode) ? d.mode : "morse",
      decode: Boolean(d?.decode),
      from: ALPHABET.includes(d?.from) && d.from?.length === 1 ? d.from : "A",
      to: ALPHABET.includes(d?.to) && d.to?.length === 1 ? d.to : "K",
      number: d?.number ?? 1,
      text: typeof d?.text === "string" ? d.text.slice(0, 2500) : "",
    };
  } catch {
    return {
      mode: "morse",
      decode: false,
      from: "A",
      to: "K",
      number: 1,
      text: "",
    };
  }
}
export default function Codes() {
  const [state, setState] = useState(draft),
    [message, setMessage] = useState(""),
    [copied, setCopied] = useState(false);
  const change = (key, value) => {
    setState((s) => ({ ...s, [key]: value }));
    setMessage("");
    setCopied(false);
  };
  useEffect(() => {
    try {
      sessionStorage.setItem("nexus-codes-draft", JSON.stringify(state));
    } catch {}
  }, [state]);
  const result = useMemo(() => {
    try {
      return {
        ...transformCode(state.text, state.mode, state),
        mapping: alphabetMap(state.mode, state),
        error: "",
      };
    } catch {
      return {
        text: "",
        unsupported: [],
        mapping: [],
        error: "Choisis une lettre A–Z et un nombre entier entre 1 et 26.",
      };
    }
  }, [state]);
  async function copy() {
    try {
      await navigator.clipboard.writeText(result.text);
      setCopied(true);
      setMessage("Résultat copié !");
    } catch {
      setMessage("Sélectionne le résultat ci-dessous pour le copier.");
    }
  }
  function download() {
    const url = URL.createObjectURL(
      new Blob([result.text], { type: "text/plain;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "nexus-code.txt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="codes-workshop">
      <div className="section-heading">
        <div>
          <div className="eyebrow">TRANSMETTRE · DÉCHIFFRER · JOUER</div>
          <h2>Atelier des codes</h2>
          <p>
            Écris une phrase, choisis ta clé : le code se génère immédiatement.
          </p>
        </div>
        <span className="codes-local">
          <Check size={15} />
          Sans connexion
        </span>
      </div>
      <div className="cipher-modes" aria-label="Type de code">
        {modes.map(([key, title, example, Icon]) => (
          <button
            key={key}
            className={state.mode === key ? "active" : ""}
            aria-pressed={state.mode === key}
            onClick={() => change("mode", key)}
          >
            <Icon size={23} />
            <strong>{title}</strong>
            <small>{example}</small>
          </button>
        ))}
      </div>
      <div className="cipher-config">
        <div className="cipher-direction" aria-label="Action">
          <button
            aria-pressed={!state.decode}
            className={!state.decode ? "active" : ""}
            onClick={() => change("decode", false)}
          >
            Coder
          </button>
          <button
            aria-pressed={state.decode}
            className={state.decode ? "active" : ""}
            onClick={() => change("decode", true)}
          >
            Décoder
          </button>
        </div>
        {["numbers", "letters"].includes(state.mode) && (
          <div className="cipher-key">
            <label>
              Lettre de départ
              <select
                aria-label="Lettre de départ"
                value={state.from}
                onChange={(e) => change("from", e.target.value)}
              >
                {[...ALPHABET].map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </label>
            <span>=</span>
            {state.mode === "numbers" ? (
              <label>
                Nombre (1–26)
                <input
                  type="number"
                  min="1"
                  max="26"
                  step="1"
                  value={state.number}
                  onChange={(e) => change("number", e.target.value)}
                />
              </label>
            ) : (
              <label>
                Lettre d’arrivée
                <select
                  aria-label="Lettre d’arrivée"
                  value={state.to}
                  onChange={(e) => change("to", e.target.value)}
                >
                  {[...ALPHABET].map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
        )}
      </div>
      {state.mode === "numbers" && (
        <p className="hint">
          Exemple : C = 9 donne D = 10. Les nombres reviennent à 1 après 26.
        </p>
      )}
      {state.mode === "letters" && (
        <p className="hint">
          Exemple : A = K donne B = L. Choisis librement les deux lettres.
        </p>
      )}
      {state.mode === "vowels" && (
        <p className="hint">
          A, E, I, O, U : 1 à 5 grands chapeaux (^). Ajoute un petit chapeau (˄)
          par lettre après la voyelle précédente. Exemple : B = ^˄, E = ^^. Un
          espace sépare les lettres ; / sépare les mots.
        </p>
      )}
      {state.mode === "semaphore" && (
        <p className="hint">
          Lis les positions face au signaleur, comme sur ton tableau. Les deux
          flèches représentent les deux bras. En mode Décoder, touche les
          lettres de l’alphabet ci-dessous pour composer ton message ; / sépare
          les mots.
        </p>
      )}
      {["vowels", "semaphore"].includes(state.mode) && state.decode && (
        <button
          className="secondary"
          onClick={() => change("text", state.text.trimEnd() + " / ")}
        >
          Ajouter un espace entre les mots
        </button>
      )}
      <div className="cipher-editors">
        <div>
          <label>
            {state.decode ? "Code à décoder" : "Phrase à coder"}
            <textarea
              aria-label={state.decode ? "Code à décoder" : "Phrase à coder"}
              maxLength={2500}
              rows={7}
              value={state.text}
              placeholder={
                state.decode
                  ? "Colle ton message codé ici…"
                  : "Écris ta phrase ici…"
              }
              onChange={(e) => change("text", e.target.value)}
            />
          </label>
          <small>{state.text.length} / 2500 caractères</small>
        </div>
        <div className="cipher-result">
          <label>
            Résultat
            <textarea
              aria-label="Résultat"
              readOnly
              rows={7}
              value={result.text}
              placeholder="Ton résultat apparaît ici…"
              spellCheck={false}
            />
          </label>
          <div className="actions">
            <button
              className="secondary"
              disabled={!result.text}
              onClick={copy}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}{" "}
              {copied ? "Copié !" : "Copier"}
            </button>
            <button
              className="primary"
              disabled={!result.text}
              onClick={download}
            >
              <Download size={16} />
              Télécharger le texte
            </button>
          </div>
        </div>
      </div>
      {["vowels", "semaphore"].includes(state.mode) && result.text && (
        <div className="cipher-visual-message" aria-label="Message codé visuel">
          {(state.decode ? state.text : result.text)
            .trim()
            .split(/\s+/)
            .map((token, i) => {
              if (token === "/")
                return (
                  <span
                    key={i}
                    className="cipher-word-gap"
                    aria-label="Espace entre les mots"
                  >
                    /
                  </span>
                );
              const letter = result.mapping.find(
                ([, value]) => value === token,
              )?.[0];
              return (
                <span key={i} className="cipher-visual-letter">
                  {letter ? (
                    state.mode === "semaphore" ? (
                      <SemaphoreSymbol letter={letter} />
                    ) : (
                      <VowelSymbol token={token} />
                    )
                  ) : (
                    <code>{token}</code>
                  )}
                </span>
              );
            })}
        </div>
      )}
      {result.error && (
        <p className="cipher-warning" role="alert">
          {result.error}
        </p>
      )}
      {result.unsupported.length > 0 && (
        <p className="cipher-warning">
          Caractères hors alphabet conservés et signalés :{" "}
          {result.unsupported.join(", ")}
        </p>
      )}
      <p role="status" className="cipher-feedback">
        {message}
      </p>
      <p className="hint">
        Alphabet latin A–Z ; accents normalisés. En morse et en alphabet
        numéroté : espaces entre les lettres, / entre les mots. Les caractères
        hors alphabet sont conservés et signalés.
      </p>
      <details className="cipher-reference" open>
        <summary>
          Alphabet utilisé <span>{result.mapping.length} correspondances</span>
        </summary>
        <div
          className={`cipher-mapping ${state.mode === "morse" ? "morse-mapping" : state.mode === "vowels" ? "vowels-mapping" : ""}`}
        >
          {result.mapping.map(([from, to]) =>
            ["vowels", "semaphore"].includes(state.mode) ? (
              <button
                className="cipher-symbol-key"
                key={from}
                aria-label={`Ajouter ${from} au message`}
                onClick={() =>
                  change(
                    "text",
                    (
                      state.text +
                      (state.decode && state.text && !/\s$/.test(state.text)
                        ? " "
                        : "") +
                      (state.decode ? to : from)
                    ).slice(0, 2500),
                  )
                }
              >
                <strong>{from}</strong>
                {state.mode === "semaphore" ? (
                  <SemaphoreSymbol letter={from} />
                ) : (
                  <VowelSymbol token={to} />
                )}
                <code>{to}</code>
              </button>
            ) : (
              <div key={from}>
                <strong>{from}</strong>
                <span>=</span>
                <code>{to}</code>
              </div>
            ),
          )}
        </div>
        {state.mode === "semaphore" && (
          <div className="semaphore-space-reference">
            <SemaphoreSymbol letter=" " />
            <span>Espace entre les mots · /</span>
          </div>
        )}
      </details>
    </section>
  );
}
