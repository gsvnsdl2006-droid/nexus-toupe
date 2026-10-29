import React, { useEffect, useState } from "react";
import { Download } from "lucide-react";
export default function CaseFileDownload({ file }) {
  const [busy, setBusy] = useState(false),
    [ready, setReady] = useState(null),
    [error, setError] = useState("");
  useEffect(
    () => () => {
      if (ready) URL.revokeObjectURL(ready.url);
    },
    [ready],
  );
  async function download() {
    setBusy(true);
    setError("");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45000);
    try {
      const response = await fetch(file.url, { signal: controller.signal });
      if (
        !response.ok ||
        response.headers.get("content-type")?.includes("text/html")
      )
        throw Error(
          "Le fichier est indisponible. Actualise les études et réessaie.",
        );
      const blob = await response.blob(),
        url = URL.createObjectURL(blob);
      setReady({ url, name: file.name });
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      document.body.append(a);
      a.click();
      a.remove();
    } catch (e) {
      setError(
        e.name === "AbortError"
          ? "Le téléchargement a pris trop de temps. Réessaie."
          : e.message,
      );
    } finally {
      clearTimeout(timer);
      setBusy(false);
    }
  }
  return (
    <div className="report-download">
      <button
        type="button"
        className="secondary"
        disabled={busy}
        onClick={download}
      >
        <Download size={16} />
        {busy ? "Téléchargement…" : "Télécharger le fichier"}
      </button>
      {ready && (
        <a href={ready.url} download={ready.name}>
          Enregistrer le fichier
        </a>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
