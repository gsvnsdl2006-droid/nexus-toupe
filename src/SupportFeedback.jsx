import React from "react";
export default function SupportFeedback({ state }) {
  return (
    <>
      {state.loading && <p role="status">Chargement de la liste partagée…</p>}
      {state.error && (
        <p className="support-error" role="alert">
          {state.error}
        </p>
      )}
      {state.notice && (
        <p className="support-notice" role="status">
          {state.notice}
        </p>
      )}
      {state.cursor && (
        <button
          type="button"
          className="secondary"
          disabled={state.loading}
          onClick={() => state.load(state.cursor)}
        >
          Voir plus
        </button>
      )}
    </>
  );
}
