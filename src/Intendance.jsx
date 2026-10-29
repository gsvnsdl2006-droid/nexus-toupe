import React, { useState } from "react";
import { Package, Plus, RefreshCw } from "lucide-react";
import { patrols } from "./model";
import { randomId, fetchWithTimeout } from "./browser-compat";
import { isLeader } from "./leader-policy";
import { compressEventPhoto } from "./photographer-images";
import useSupportRecords from "./useSupportRecords";
import EquipmentPhoto from "./EquipmentPhoto";
import SupportFeedback from "./SupportFeedback";
const fresh = () => ({
  id: randomId(),
  name: "",
  quantity: 1,
  image: "",
  expectedVersion: null,
});
export default function Intendance({ patrol, user, onSignIn }) {
  const state = useSupportRecords(patrols.indexOf(patrol), "equipment"),
    admin = isLeader(user);
  const [draft, setDraft] = useState(null),
    [processing, setProcessing] = useState(false),
    [opening, setOpening] = useState(false);
  async function edit(record) {
    state.setError("");
    setOpening(true);
    try {
      // Fetch the current item, including its photo, before opening the editor.
      const response = await fetchWithTimeout(
        `/.netlify/functions/patrol-support?patrol=${patrols.indexOf(patrol)}&section=equipment&id=${record.id}`,
      );
      const current = await response.json();
      if (!response.ok) throw Error(current.error);
      let image = "";
      if (current.photo && !current.photoCrop) {
        const photo = await fetch(current.photo);
        if (!photo.ok) throw Error("Photo indisponible. Réessaie.");
        image = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          photo.blob().then((blob) => reader.readAsDataURL(blob), reject);
        });
      }
      setDraft({
        id: current.id,
        name: current.name,
        quantity: current.quantity,
        referencePhoto: current.photoCrop
          ? {
              photo: current.photo,
              photoCrop: current.photoCrop,
              name: current.name,
            }
          : null,
        image,
        expectedVersion: current.version,
      });
    } catch (e) {
      state.setError(e.message);
    } finally {
      setOpening(false);
    }
  }
  return (
    <section className="patrol-support" aria-label="Intendance">
      <div className="support-heading">
        <div>
          <span className="eyebrow">PRÊTS POUR L’AVENTURE</span>
          <h2>
            <Package /> Intendance
          </h2>
          <p>Le matériel des {patrol}, ses photos et ses quantités.</p>
        </div>
        <button
          className="secondary"
          disabled={state.loading || state.saving}
          onClick={() => state.load()}
        >
          <RefreshCw size={16} /> Actualiser le matériel
        </button>
      </div>
      {admin ? (
        <button
          className="primary"
          onClick={() => setDraft(fresh())}
          disabled={state.saving || processing || opening}
        >
          <Plus size={17} /> Ajouter du matériel
        </button>
      ) : (
        <p className="hint">
          Liste consultable par tous. Seuls les deux administrateurs ajoutent ou
          modifient le matériel.
        </p>
      )}
      {!admin && onSignIn && (
        <button
          className="secondary"
          onClick={async () => {
            try {
              await onSignIn();
            } catch (e) {
              state.setError(e.message);
            }
          }}
        >
          Connexion administrateur
        </button>
      )}
      {admin && draft && (
        <form
          className="support-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await state.save(draft, true)) setDraft(null);
          }}
        >
          <h3>
            {draft.expectedVersion
              ? "Modifier le matériel"
              : "Nouveau matériel"}
          </h3>
          <label>
            Nom du matériel
            <input
              required
              maxLength={120}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              disabled={state.saving || processing || opening}
            />
          </label>
          <label>
            Quantité
            <input
              type="number"
              required={draft.quantity !== null}
              min="0"
              max="100000"
              step="1"
              value={draft.quantity ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, quantity: Number(e.target.value) })
              }
              disabled={
                draft.quantity === null || state.saving || processing || opening
              }
            />
          </label>
          <label className="equipment-no-quantity">
            <input
              type="checkbox"
              checked={draft.quantity === null}
              disabled={state.saving || processing || opening}
              onChange={(e) =>
                setDraft({ ...draft, quantity: e.target.checked ? null : 1 })
              }
            />{" "}
            Sans quantité
          </label>
          <label>
            Photo du matériel
            <input
              aria-label="Photo du matériel"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={processing || state.saving}
              onChange={async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                setProcessing(true);
                try {
                  const image = await compressEventPhoto(file);
                  setDraft((d) => ({ ...d, image: image.data }));
                } catch (error) {
                  state.setError(error.message);
                } finally {
                  setProcessing(false);
                  e.target.value = "";
                }
              }}
            />
          </label>
          {!draft.image && draft.referencePhoto && (
            <EquipmentPhoto
              item={draft.referencePhoto}
              className="support-photo-preview"
            />
          )}
          {draft.image && (
            <img
              className="support-photo-preview"
              src={draft.image}
              alt="Photo sélectionnée du matériel"
            />
          )}
          <div className="actions">
            <button className="primary" disabled={processing || state.saving}>
              {state.saving ? "Enregistrement…" : "Enregistrer le matériel"}
            </button>
            <button
              className="secondary"
              type="button"
              disabled={state.saving || processing || opening}
              onClick={() => setDraft(null)}
            >
              Annuler
            </button>
          </div>
        </form>
      )}
      <SupportFeedback state={state} />
      {!state.loading && !state.error && !state.records.length && (
        <p className="support-empty">
          Aucun matériel enregistré pour cette patrouille.
        </p>
      )}
      <div className="equipment-grid">
        {state.records.map((item) => (
          <article key={item.id} className="equipment-card">
            {item.photo ? (
              <EquipmentPhoto item={item} />
            ) : (
              <div className="equipment-placeholder">
                <Package size={40} />
              </div>
            )}
            <div>
              <h3>{item.name}</h3>
              <p>
                {item.quantity === null ? (
                  "Sans quantité"
                ) : (
                  <>
                    Quantité <strong>{item.quantity}</strong>
                  </>
                )}
              </p>
              {admin && (
                <button
                  className="secondary"
                  disabled={state.saving || processing || opening}
                  onClick={() => edit(item)}
                  aria-label={`Modifier le matériel ${item.name}`}
                >
                  Modifier
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
