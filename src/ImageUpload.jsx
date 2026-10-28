import React, { useState } from "react";
import { Upload } from "lucide-react";
export default function ImageUpload({ label, value, onChange }) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="image-upload">
      {value && <img className="uploaded-image" src={value} alt={label} />}
      <label className="secondary file-button">
        <Upload size={15} />
        {value ? "Changer la photo" : "Ajouter une photo"}
        <input
          aria-label={label}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (
              !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
              file.size > 3 * 1024 * 1024
            ) {
              setError("Image PNG, JPEG ou WebP de moins de 3 Mo requise.");
              return;
            }
            setBusy(true);
            setError("");
            try {
              const data = await new Promise((resolve, reject) => {
                const r = new FileReader();
                r.onload = () => resolve(r.result);
                r.onerror = reject;
                r.readAsDataURL(file);
              });
              await onChange(data);
            } catch {
              setError("La photo n’a pas pu être enregistrée.");
            } finally {
              setBusy(false);
              e.target.value = "";
            }
          }}
        />
      </label>
      {busy && <small>Enregistrement…</small>}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
