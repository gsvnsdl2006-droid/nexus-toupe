import { useEffect, useRef, useState } from "react";
import { accessClient, privatePayload } from "./access";
export default function usePrivateAccess(patrol, onRemote) {
  const [user, setUser] = useState(null),
    [allowed, setAllowed] = useState([]),
    [loading, setLoading] = useState(Boolean(accessClient)),
    [status, setStatus] = useState("");
  const revisions = useRef(new Map()),
    pending = useRef(new Map()),
    writing = useRef(false),
    handler = useRef(onRemote);
  handler.current = onRemote;
  useEffect(() => {
    if (!accessClient) return;
    accessClient.auth.getSession().then(({ data, error }) => {
      if (error) setStatus(error.message);
      setUser(data.session?.user || null);
      setLoading(false);
    });
    const { data } = accessClient.auth.onAuthStateChange((_event, session) =>
      setUser(session?.user || null),
    );
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    let active = true;
    if (!accessClient || !user) {
      setAllowed([]);
      revisions.current.clear();
      pending.current.clear();
      return;
    }
    setLoading(true);
    (async () => {
      const a = await accessClient.from("patrol_access").select("patrol");
      if (a.error) throw a.error;
      if (!active) return;
      const names = a.data.map((x) => x.patrol);
      setAllowed(names);
      if (patrol && names.includes(patrol)) {
        const r = await accessClient
          .from("patrol_records")
          .select("payload,revision")
          .eq("patrol", patrol)
          .maybeSingle();
        if (r.error) throw r.error;
        if (active) {
          revisions.current.set(patrol, r.data?.revision ?? null);
          if (r.data) await handler.current(r.data.payload);
          setStatus(
            r.data
              ? "Espace privé chargé"
              : "Espace privé prêt · enregistrez pour importer votre copie locale",
          );
        }
      }
    })()
      .catch((e) => {
        if (active) {
          setAllowed([]);
          setStatus(e.message);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user?.id, patrol]);
  async function save(p) {
    if (!accessClient || !allowed.includes(patrol) || loading) return;
    pending.current.set(patrol, privatePayload(p));
    if (writing.current) return;
    writing.current = true;
    setStatus("Enregistrement privé…");
    try {
      while (pending.current.size) {
        const [name, payload] = pending.current.entries().next().value;
        pending.current.delete(name);
        const prior = revisions.current.get(name) ?? null;
        const next = (prior ?? 0) + 1;
        const result =
          prior === null
            ? await accessClient
                .from("patrol_records")
                .insert({ patrol: name, payload, revision: 1 })
                .select("revision")
                .single()
            : await accessClient
                .from("patrol_records")
                .update({ payload, revision: next })
                .eq("patrol", name)
                .eq("revision", prior)
                .select("revision")
                .maybeSingle();
        if (result.error) throw result.error;
        if (!result.data)
          throw Error(
            "Une autre personne a modifié cet espace. Rechargez sa version avant de poursuivre ; votre copie locale est conservée.",
          );
        revisions.current.set(name, result.data.revision);
      }
      setStatus("Enregistré dans l’espace privé");
    } catch (e) {
      pending.current.clear();
      setStatus(`Copie locale conservée · ${e.message}`);
    } finally {
      writing.current = false;
    }
  }
  return {
    configured: Boolean(accessClient),
    user,
    allowed,
    loading,
    status,
    authorized: allowed.includes(patrol),
    save,
    sendCode: async (email) => {
      const { error } = await accessClient.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
      });
      if (error) throw error;
    },
    verify: async (email, token) => {
      const { error } = await accessClient.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: token.trim(),
        type: "email",
      });
      if (error) throw error;
    },
    signOut: () => accessClient.auth.signOut(),
  };
}
