import { randomId, fetchWithTimeout } from "./browser-compat.js";
import React, { useEffect, useRef, useState } from "react";
import {
  Camera,
  CalendarDays,
  Plus,
  RefreshCw,
  Upload,
  X,
  CheckCircle2,
  Trash2,
} from "lucide-react";
import { accessClient } from "./access";
import { isLeader } from "./leader-policy";
import { get, set } from "idb-keyval";
import { patrols, today } from "./model";
import { compressEventPhoto } from "./photographer-images";
const endpoint = "/.netlify/functions/photographer";
async function call(url, options) {
  const response = await fetchWithTimeout(url, options);
  let data;
  try {
    data = await response.json();
  } catch {
    throw Error(
      response.status === 429
        ? "Trop d’envois à la fois. Attends une minute puis réessaie ; tes photos sont conservées."
        : "L’album est indisponible. Réessaie dans un instant.",
    );
  }
  if (!response.ok)
    throw Error(
      response.status === 429
        ? "Trop d’envois à la fois. Attends une minute puis réessaie ; tes photos sont conservées."
        : data.error || "Envoi impossible. Réessaie dans un instant.",
    );
  return data;
}
export default function Photographer({
  patrol: initialPatrol,
  user,
  onSignIn,
}) {
  const [patrol, setPatrol] = useState(
      Math.max(0, patrols.indexOf(initialPatrol)),
    ),
    [events, setEvents] = useState([]),
    [cursor, setCursor] = useState(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [editing, setEditing] = useState(false),
    [title, setTitle] = useState(""),
    [date, setDate] = useState(today()),
    [photos, setPhotos] = useState([]),
    [processing, setProcessing] = useState(false),
    [saving, setSaving] = useState(false),
    [draftPatrol, setDraftPatrol] = useState(null),
    [notice, setNotice] = useState(""),
    [preview, setPreview] = useState(null),
    [deleting, setDeleting] = useState(false);
  const writes = useRef(Promise.resolve());
  const request = useRef(0),
    eventId = useRef(randomId()),
    fingerprint = useRef("");
  async function load(next = null) {
    const id = ++request.current;
    setLoading(true);
    setError("");
    try {
      const result = await call(
        `${endpoint}?patrol=${patrol}${next ? `&cursor=${encodeURIComponent(next)}` : ""}`,
      );
      if (id !== request.current) return;
      setEvents((old) =>
        next
          ? [
              ...old,
              ...result.events.filter((e) => !old.some((x) => x.id === e.id)),
            ]
          : result.events,
      );
      setCursor(result.cursor);
    } catch (e) {
      if (id === request.current) setError(e.message);
    } finally {
      if (id === request.current) setLoading(false);
    }
  }
  useEffect(() => {
    setEvents([]);
    setCursor(null);
    setNotice("");
    load();
    return () => {
      request.current++;
    };
  }, [patrol]);
  useEffect(() => {
    const refresh = () => {
      if (
        document.visibilityState !== "hidden" &&
        !editing &&
        !saving &&
        !deleting
      )
        load();
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [patrol, editing, saving, deleting]);
  useEffect(() => {
    let active = true;
    setDraftPatrol(null);
    setEditing(false);
    setTitle("");
    setDate(today());
    setPhotos([]);
    eventId.current = randomId();
    fingerprint.current = "";
    writes.current
      .catch(() => {})
      .then(() => get(`nexus-photo-event-draft:${patrol}`))
      .then((draft) => {
        if (!active) return;
        setTitle(draft?.title || "");
        setDate(draft?.date || today());
        setPhotos(Array.isArray(draft?.photos) ? draft.photos : []);
        setEditing(Boolean(draft?.title || draft?.photos?.length));
        eventId.current = draft?.id || randomId();
        fingerprint.current = draft?.fingerprint || "";
        setDraftPatrol(patrol);
      })
      .catch(() => {
        if (active) setDraftPatrol(patrol);
      });
    return () => {
      active = false;
    };
  }, [patrol]);
  useEffect(() => {
    if (draftPatrol !== patrol) return;
    const snapshot = {
      title,
      date,
      photos,
      id: eventId.current,
      fingerprint: fingerprint.current,
    };
    writes.current = writes.current
      .catch(() => {})
      .then(() => set(`nexus-photo-event-draft:${patrol}`, snapshot));
    // A failed local draft never masquerades as a successful server upload.
    writes.current.catch(() => {});
  }, [title, date, photos, patrol, draftPatrol, saving]);
  useEffect(() => {
    if (!preview) return;
    const close = (e) => {
      if (e.key === "Escape") setPreview(null);
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [preview]);
  async function addPhotos(e) {
    const files = [...e.target.files];
    e.target.value = "";
    if (photos.length + files.length > 4) {
      setError(
        "4 photos maximum par événement. Retire une photo pour en choisir une autre.",
      );
      return;
    }
    setError("");
    setProcessing(true);
    try {
      const additions = [];
      for (const file of files) additions.push(await compressEventPhoto(file));
      setPhotos((old) => [...old, ...additions]);
    } catch (e) {
      setError(e.message);
    } finally {
      setProcessing(false);
    }
  }
  async function publish(e) {
    e.preventDefault();
    if (!photos.length || processing || saving || deleting) return;
    setSaving(true);
    setError("");
    setNotice("");
    const content = JSON.stringify({ title, date, photos });
    if (fingerprint.current && fingerprint.current !== content)
      eventId.current = randomId();
    fingerprint.current = content;
    try {
      const result = await call(`${endpoint}?patrol=${patrol}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: eventId.current, title, date, photos }),
      });
      // Invalidate an earlier gallery read so it cannot hide the new event.
      request.current++;
      setLoading(false);
      setEvents((old) => [result, ...old.filter((x) => x.id !== result.id)]);
      setNotice(
        "Événement et photos enregistrés durablement. Ils sont visibles par tous.",
      );
      setTitle("");
      setPhotos([]);
      setEditing(false);
      eventId.current = randomId();
      fingerprint.current = "";
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }
  async function removeEvent(event) {
    if (!isLeader(user) || deleting || saving) return;
    if (
      !confirm(
        `Supprimer définitivement « ${event.title} » et toutes ses photos ?`,
      )
    )
      return;
    setDeleting(true);
    setError("");
    setNotice("");
    try {
      const { data, error } = await accessClient.auth.getSession();
      if (error || !data.session?.access_token)
        throw Error("Reconnecte-toi avec ton compte administrateur.");
      await call(`${endpoint}?patrol=${event.patrol}&event=${event.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${data.session.access_token}` },
      });
      request.current++;
      setLoading(false);
      setEvents((old) => old.filter((e) => e.id !== event.id));
      setNotice("Événement et photos supprimés de l’album partagé.");
    } catch (e) {
      setError(e.message);
    } finally {
      setDeleting(false);
    }
  }
  return (
    <section className="photographer" aria-label="Photographe">
      <div className="photo-heading">
        <div>
          <span className="eyebrow">LES INSTANTS QUI NOUS RASSEMBLENT</span>
          <h2>
            <Camera /> Photographe
          </h2>
          <p>Un événement, quatre photos, des souvenirs à partager.</p>
        </div>
        <button
          className="primary"
          onClick={() => {
            setEditing(true);
            setNotice("");
          }}
          disabled={saving || deleting || draftPatrol !== patrol}
        >
          <Plus size={17} /> Créer un événement
        </button>
      </div>
      <div className="photo-toolbar">
        <label>
          Patrouille
          <select
            aria-label="Patrouille"
            value={patrol}
            disabled={editing || saving || deleting || draftPatrol !== patrol}
            onChange={(e) => setPatrol(Number(e.target.value))}
          >
            {patrols.map((p, i) => (
              <option key={p} value={i}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <button
          className="secondary"
          onClick={() => load()}
          disabled={loading || saving || deleting}
        >
          <RefreshCw size={16} /> Actualiser
        </button>
      </div>
      {!isLeader(user) && onSignIn && accessClient && (
        <button
          type="button"
          className="photo-admin-login secondary"
          onClick={async () => {
            try {
              await onSignIn();
            } catch (e) {
              setError(e.message);
            }
          }}
        >
          Connexion administrateur
        </button>
      )}
      {isLeader(user) && (
        <p className="hint">
          Compte administrateur · tu peux supprimer un événement et ses photos.
        </p>
      )}
      {editing && (
        <form className="photo-event-form" onSubmit={publish}>
          <div className="photo-form-title">
            <h3>Un souvenir des {patrols[patrol]}</h3>
            <button
              type="button"
              className="icon-btn"
              aria-label="Fermer le formulaire photo"
              disabled={saving || processing}
              onClick={() => setEditing(false)}
            >
              <X size={18} />
            </button>
          </div>
          <div className="photo-fields">
            <label>
              Nom de l’événement ou de la réunion
              <input
                required
                maxLength={120}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={saving}
                placeholder="Ex. Réunion de patrouille"
              />
            </label>
            <label>
              Date de l’événement
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={saving}
              />
            </label>
          </div>
          <label className="photo-upload-zone">
            <Upload size={25} />
            <strong>
              {processing ? "Préparation des photos…" : "Choisir des photos"}
            </strong>
            <span>
              {photos.length} / 4 photos · JPG, PNG ou WebP · Compression
              automatique
            </span>
            <input
              aria-label="Photos de l’événement"
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              onChange={addPhotos}
              disabled={processing || saving || photos.length === 4}
            />
          </label>
          {photos.length > 0 && (
            <div className="photo-selection">
              {photos.map((p, i) => (
                <div key={i}>
                  <img src={p.data} alt={`Photo sélectionnée ${i + 1}`} />
                  <button
                    type="button"
                    disabled={saving || processing}
                    aria-label={`Retirer la photo ${i + 1}`}
                    onClick={() =>
                      setPhotos((old) => old.filter((_, j) => i !== j))
                    }
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <p className="hint">
            Album public : chacun peut publier et consulter les photos, sans
            connexion.
          </p>
          <button
            className="primary"
            disabled={saving || deleting || processing || !photos.length}
            type="submit"
          >
            <Camera size={17} />
            {saving
              ? "Enregistrement des photos…"
              : "Publier l’événement et les photos"}
          </button>
        </form>
      )}
      {error && (
        <p className="photo-error" role="alert">
          {error}{" "}
          <button
            className="secondary"
            onClick={() => load()}
            disabled={loading || saving || deleting}
          >
            Réessayer l’album
          </button>
        </p>
      )}
      {notice && (
        <p className="photo-notice" role="status">
          <CheckCircle2 size={18} />
          {notice}
        </p>
      )}
      {loading && <p role="status">Chargement des souvenirs…</p>}
      {!loading && !error && !events.length && (
        <div className="photo-empty">
          <Camera size={38} />
          <h3>Le prochain souvenir commence avec toi.</h3>
          <p>
            Crée le premier événement des {patrols[patrol]} et partage jusqu’à
            quatre photos.
          </p>
        </div>
      )}
      <div className="photo-events">
        {[...events]
          .sort(
            (a, b) =>
              b.date.localeCompare(a.date) ||
              b.createdAt.localeCompare(a.createdAt),
          )
          .map((event) => (
            <article className="photo-event-card" key={event.id}>
              <div className="photo-event-title">
                <span className="eyebrow">{patrols[event.patrol]}</span>
                <h3>{event.title}</h3>
                {isLeader(user) && (
                  <button
                    type="button"
                    className="delete-action photo-delete"
                    disabled={deleting || saving}
                    aria-label={`Supprimer l’événement photo ${event.title}`}
                    onClick={() => removeEvent(event)}
                  >
                    <Trash2 size={15} /> Supprimer l’événement et ses photos
                  </button>
                )}
                <p>
                  <CalendarDays size={15} />
                  {new Intl.DateTimeFormat("fr-FR", {
                    dateStyle: "long",
                  }).format(new Date(event.date + "T12:00:00"))}
                  <span>
                    · {event.photos.length} photo
                    {event.photos.length > 1 ? "s" : ""}
                  </span>
                </p>
              </div>
              <div className="photo-event-grid">
                {event.photos.map((photo, i) => (
                  <button
                    type="button"
                    key={photo.url}
                    aria-label={`Agrandir ${event.title}, photo ${i + 1}`}
                    onClick={() => setPreview({ ...photo, title: event.title })}
                  >
                    <img
                      src={photo.url}
                      alt={`${event.title} — photo ${i + 1}`}
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            </article>
          ))}
      </div>
      {cursor && (
        <button
          className="secondary"
          disabled={loading || saving || deleting}
          onClick={() => load(cursor)}
        >
          Voir plus de souvenirs
        </button>
      )}
      {preview && (
        <div
          className="photo-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={preview.title}
          onClick={() => setPreview(null)}
        >
          <button
            autoFocus
            className="icon-btn"
            aria-label="Fermer la photo"
            onClick={() => setPreview(null)}
          >
            <X size={24} />
          </button>
          <img
            src={preview.url}
            alt={preview.title}
            onClick={(e) => e.stopPropagation()}
          />
          <p>{preview.title}</p>
        </div>
      )}
    </section>
  );
}
