import React, { useEffect, useState } from "react";
import { Download } from "lucide-react";
export default function ReportDownload({ incident, patrol, format }) {
  const [busy, setBusy] = useState(false),
    [ready, setReady] = useState(null),
    [error, setError] = useState("");
  useEffect(
    () => () => {
      if (ready) URL.revokeObjectURL(ready.url);
    },
    [ready],
  );
  useEffect(() => {
    setReady(null);
  }, [
    incident.event,
    incident.date,
    incident.description,
    incident.actions,
    incident.followup,
    patrol,
  ]);
  async function create() {
    setBusy(true);
    setError("");
    try {
      const exports = await import("./incident-export");
      const blob = await (format === "PDF"
        ? exports.incidentPdf(incident, patrol)
        : exports.incidentWord(incident, patrol));
      const filename =
        `Incident - ${patrol} - ${incident.event} - ${incident.date}.${format === "PDF" ? "pdf" : "docx"}`.replace(
          /[<>:"/\\|?*\u0000-\u001f]/g,
          "-",
        );
      const file = new File([blob], filename, {
        type:
          format === "PDF"
            ? "application/pdf"
            : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      const url = URL.createObjectURL(file);
      setReady({ url, file, filename });
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.append(a);
      a.click();
      a.remove();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="report-download">
      <button
        type="button"
        className="secondary"
        disabled={busy}
        onClick={create}
      >
        <Download size={16} />
        {busy ? "Création…" : `Télécharger ${format}`}
      </button>
      {ready && (
        <>
          <a href={ready.url} download={ready.filename}>
            Enregistrer {format}
          </a>
          {navigator.canShare?.({ files: [ready.file] }) && (
            <button
              type="button"
              className="text-btn"
              onClick={async () => {
                try {
                  await navigator.share({ files: [ready.file] });
                } catch (e) {
                  if (e.name !== "AbortError")
                    setError(
                      "Utilise le lien Enregistrer pour conserver le fichier.",
                    );
                }
              }}
            >
              Partager / Enregistrer dans Fichiers
            </button>
          )}
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
