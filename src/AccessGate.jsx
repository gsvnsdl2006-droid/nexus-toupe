import React, { useState } from "react";
import { Shield } from "lucide-react";
export default function AccessGate({ access, patrol, children }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function signIn() {
    setBusy(true);
    setError("");
    try {
      await access.signInGoogle();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }
  if (access.canView)
    return (
      <>
        <div className="access-session" role="status">
          <Shield size={16} />
          <span>Espace partagé public · {access.status || "Chargement des données partagées…"}</span>
        </div>
        {children}
      </>
    );
  if (!access.configured)
    return (
      <>
        <div className="access-setup-note">
          <Shield size={20} />
          <p>
            Protection en attente de configuration Supabase. Elle n’est pas
            encore active ; cet espace reste local.
          </p>
        </div>
        {children}
      </>
    );
  if (access.loading && !access.authorized)
    return (
      <div className="empty">
        <Shield />
        <h3>Chargement…</h3>
      </div>
    );
  if (access.user && access.authorized)
    return (
      <>
        <div className="access-session">
          <Shield size={16} />
          <span>
            {access.user.email} · {access.status}
          </span>
          <button className="text-btn" onClick={access.signOut}>
            Déconnexion
          </button>
        </div>
        {children}
      </>
    );
  return (
    <section className="access-gate">
      <Shield size={36} />
      <h2>Accès réservé · {patrol}</h2>
      <p>
        La trésorerie et le secrétariat sont réservés aux deux maîtrises et à
        l’adresse de cette patrouille.
      </p>
      {access.user ? (
        <>
          <p>
            Cette adresse n’a pas accès à cette patrouille : {access.user.email}
            .
          </p>
          <button className="secondary" onClick={access.signOut}>
            Changer de compte
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            className="primary google-signin"
            disabled={busy}
            onClick={signIn}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M21.6 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.8 3-4.3 3-7.4Z"
              />
              <path
                fill="#34A853"
                d="M12 22c2.7 0 5-.9 6.6-2.4L15.4 17c-.9.6-2 1-3.4 1-2.6 0-4.8-1.7-5.6-4H3.1v2.6A10 10 0 0 0 12 22Z"
              />
              <path
                fill="#FBBC05"
                d="M6.4 14a6 6 0 0 1 0-4V7.4H3.1a10 10 0 0 0 0 9.2L6.4 14Z"
              />
              <path
                fill="#EA4335"
                d="M12 6c1.5 0 2.8.5 3.8 1.5l2.8-2.8A9.5 9.5 0 0 0 12 2a10 10 0 0 0-8.9 5.4L6.4 10c.8-2.3 3-4 5.6-4Z"
              />
            </svg>
            {busy ? "Opening Google…" : "Continue with Google"}
          </button>
          <p className="hint">
            Session mémorisée sur cet appareil. Aucun code e-mail à recevoir.
          </p>
        </>
      )}
      {(error || access.authError) && (
        <p role="alert">{error || access.authError}</p>
      )}
      <small>
        Cette connexion vérifie uniquement votre identité. Elle ne demande aucun
        accès à Google Drive.
      </small>
    </section>
  );
}
