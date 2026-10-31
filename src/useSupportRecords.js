import { useEffect, useRef, useState } from "react";
import { fetchWithTimeout } from "./browser-compat";
export async function supportRequest(
  patrol,
  section,
  options = {},
  cursor = null,
) {
  const path = options.method ? "patrol-support-write" : "patrol-support";
  const response = await fetchWithTimeout(
    `/.netlify/functions/${path}?patrol=${patrol}&section=${section}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
    options,
  );
  let data;
  try {
    data = await response.json();
  } catch {
    throw Error(
      response.status === 429
        ? "Trop d’envois. Attends une minute puis réessaie."
        : "Espace indisponible. Réessaie dans un instant.",
    );
  }
  if (!response.ok)
    throw Error(data.error || "Enregistrement impossible. Réessaie.");
  return data;
}
export default function useSupportRecords(patrol, section) {
  const [records, setRecords] = useState([]),
    [cursor, setCursor] = useState(null),
    [loading, setLoading] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const generation = useRef(0);
  async function load(next = null) {
    const id = ++generation.current;
    setLoading(true);
    setError("");
    try {
      const result = await supportRequest(patrol, section, {}, next);
      if (id !== generation.current) return;
      setRecords((old) =>
        next
          ? [
              ...old,
              ...result.records.filter((r) => !old.some((x) => x.id === r.id)),
            ]
          : result.records,
      );
      setCursor(result.cursor);
    } catch (e) {
      if (id === generation.current) setError(e.message);
    } finally {
      if (id === generation.current) setLoading(false);
    }
  }
  useEffect(() => {
    setRecords([]);
    setCursor(null);
    setNotice("");
    load();
    const refresh = () => {
      if (document.visibilityState !== "hidden") load();
    };
    const timer = setInterval(() => {
      if (document.visibilityState !== "hidden") load();
    }, 10000);
    window.addEventListener("pageshow", refresh);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    return () => {
      generation.current++;
      clearInterval(timer);
      window.removeEventListener("pageshow", refresh);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
    };
  }, [patrol, section]);
  async function save(record) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const headers = { "Content-Type": "application/json" };
      const result = await supportRequest(patrol, section, {
        method: "POST",
        headers,
        body: JSON.stringify(record),
      });
      generation.current++;
      setLoading(false);
      setRecords((old) => [result, ...old.filter((r) => r.id !== result.id)]);
      setNotice("Enregistré dans l’espace partagé de la patrouille.");
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setSaving(false);
    }
  }
  return {
    records,
    loading,
    saving,
    error,
    setError,
    notice,
    load,
    save,
    cursor,
  };
}
