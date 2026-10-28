import React, { useState } from "react";
import { Shield, Mail } from "lucide-react";
export default function AccessGate({ access, patrol, children }) {
  const [email, setEmail] = useState(""),
    [code, setCode] = useState(""),
    [sent, setSent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function run(fn) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (!access.configured)
    return (
      <>
        <div className="access-setup-note">
          <Shield size={20} />
          <p>
            Protection par e-mail en attente de configuration Supabase et des
            adresses de patrouille. Elle n’est pas encore active ; cet espace
            reste local.
          </p>
        </div>
        {children}
      </>
    );
  if (access.loading)
    return (
      <div className="empty">
        <Shield />
        <h3>Vérification de l’accès…</h3>
      </div>
    );
  if (access.authorized)
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
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              if (sent) await access.verify(email, code);
              else {
                await access.sendCode(email);
                setSent(true);
              }
            });
          }}
        >
          <label>
            Adresse e-mail
            <input
              type="email"
              required
              value={email}
              disabled={sent}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          {sent && (
            <label>
              Code reçu par e-mail
              <input
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </label>
          )}
          <button className="primary" disabled={busy}>
            <Mail size={16} />
            {busy
              ? "Veuillez patienter…"
              : sent
                ? "Valider le code"
                : "Recevoir mon code"}
          </button>
          {sent && (
            <button
              type="button"
              className="text-btn"
              onClick={() => {
                setSent(false);
                setCode("");
              }}
            >
              Modifier l’adresse / renvoyer
            </button>
          )}
        </form>
      )}
      {error && <p role="alert">{error}</p>}
      <small>
        Cette connexion protège les données ; elle ne demande aucun accès à
        Google Drive.
      </small>
    </section>
  );
}
