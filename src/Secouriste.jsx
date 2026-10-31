import React, { useEffect, useRef, useState } from "react";
import { HeartPulse, Plus, RefreshCw } from "lucide-react";
import { get, set } from "idb-keyval";
import { patrols, today } from "./model";
import { randomId } from "./browser-compat";
import useSupportRecords from "./useSupportRecords";
import SupportFeedback from "./SupportFeedback";
import CaseFileDownload from "./CaseFileDownload";
import ReportDownload from "./ReportDownload";
const newKit = () => ({
  id: randomId(),
  name: "",
  items: [{ name: "", quantity: 1, expiry: "" }],
  expectedVersion: null,
});
function FirstAidKits({ patrol }) {
  const state = useSupportRecords(patrols.indexOf(patrol), "kit"),
    [draft, setDraft] = useState(null);
  function item(index, field, value) {
    setDraft((d) => ({
      ...d,
      items: d.items.map((row, i) =>
        i === index ? { ...row, [field]: value } : row,
      ),
    }));
  }
  return (
    <>
      <div className="support-heading">
        <h3>Nos boîtes de secours</h3>
        <button
          className="secondary"
          disabled={state.loading || state.saving}
          onClick={() => state.load()}
        >
          <RefreshCw size={16} /> Actualiser les boîtes
        </button>
      </div>
      <p className="hint">
        Crée ta boîte et indique son contenu, les quantités et les dates de
        péremption. Les boîtes sont partagées avec la patrouille.
      </p>
      <button
        className="primary"
        disabled={state.saving}
        onClick={() => setDraft(newKit())}
      >
        <Plus size={17} /> Créer une boîte de secours
      </button>
      {draft && (
        <form
          className="support-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await state.save(draft)) setDraft(null);
          }}
        >
          <label>
            Nom de la boîte
            <input
              required
              maxLength={120}
              placeholder="Ex. Boîte du camp"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              disabled={state.saving}
            />
          </label>
          {draft.items.map((row, i) => (
            <div className="kit-item-form" key={i}>
              <label>
                Article {i + 1}
                <input
                  aria-label={`Article ${i + 1}`}
                  required
                  maxLength={120}
                  value={row.name}
                  onChange={(e) => item(i, "name", e.target.value)}
                  disabled={state.saving}
                />
              </label>
              <label>
                Quantité
                <input
                  aria-label={`Quantité article ${i + 1}`}
                  type="number"
                  required
                  min="0"
                  max="100000"
                  step="1"
                  value={row.quantity}
                  onChange={(e) => item(i, "quantity", Number(e.target.value))}
                  disabled={state.saving}
                />
              </label>
              <label>
                Péremption
                <input
                  aria-label={`Péremption article ${i + 1}`}
                  type="date"
                  value={row.expiry}
                  onChange={(e) => item(i, "expiry", e.target.value)}
                  disabled={state.saving}
                />
              </label>
              {draft.items.length > 1 && (
                <button
                  type="button"
                  className="text-btn"
                  disabled={state.saving}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      items: draft.items.filter((_, n) => i !== n),
                    })
                  }
                >
                  Retirer l’article {i + 1}
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            className="secondary"
            disabled={state.saving || draft.items.length >= 50}
            onClick={() =>
              setDraft({
                ...draft,
                items: [...draft.items, { name: "", quantity: 1, expiry: "" }],
              })
            }
          >
            <Plus size={15} /> Ajouter un article
          </button>
          <div className="actions">
            <button className="primary" disabled={state.saving}>
              {state.saving ? "Enregistrement…" : "Enregistrer la boîte"}
            </button>
            <button
              type="button"
              className="secondary"
              disabled={state.saving}
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
          Aucune boîte enregistrée. Crée la première boîte de ta patrouille.
        </p>
      )}
      <div className="support-records">
        {state.records.map((kit) => (
          <article key={kit.id} className="support-card">
            <div className="support-heading">
              <h3>{kit.name}</h3>
              <button
                className="secondary"
                disabled={state.saving}
                aria-label={`Modifier la boîte ${kit.name}`}
                onClick={() =>
                  setDraft({
                    id: kit.id,
                    name: kit.name,
                    items: kit.items.map((row) => ({ ...row })),
                    expectedVersion: kit.version,
                  })
                }
              >
                Modifier la boîte
              </button>
            </div>
            <div className="support-table">
              <table>
                <thead>
                  <tr>
                    <th>Article</th>
                    <th>Quantité</th>
                    <th>Péremption</th>
                  </tr>
                </thead>
                <tbody>
                  {kit.items.map((row, i) => (
                    <tr key={i}>
                      <td>{row.name}</td>
                      <td>{row.quantity}</td>
                      <td>{row.expiry || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
const fileTypes = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};
function CaseStudies({ patrol }) {
  const state = useSupportRecords(patrols.indexOf(patrol), "cases"),
    [name, setName] = useState(""),
    [file, setFile] = useState(null),
    [processing, setProcessing] = useState(false);
  const id = useRef(randomId()),
    sent = useRef(""),
    input = useRef(null);
  return (
    <>
      <h3>Étude de cas</h3>
      <p className="hint">
        Ajoute un document ou une image pour partager une étude de cas avec ta
        patrouille. PDF, Word, PNG, JPEG ou WebP · 3 Mo maximum.
      </p>
      <form
        className="support-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!file) return;
          const fingerprint = JSON.stringify({ name, file });
          if (sent.current && sent.current !== fingerprint)
            id.current = randomId();
          sent.current = fingerprint;
          if (await state.save({ id: id.current, name, file })) {
            setName("");
            setFile(null);
            id.current = randomId();
            sent.current = "";
            if (input.current) input.current.value = "";
          }
        }}
      >
        <label>
          Titre de l’étude de cas
          <input
            required
            maxLength={120}
            value={name}
            disabled={state.saving}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Fichier de l’étude de cas
          <input
            ref={input}
            type="file"
            aria-label="Fichier de l’étude de cas"
            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp"
            disabled={state.saving || processing}
            onChange={async (e) => {
              const selected = e.target.files[0];
              setFile(null);
              if (!selected) return;
              const mime =
                fileTypes[selected.name.split(".").pop().toLowerCase()];
              if (!mime || selected.size > 3 * 1024 * 1024) {
                state.setError(
                  "Choisis un PDF, Word ou une image de 3 Mo maximum.",
                );
                e.target.value = "";
                return;
              }
              setProcessing(true);
              state.setError("");
              try {
                const data = await new Promise((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onload = () => resolve(reader.result);
                  reader.onerror = reject;
                  reader.readAsDataURL(selected);
                });
                setFile({
                  name: selected.name.slice(0, 160),
                  data: data.replace(/^data:[^;]*;/, `data:${mime};`),
                });
              } catch {
                state.setError("Impossible de lire ce fichier. Réessaie.");
              } finally {
                setProcessing(false);
              }
            }}
          />
        </label>
        <button
          className="primary"
          disabled={state.saving || processing || !file}
        >
          {state.saving ? "Enregistrement…" : "Enregistrer l’étude de cas"}
        </button>
      </form>
      <button
        className="secondary"
        disabled={state.loading || state.saving}
        onClick={() => state.load()}
      >
        <RefreshCw size={16} /> Actualiser les études
      </button>
      <SupportFeedback state={state} />
      {!state.loading && !state.error && !state.records.length && (
        <p className="support-empty">
          Aucune étude de cas pour cette patrouille.
        </p>
      )}
      <div className="support-records">
        {state.records.map((record) => (
          <article key={record.id} className="support-card case-card">
            <h3>{record.name}</h3>
            <p>{record.file.name}</p>
            <CaseFileDownload file={record.file} />
          </article>
        ))}
      </div>
    </>
  );
}
const emptyIncident = () => ({
  id: randomId(),
  event: "",
  date: today(),
  description: "",
  actions: "",
  followup: "",
});
const incidentDraftWrites = new Map();
function Incidents({ patrol, access, shared = [], saveShared }) {
  const legacy = useRef([]),
    migrated = useRef(false);
  const [records, setRecords] = useState([]),
    [draft, setDraft] = useState(null),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [saving, setSaving] = useState(false);
  const key = `nexus-incidents:${patrol}`;
  useEffect(() => {
    let active = true;
    Promise.resolve()
      .then(() => incidentDraftWrites.get(key))
      .catch(() => {})
      .then(() => Promise.all([get(key), get(`${key}:draft`)]))
      .then(([saved, savedDraft]) => {
        if (active) {
          legacy.current = Array.isArray(saved) ? saved : [];
          setRecords(legacy.current);
          if (savedDraft?.id) setDraft(savedDraft);
        }
      })
      .catch(() => {
        if (active)
          setError(
            "Le stockage de ce navigateur est indisponible. Rédige le rapport puis télécharge-le directement en Word ou PDF.",
          );
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [key]);
  useEffect(() => {
    if (!ready) return;
    const task = (incidentDraftWrites.get(key) || Promise.resolve())
      .catch(() => {})
      .then(() => set(`${key}:draft`, draft));
    incidentDraftWrites.set(key, task);
    task.catch(() => {});
  }, [draft, ready, key]);
  useEffect(() => {
    if (!access?.membersReady || !ready) return;
    setRecords(shared);
    if (!migrated.current && legacy.current.length) {
      migrated.current = true;
      (async () => {
        for (const report of legacy.current)
          if (!shared.some((r) => r.id === report.id)) await saveShared(report);
      })().catch((e) => setError(e.message));
    }
  }, [shared, ready, access?.membersReady]);
  return (
    <>
      <h3>Incident · rapport d’événement</h3>
      <p className="hint">
        Les rapports enregistrés en ligne sont partagés uniquement avec les
        comptes autorisés de la patrouille. Les brouillons restent sur cet
        appareil. Tu peux aussi les télécharger en Word ou PDF pour Drive.
      </p>
      <button
        className="primary"
        disabled={!ready || Boolean(draft)}
        onClick={() => {
          setDraft(emptyIncident());
          setNotice("");
        }}
      >
        <Plus size={17} /> Créer un rapport d’incident
      </button>
      {draft && (
        <form
          className="support-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setSaving(true);
            setError("");
            const next = [draft, ...records.filter((r) => r.id !== draft.id)];
            try {
              try {
                await set(key, next);
              } catch (error) {
                if (!access?.configured) throw error;
              }
              if (access?.configured && !access?.membersReady) {
                setNotice(
                  "Brouillon conservé. Connecte le compte de la patrouille ou une maîtrise pour enregistrer le rapport en ligne.",
                );
                await access?.signInGoogle();
                return;
              }
              if (access?.configured && !(await saveShared(draft))) {
                setError(
                  "Rapport conservé en attente. Nouvelle tentative automatique avec la connexion Internet.",
                );
                return;
              }
              setRecords(next);
              setDraft(null);
              setNotice(
                access?.configured
                  ? "Rapport enregistré en ligne, disponible sur les appareils autorisés."
                  : "Copie locale enregistrée · connexion partagée non configurée.",
              );
            } catch (error) {
              setError(
                error.message ||
                  "Enregistrement impossible. Ton texte reste dans le formulaire ; réessaie ou télécharge-le ci-dessous.",
              );
            } finally {
              setSaving(false);
            }
          }}
        >
          <label>
            Événement ou réunion
            <input
              required
              maxLength={120}
              value={draft.event}
              disabled={saving}
              onChange={(e) => setDraft({ ...draft, event: e.target.value })}
            />
          </label>
          <label>
            Date de l’incident
            <input
              required
              type="date"
              value={draft.date}
              disabled={saving}
              onChange={(e) => setDraft({ ...draft, date: e.target.value })}
            />
          </label>
          {[
            ["description", "Description de l’incident"],
            ["actions", "Mesures prises"],
            ["followup", "Suite à donner"],
          ].map(([field, title]) => (
            <label key={field}>
              {title}
              <textarea
                required={field === "description"}
                rows={5}
                maxLength={12000}
                value={draft[field]}
                disabled={saving}
                onChange={(e) =>
                  setDraft({ ...draft, [field]: e.target.value })
                }
              />
            </label>
          ))}
          <div className="actions">
            <button className="primary" disabled={saving}>
              {saving
                ? "Enregistrement…"
                : access?.configured
                  ? "Enregistrer le rapport en ligne"
                  : "Enregistrer le rapport sur cet appareil"}
            </button>
            <button
              type="button"
              className="secondary"
              disabled={saving}
              onClick={() => {
                if (
                  confirm(
                    "Fermer ce rapport ? Pense à l’enregistrer ou à le télécharger avant de quitter.",
                  )
                )
                  setDraft(null);
              }}
            >
              Fermer
            </button>
          </div>
          {draft.event.trim() && draft.date && draft.description.trim() && (
            <div className="actions">
              <ReportDownload incident={draft} patrol={patrol} format="Word" />
              <ReportDownload incident={draft} patrol={patrol} format="PDF" />
            </div>
          )}
        </form>
      )}
      {error && (
        <p className="support-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="support-notice" role="status">
          {notice}
        </p>
      )}
      {!records.length && !draft && ready && (
        <p className="support-empty">Aucun rapport enregistré.</p>
      )}
      <div className="support-records">
        {records.map((report) => (
          <article key={report.id} className="support-card incident-card">
            <span className="eyebrow">{report.date}</span>
            <h3>{report.event}</h3>
            <p className="incident-summary">{report.description}</p>
            <div className="actions">
              <button
                className="secondary"
                onClick={() => {
                  setDraft({ ...report });
                  setNotice("");
                }}
              >
                Modifier le rapport
              </button>
              <ReportDownload
                key={`${report.id}:word`}
                incident={report}
                patrol={patrol}
                format="Word"
              />
              <ReportDownload
                key={`${report.id}:pdf`}
                incident={report}
                patrol={patrol}
                format="PDF"
              />
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
export default function Secouriste({
  patrol,
  access,
  incidents,
  saveIncident,
}) {
  const [tab, setTab] = useState("kit");
  return (
    <section className="patrol-support" aria-label="Secouriste">
      <div className="support-heading">
        <div>
          <span className="eyebrow">PRENDRE SOIN DE LA PATROUILLE</span>
          <h2>
            <HeartPulse /> Secouriste
          </h2>
          <p>L’espace secouriste des {patrol}.</p>
        </div>
      </div>
      <div className="support-tabs">
        {[
          ["kit", "Boîte de secours"],
          ["cases", "Étude de cas"],
          ["incident", "Incident"],
        ].map(([id, name]) => (
          <button
            type="button"
            key={id}
            className={tab === id ? "active" : ""}
            aria-pressed={tab === id}
            onClick={() => setTab(id)}
          >
            {name}
          </button>
        ))}
      </div>
      {tab === "kit" && <FirstAidKits patrol={patrol} />}
      {tab === "cases" && <CaseStudies patrol={patrol} />}
      {tab === "incident" && (
        <Incidents
          patrol={patrol}
          access={access}
          shared={incidents}
          saveShared={saveIncident}
        />
      )}
    </section>
  );
}
