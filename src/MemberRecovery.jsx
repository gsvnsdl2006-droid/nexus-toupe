import React, { useEffect, useState } from "react";
import { get } from "idb-keyval";
export default function MemberRecovery({ access, data }) {
  const [rows, setRows] = useState([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState("");
  useEffect(() => {
    let active = true;
    (async () => {
      const result = await Promise.all(
        access.allowed.map(async (name) => {
          const remote = await access.sharedMembers(name);
          const history = (await get(`nexus-private-backup-${name}`)) || [];
          const candidates = new Map();
          const local = [data.patrols[name], ...history.map((b) => b.payload)];
          for (const source of local)
            for (const m of source?.members || []) {
              if (
                !remote.some(
                  (r) =>
                    r.id === m.id ||
                    r.name.trim().toLowerCase() === m.name.trim().toLowerCase(),
                ) &&
                !candidates.has(m.id)
              )
                candidates.set(m.id, m);
            }
          return {
            name,
            remote: remote.length,
            candidates: [...candidates.values()],
            selected: [...candidates.keys()],
          };
        }),
      );
      if (active) setRows(result);
    })()
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  async function publish(row) {
    setBusy(row.name);
    setError("");
    try {
      const members = row.candidates.filter((m) => row.selected.includes(m.id));
      const count = await access.importMembers(row.name, members);
      setRows((old) =>
        old.map((r) =>
          r.name === row.name
            ? {
                ...r,
                remote: count,
                candidates: r.candidates.filter(
                  (m) => !row.selected.includes(m.id),
                ),
                selected: [],
                saved: true,
              }
            : r,
        ),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <h2>Synchroniser les membres de cet appareil</h2>
      <p>
        À ouvrir sur le laptop qui contient les membres. Compare la liste en
        ligne aux données et sauvegardes locales, puis partage les membres
        sélectionnés avec les autres appareils.
      </p>
      <p className="hint">
        Vérifie les noms : les sauvegardes peuvent aussi contenir des membres
        supprimés volontairement. Les membres déjà en ligne restent inchangés.
      </p>
      {loading && <p role="status">Comparaison avec la base partagée…</p>}
      {error && <p role="alert">{error}</p>}
      {rows.map((row) => (
        <section key={row.name} className="card">
          <h3>
            {row.name} · {row.remote} membres en ligne
          </h3>
          {row.saved && (
            <p role="status">Enregistrement confirmé dans la base partagée.</p>
          )}
          {!row.candidates.length ? (
            <p>Aucun membre local supplémentaire.</p>
          ) : (
            <>
              <p>
                {row.candidates.length} membres de cet appareil absents de la
                base partagée.
              </p>
              {row.candidates.map((m) => (
                <label
                  key={m.id}
                  style={{ display: "flex", alignItems: "center", gap: 10 }}
                >
                  <input
                    type="checkbox"
                    checked={row.selected.includes(m.id)}
                    disabled={Boolean(busy)}
                    onChange={(e) =>
                      setRows((old) =>
                        old.map((r) =>
                          r.name === row.name
                            ? {
                                ...r,
                                selected: e.target.checked
                                  ? [...r.selected, m.id]
                                  : r.selected.filter((id) => id !== m.id),
                              }
                            : r,
                        ),
                      )
                    }
                    style={{ width: "auto" }}
                  />
                  {m.photo && (
                    <img
                      src={m.photo}
                      alt=""
                      width="36"
                      height="36"
                      style={{ objectFit: "cover", borderRadius: 8 }}
                    />
                  )}
                  {m.name}
                </label>
              ))}
              <button
                type="button"
                className="primary"
                disabled={Boolean(busy) || !row.selected.length}
                onClick={() => publish(row)}
              >
                {busy === row.name
                  ? "Enregistrement en ligne…"
                  : `Partager ${row.selected.length} membres · ${row.name}`}
              </button>
            </>
          )}
        </section>
      ))}
    </>
  );
}
