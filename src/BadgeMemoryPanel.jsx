import React, { useState } from "react";
import { Download, Image, FileText } from "lucide-react";
export default function BadgeMemoryPanel({
  title,
  member,
  patrol,
  entries,
  cover,
  completed,
  completionDate,
}) {
  const [text, setText] = useState(true),
    [coverOn, setCover] = useState(true),
    [excluded, setExcluded] = useState(new Set()),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const photos = entries.flatMap((e) =>
    (e.photos || []).map((p) => ({
      ...p,
      date: e.date,
      key: `${e.id}:${p.id}`,
    })),
  );
  async function download() {
    setBusy(true);
    setError("");
    try {
      const { badgeMemoryPdf } = await import("./badge-memory");
      const blob = await badgeMemoryPdf({
        title,
        member,
        patrol,
        entries,
        cover,
        completed,
        completionDate,
        includeText: text,
        includeCover: coverOn,
        selectedPhotos: photos.filter((p) => !excluded.has(p.key)),
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `Souvenir - ${title} - ${member.name}.pdf`.replace(
        /[<>:"\/\\|?*\u0000-\u001f]/g,
        "-",
      );
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="badge-memory-panel">
      <div>
        <span className="eyebrow">À GARDER PRÉCIEUSEMENT</span>
        <h3>Mon souvenir de badge</h3>
        <p>
          Une fiche PDF aux couleurs de la troupe, avec ton nom, tes
          réalisations et tes photos.
        </p>
      </div>
      <label className="memory-choice">
        <input
          type="checkbox"
          checked={text}
          onChange={(e) => setText(e.target.checked)}
        />
        <FileText size={17} />
        Inclure mes réalisations
      </label>
      {cover && (
        <label className="memory-choice">
          <input
            type="checkbox"
            checked={coverOn}
            onChange={(e) => setCover(e.target.checked)}
          />
          <Image size={17} />
          Inclure la photo du badge
        </label>
      )}
      {photos.length > 0 && (
        <div className="memory-photo-choices">
          {photos.map((photo) => (
            <label key={photo.key}>
              <img src={photo.data} alt={photo.name} />
              <span>
                <input
                  aria-label={`Inclure ${photo.name}`}
                  type="checkbox"
                  checked={!excluded.has(photo.key)}
                  onChange={(e) =>
                    setExcluded((current) => {
                      const next = new Set(current);
                      e.target.checked
                        ? next.delete(photo.key)
                        : next.add(photo.key);
                      return next;
                    })
                  }
                />
                Inclure cette photo
              </span>
            </label>
          ))}
        </div>
      )}
      <button className="primary" disabled={busy} onClick={download}>
        <Download size={17} />
        {busy ? "Création de ton souvenir…" : "Télécharger mon souvenir PDF"}
      </button>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
