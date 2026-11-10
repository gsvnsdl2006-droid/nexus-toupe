import React, { useEffect, useRef, useState } from "react";
import { ChefHat, Plus, RefreshCw } from "lucide-react";
import { patrols } from "./model";
import { isLeader } from "./leader-policy";
import { accessClient } from "./access";
import { randomId, fetchWithTimeout } from "./browser-compat";
import { compressEventPhoto } from "./photographer-images";
import SupportFeedback from "./SupportFeedback";
import "./cuisinier.css";

async function request(patrol, recipe, record, admin = false, cursor = null, method = "POST") {
  const headers = { "Content-Type": "application/json" };
  if (admin) {
    const { data, error } = await accessClient.auth.getSession();
    if (error || !data.session)
      throw Error(
        "Connecte un compte administrateur pour ajouter une recette.",
      );
    headers.Authorization = `Bearer ${data.session.access_token}`;
  }
  const response = await fetchWithTimeout(
    `/.netlify/functions/cuisinier${record ? "-write" : ""}?patrol=${patrol}${recipe ? `&recipe=${recipe}` : ""}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
    record ? { method, headers, body: JSON.stringify(record) } : {},
  );
  let result;
  try {
    result = await response.json();
  } catch {
    throw Error(
      response.status === 429
        ? "Trop d’envois. Attends une minute puis réessaie."
        : "Espace Cuisinier indisponible. Réessaie.",
    );
  }
  if (!response.ok) throw Error(result.error || "Enregistrement impossible.");
  return result;
}
function useRecipes(patrol, recipe = null) {
  const [records, setRecords] = useState([]),
    [cursor, setCursor] = useState(null),
    [loading, setLoading] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const generation = useRef(0);
  async function load(next = null) {
    const id = ++generation.current;
    setLoading(true);
    setError("");
    try {
      const data = await request(patrol, recipe, null, false, next);
      if (id !== generation.current) return;
      setRecords((old) =>
        next
          ? [
              ...old,
              ...data.records.filter((r) => !old.some((x) => x.id === r.id)),
            ]
          : data.records,
      );
      setCursor(data.cursor);
    } catch (e) {
      if (id === generation.current) setError(e.message);
    } finally {
      if (id === generation.current) setLoading(false);
    }
  }
  useEffect(() => {
    load();
    const refresh = () => {
      if (document.visibilityState !== "hidden") load();
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    const timer = setInterval(refresh, 15000);
    return () => {
      generation.current++;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
    };
  }, [patrol, recipe]);
  async function save(record, admin = false, method = "POST") {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await request(patrol, recipe, record, admin, null, method);
      generation.current++;
      setLoading(false);
      setRecords((old) => result.deleted ? old.filter((r) => r.id !== result.id) : [result, ...old.filter((r) => r.id !== result.id)]);
      setNotice("Enregistré dans l’espace partagé de la patrouille.");
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setSaving(false);
    }
  }
  return {
    records,
    cursor,
    loading,
    saving,
    error,
    notice,
    setError,
    load,
    save,
  };
}

function Experiences({ patrol, recipe }) {
  const state = useRecipes(patrol, recipe.id);
  const fresh = () => ({ id: randomId(), name: "", experience: "", image: "" });
  const [draft, setDraft] = useState(fresh),
    [processing, setProcessing] = useState(false);
  return (
    <div className="cuisinier-experiences">
      <h4>Photos et expériences</h4>
      <p>
        Tout le monde peut partager une photo ou raconter son expérience, sans
        connexion.
      </p>
      <form
        className="support-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (await state.save(draft)) setDraft(fresh());
        }}
      >
        <fieldset disabled={state.saving || processing}>
          <label>
            Ton nom (facultatif)
            <input
              maxLength={80}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <label>
            Ton expérience
            <textarea
              maxLength={5000}
              value={draft.experience}
              onChange={(e) =>
                setDraft({ ...draft, experience: e.target.value })
              }
            />
          </label>
          <label>
            Photo de la recette
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                setProcessing(true);
                state.setError("");
                try {
                  const image = await compressEventPhoto(file);
                  setDraft((old) => ({ ...old, image: image.data }));
                } catch (error) {
                  state.setError(error.message);
                } finally {
                  setProcessing(false);
                  e.target.value = "";
                }
              }}
            />
          </label>
          {draft.image && (
            <>
              <img
                className="support-photo-preview"
                src={draft.image}
                alt="Photo sélectionnée de la recette"
              />
              <button
                className="secondary"
                type="button"
                onClick={() => setDraft({ ...draft, image: "" })}
              >
                Retirer la photo
              </button>
            </>
          )}
          <button
            className="primary"
            disabled={!draft.experience.trim() && !draft.image}
          >
            {processing
              ? "Préparation de la photo…"
              : state.saving
                ? "Publication…"
                : "Partager mon expérience"}
          </button>
        </fieldset>
      </form>
      <SupportFeedback state={state} />
      {!state.loading && !state.error && !state.records.length && (
        <p>Aucune expérience partagée pour cette recette.</p>
      )}
      {state.records.map((item) => (
        <article className="cuisinier-experience" key={item.id}>
          <strong>{item.name || "Une expérience partagée"}</strong>
          <time dateTime={item.createdAt}>
            {new Date(item.createdAt).toLocaleDateString("fr-FR")}
          </time>
          {item.experience && (
            <p className="cuisinier-text">{item.experience}</p>
          )}
          {item.photo && (
            <img
              className="cuisinier-photo"
              src={item.photo}
              alt={`Photo de ${recipe.title}${item.name ? ` par ${item.name}` : ""}`}
              loading="lazy"
            />
          )}
        </article>
      ))}
    </div>
  );
}

export default function Cuisinier({ patrol, user, onSignIn }) {
  const index = patrols.indexOf(patrol),
    state = useRecipes(index);
  const [draft, setDraft] = useState(null),
    [selected, setSelected] = useState(null),
    [signingIn, setSigningIn] = useState(false);
  const admin = isLeader(user) && Boolean(user.email_confirmed_at);
  return (
    <section id="cuisinier" className="cuisinier" aria-label="Cuisinier">
      <div className="support-heading">
        <div>
          <span className="eyebrow">À TABLE EN PATROUILLE</span>
          <h2>
            <ChefHat /> Cuisinier
          </h2>
          <p>Les recettes des {patrol}, leurs photos et vos expériences.</p>
        </div>
        <button
          className="secondary"
          disabled={state.loading || state.saving}
          onClick={() => state.load()}
        >
          <RefreshCw size={16} /> Actualiser les recettes
        </button>
      </div>
      {admin ? (
        <button
          className="primary"
          disabled={state.saving || Boolean(draft)}
          onClick={() =>
            setDraft({
              id: randomId(),
              title: "",
              ingredients: "",
              instructions: "",
            })
          }
        >
          <Plus size={17} /> Ajouter une recette
        </button>
      ) : (
        <>
          <p>
            Seuls les deux administrateurs peuvent ajouter une nouvelle recette.
          </p>
          <button
            type="button"
            className="secondary"
            disabled={signingIn}
            onClick={async () => {
              setSigningIn(true);
              state.setError("");
              try {
                await onSignIn();
              } catch (e) {
                state.setError(e.message);
              } finally {
                setSigningIn(false);
              }
            }}
          >
            Connexion administrateur Cuisinier
          </button>
        </>
      )}
      {admin && draft && (
        <form
          className="support-form"
          onSubmit={async (event) => {
            event.preventDefault();
            if (await state.save(draft, true, draft.expectedVersion ? "PATCH" : "POST")) setDraft(null);
          }}
        >
          <h3>{draft.expectedVersion ? "Modifier la recette" : "Nouvelle recette"}</h3>
          <fieldset disabled={state.saving}>
            <label>
              Nom de la recette
              <input
                required
                maxLength={120}
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </label>
            <label>
              Ingrédients
              <textarea
                required
                maxLength={10000}
                value={draft.ingredients}
                onChange={(e) =>
                  setDraft({ ...draft, ingredients: e.target.value })
                }
              />
            </label>
            <label>
              Préparation
              <textarea
                required
                maxLength={20000}
                value={draft.instructions}
                onChange={(e) =>
                  setDraft({ ...draft, instructions: e.target.value })
                }
              />
            </label>
            <div className="actions">
              <button className="primary">
                {state.saving ? "Enregistrement…" : "Enregistrer la recette"}
              </button>
              <button
                className="secondary"
                type="button"
                onClick={() => setDraft(null)}
              >
                Annuler
              </button>
            </div>
          </fieldset>
        </form>
      )}
      <SupportFeedback state={state} />
      {!state.loading && !state.error && !state.records.length && (
        <p className="support-empty">
          Aucune recette enregistrée pour cette patrouille.
        </p>
      )}
      <div className="cuisinier-recipes">
        {state.records.map((recipe) => (
          <article key={recipe.id} className="cuisinier-recipe">
            <h3>{recipe.title}</h3>
            {admin && <div className="actions">
              <button className="secondary" disabled={state.saving || Boolean(draft)} onClick={() => {
                setDraft({ ...recipe, expectedVersion: recipe.version });
                document.getElementById("cuisinier")?.scrollIntoView();
              }}>Modifier la recette</button>
              <button className="secondary" disabled={state.saving || Boolean(draft)} onClick={async () => {
                if (!window.confirm(`Supprimer la recette « ${recipe.title} » ? Elle et ses photos et expériences ne seront plus visibles.`)) return;
                if (await state.save({ id: recipe.id, expectedVersion: recipe.version }, true, "DELETE")) setSelected(null);
              }}>Supprimer la recette</button>
            </div>}
            <h4>Ingrédients</h4>
            <p className="cuisinier-text">{recipe.ingredients}</p>
            <h4>Préparation</h4>
            <p className="cuisinier-text">{recipe.instructions}</p>
            <button
              className="secondary"
              aria-expanded={selected === recipe.id}
              onClick={() =>
                setSelected(selected === recipe.id ? null : recipe.id)
              }
            >
              {selected === recipe.id
                ? "Fermer les expériences"
                : "Voir les photos et partager mon expérience"}
            </button>
            {selected === recipe.id && (
              <Experiences key={recipe.id} patrol={index} recipe={recipe} />
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
