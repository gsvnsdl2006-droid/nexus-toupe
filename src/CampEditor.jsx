import React, { useState, useEffect } from "react";
import {
  Plus,
  ArrowLeft,
  Download,
  Check,
  FolderOpen,
  ChevronRight,
} from "lucide-react";
import { campCategories, createCamp } from "./camp";
import { uid, today } from "./model";
export default function CampEditor({
  patrol,
  camps,
  legacy,
  save,
  download,
  downloadLegacy,
  status,
}) {
  const [selected, select] = useState(null),
    [category, choose] = useState(null),
    [draft, setDraft] = useState({}),
    [dirty, setDirty] = useState(false),
    [creating, setCreating] = useState(false);
  const camp = camps.find((c) => c.id === selected);
  useEffect(() => {
    setDraft(camp?.fields || {});
    setDirty(false);
  }, [selected, category]);
  function navigate(fn) {
    if (
      dirty &&
      !confirm(
        "Vous avez des modifications non enregistrées. Quitter cette catégorie ?",
      )
    )
      return;
    fn();
  }
  function saveCategory(e) {
    e.preventDefault();
    save({
      ...camp,
      title: draft.title?.trim() || camp.title,
      fields: draft,
      updated: Math.max(Date.now(), (camp.updated || 0) + 1),
    });
    setDirty(false);
  }
  return (
    <div className="camp-editor">
      <div className="section-heading">
        <div>
          <h2>Dossiers de camp · {patrol}</h2>
          <p>
            Choisissez une catégorie, remplissez les champs, enregistrez. Votre
            Excel est créé automatiquement dans Drive.
          </p>
        </div>
        {!camp && (
          <button className="primary" onClick={() => setCreating(true)}>
            <Plus size={17} />
            Nouveau dossier
          </button>
        )}
      </div>
      {creating && (
        <form
          className="camp-create"
          onSubmit={(e) => {
            e.preventDefault();
            const title = new FormData(e.currentTarget).get("name").trim();
            if (!title) return;
            const c = createCamp(uid(), title, today());
            save(c);
            select(c.id);
            choose(null);
            setCreating(false);
          }}
        >
          <label>
            Nom du dossier
            <input
              name="name"
              required
              maxLength={120}
              placeholder="Camp de Noël 2026"
            />
          </label>
          <div className="actions">
            <button className="primary">
              <FolderOpen size={16} />
              Créer le dossier
            </button>
            <button
              className="secondary"
              type="button"
              onClick={() => setCreating(false)}
            >
              Annuler
            </button>
          </div>
        </form>
      )}
      {!camp ? (
        <div className="camp-folders">
          {!camps.length && !creating && (
            <div className="empty">
              <FolderOpen size={35} />
              <h3>Préparons le prochain camp</h3>
              <p>
                Créez un dossier, puis complétez ses catégories à votre rythme.
              </p>
            </div>
          )}
          {camps.map((c) => (
            <button
              className="camp-folder"
              key={c.id}
              onClick={() => {
                select(c.id);
                choose(null);
              }}
            >
              <FolderOpen />
              <div>
                <h3>{c.fields.title || c.title}</h3>
                <small>
                  {
                    campCategories.filter((cat) =>
                      cat.fields.some(
                        ([k]) =>
                          k !== "title" && String(c.fields[k] ?? "").trim(),
                      ),
                    ).length
                  }{" "}
                  / {campCategories.length} catégories commencées
                </small>
              </div>
              <ChevronRight size={18} />
            </button>
          ))}
        </div>
      ) : (
        <>
          <button
            className="back"
            onClick={() =>
              navigate(() => {
                select(null);
                choose(null);
              })
            }
          >
            <ArrowLeft size={16} />
            Tous les dossiers
          </button>
          <div className="camp-heading">
            <h3>{camp.fields.title || camp.title}</h3>
            <button className="secondary" onClick={() => download(camp)}>
              <Download size={16} />
              Télécharger Excel
            </button>
          </div>
          {status}
          {!category ? (
            <div className="camp-categories">
              {campCategories.map((c) => (
                <button key={c.id} onClick={() => choose(c.id)}>
                  <span>{c.icon}</span>
                  <h3>{c.name}</h3>
                  <small>
                    {
                      c.fields.filter(([k]) =>
                        String(camp.fields[k] ?? "").trim(),
                      ).length
                    }{" "}
                    / {c.fields.length} champs remplis
                  </small>
                  <ChevronRight size={17} />
                </button>
              ))}
            </div>
          ) : (
            <form className="camp-form" onSubmit={saveCategory}>
              <button
                className="back"
                type="button"
                onClick={() => navigate(() => choose(null))}
              >
                <ArrowLeft size={16} />
                Catégories du camp
              </button>
              <h3>{campCategories.find((c) => c.id === category).name}</h3>
              {campCategories
                .find((c) => c.id === category)
                .fields.map(([key, label, type]) => (
                  <label key={key}>
                    {label}
                    {type === "textarea" ? (
                      <textarea
                        rows={4}
                        value={draft[key] ?? ""}
                        onChange={(e) => {
                          setDraft({ ...draft, [key]: e.target.value });
                          setDirty(true);
                        }}
                      />
                    ) : (
                      <input
                        type={type || "text"}
                        min={type === "number" ? 0 : undefined}
                        step={type === "number" ? "any" : undefined}
                        value={draft[key] ?? ""}
                        onChange={(e) => {
                          setDraft({ ...draft, [key]: e.target.value });
                          setDirty(true);
                        }}
                      />
                    )}
                  </label>
                ))}
              <div className="camp-save">
                <button className="primary">
                  <Check size={17} />
                  Enregistrer la catégorie
                </button>
                <span>
                  {dirty
                    ? "Modifications à enregistrer"
                    : "Catégorie enregistrée sur cet appareil"}
                </span>
              </div>
              {status}
            </form>
          )}
        </>
      )}
      {Object.keys(legacy || {}).length > 0 && (
        <div className="legacy-camp">
          <strong>Votre ancien dossier est conservé</strong>
          <p>
            Les anciennes cellules restent disponibles dans leur fichier Excel.
            Les nouveaux dossiers utilisent les formulaires simplifiés.
          </p>
          <button className="secondary" onClick={downloadLegacy}>
            <Download size={16} />
            Télécharger l’ancien dossier
          </button>
        </div>
      )}
    </div>
  );
}
