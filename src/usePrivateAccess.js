import { isLeader } from "./leader-policy.js";
import { returnContextKey, loginReturnError } from "./auth-context.js";
import { useEffect, useRef, useState } from "react";
import { get, set } from "idb-keyval";
import { accessClient, privatePayload } from "./access";
import { createPrivateSync } from "./private-sync";
async function timed(query) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    return await query.abortSignal(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}
export default function usePrivateAccess(
  patrol,
  onRemote,
  section,
  ready = true,
) {
  const [user, setUser] = useState(null),
    [allowed, setAllowed] = useState([]),
    [verifiedIdentity, setVerifiedIdentity] = useState(null),
    [loading, setLoading] = useState(Boolean(accessClient)),
    [status, setStatus] = useState(""),
    [authError, setAuthError] = useState(loginReturnError),
    [deletionReady, setDeletionReady] = useState(false),
    [campDeletionReady, setCampDeletionReady] = useState(false),
    [syncInfo, setSyncInfo] = useState({ pending: 0, error: false });
  const handler = useRef(onRemote),
    currentPatrol = useRef(patrol),
    permissions = useRef([]),
    sync = useRef(null),
    owner = useRef(null);
  handler.current = onRemote;
  currentPatrol.current = patrol;
  useEffect(() => {
    if (!accessClient) return;
    let active = true;
    accessClient.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setAuthError(error.message);
        setUser(data.session?.user || null);
      })
      .catch((e) => {
        if (active) setAuthError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    const { data } = accessClient.auth.onAuthStateChange((_event, session) =>
      setUser(session?.user || null),
    );
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    let active = true;
    setDeletionReady(false);
    setCampDeletionReady(false);
    setSyncInfo({ pending: 0, error: false });
    if (!ready) return;
    const identity = user ? `${user.id}:${user.email}` : null;
    if (owner.current?.identity !== identity) {
      if (owner.current) owner.current.active = false;
      sync.current = null;
      owner.current = null;
    }
    if (!accessClient || !user) {
      permissions.current = [];
      setAllowed([]);
      setVerifiedIdentity(null);
      return;
    }
    setLoading(true);
    (async () => {
      const a = await timed(
        accessClient.from("patrol_access").select("patrol"),
      );
      if (a.error) throw a.error;
      if (!active) return;
      const names = a.data.map((x) => x.patrol);
      permissions.current = names;
      setAllowed(names);
      setVerifiedIdentity(identity);
      if (!sync.current) {
        const sessionOwner = { identity, active: true };
        owner.current = sessionOwner;
        const key = (name) => `nexus-private-pending:${identity}:${name}`;
        const records = new Map();
        sync.current = createPrivateSync({
          active: () => sessionOwner.active,
          loadQueue: (name) =>
            Promise.resolve()
              .then(() => get(key(name)))
              .catch(() => []),
          storeQueue: (name, queue) => set(key(name), queue),
          read: async (name) => {
            if (!permissions.current.includes(name))
              throw Error("Accès refusé à cette patrouille.");
            // Poll only the small revision value; fetch member photos and the
            // full payload only when another account has actually changed it.
            const revision = await timed(
              accessClient
                .from("patrol_records")
                .select("revision")
                .eq("patrol", name)
                .maybeSingle(),
            );
            if (revision.error) throw revision.error;
            if (!revision.data) {
              records.delete(name);
              return null;
            }
            if (records.get(name)?.revision === revision.data.revision)
              return records.get(name);
            const response = await timed(
              accessClient
                .from("patrol_records")
                .select("payload,revision")
                .eq("patrol", name)
                .maybeSingle(),
            );
            if (response.error) throw response.error;
            if (response.data) records.set(name, response.data);
            return response.data;
          },
          write: async (name, payload, prior) => {
            if (!sessionOwner.active || !permissions.current.includes(name))
              throw Error(
                "Session interrompue. Reconnecte-toi pour réessayer.",
              );
            const result =
              prior === null
                ? await timed(
                    accessClient
                      .from("patrol_records")
                      .insert({ patrol: name, payload, revision: 1 })
                      .select("revision")
                      .single(),
                  )
                : await timed(
                    accessClient
                      .from("patrol_records")
                      .update({ payload, revision: prior + 1 })
                      .eq("patrol", name)
                      .eq("revision", prior)
                      .select("revision")
                      .maybeSingle(),
                  );
            if (result.error?.code === "23505") return null;
            if (result.error) throw result.error;
            if (result.data)
              records.set(name, { payload, revision: result.data.revision });
            return result.data;
          },
          apply: (payload, name) => handler.current(payload, name),
          status: (message, info) => {
            if (sessionOwner.active && currentPatrol.current === info.name) {
              setStatus(message);
              setSyncInfo(info);
            }
          },
        });
      }
      const refresh =
        patrol && names.includes(patrol)
          ? sync.current.synchronize(patrol)
          : Promise.resolve();
      if (isLeader(user)) {
        const [check, campCheck] = await Promise.all([
          timed(accessClient.rpc("leader_deletion_enabled")),
          timed(accessClient.rpc("camp_deletion_enabled")),
        ]);
        if (active) {
          setDeletionReady(!check.error && check.data === true);
          setCampDeletionReady(!campCheck.error && campCheck.data === true);
        }
      }
      await refresh;
    })()
      .catch((e) => {
        if (active) {
          permissions.current = [];
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
  }, [user?.id, user?.email, patrol, ready]);
  useEffect(() => {
    if (!ready || loading || !user || !allowed.includes(patrol)) return;
    const refresh = () => {
      if (document.visibilityState !== "hidden")
        sync.current?.synchronize(patrol);
    };
    refresh();
    const timer = setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [patrol, section, user?.id, ready, loading, allowed]);
  useEffect(
    () => () => {
      if (owner.current) owner.current.active = false;
    },
    [],
  );
  return {
    configured: Boolean(accessClient),
    user,
    allowed,
    loading,
    status,
    authError,
    syncInfo,
    authorized:
      Boolean(user) &&
      verifiedIdentity === `${user.id}:${user.email}` &&
      allowed.includes(patrol),
    save: (p, previous) => {
      if (sync.current && allowed.includes(patrol))
        return sync.current.enqueue(patrol, previous, privatePayload(p));
    },
    refresh: () => sync.current?.synchronize(patrol),
    pending: () => sync.current?.pending(patrol),
    discardPending: () => sync.current?.discard(patrol),
    isLeader: isLeader(user),
    canDelete:
      isLeader(user) && allowed.includes(patrol) && deletionReady && !loading,
    deletionReady,
    campDeletionReady,
    canDeleteCamps:
      isLeader(user) &&
      allowed.includes(patrol) &&
      campDeletionReady &&
      !loading,
    saving: syncInfo.pending > 0 && !syncInfo.error,
    signInGoogle: async () => {
      setAuthError("");
      sessionStorage.setItem(
        returnContextKey,
        JSON.stringify({ patrol, section }),
      );
      const { error } = await accessClient.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin + "/",
          queryParams: { prompt: "select_account" },
        },
      });
      if (error) {
        sessionStorage.removeItem(returnContextKey);
        throw error;
      }
    },
    signOut: () => accessClient.auth.signOut(),
  };
}
