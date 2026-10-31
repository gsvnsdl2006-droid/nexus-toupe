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
  localMembers = async () => [],
) {
  const [user, setUser] = useState(null),
    [allowed, setAllowed] = useState([]),
    [verifiedIdentity, setVerifiedIdentity] = useState(null),
    [loading, setLoading] = useState(Boolean(accessClient)),
    [status, setStatus] = useState(""),
    [authError, setAuthError] = useState(loginReturnError),
    [deletionReady, setDeletionReady] = useState(false),
    [campDeletionReady, setCampDeletionReady] = useState(false),
    [syncInfo, setSyncInfo] = useState({ pending: 0, error: false }),
    [loadedPatrols, setLoadedPatrols] = useState([]),
    [accessAttempt, setAccessAttempt] = useState(0);
  const handler = useRef(onRemote),
    currentPatrol = useRef(patrol),
    permissions = useRef([]),
    sync = useRef(null),
    owner = useRef(null),
    unsaved = useRef(new Set());
  const recoverySource = useRef(localMembers);
  recoverySource.current = localMembers;
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
    if (!ready) return;
    const identity = user ? `${user.id}:${user.email}` : null;
    if (owner.current?.identity !== identity) {
      if (owner.current) owner.current.active = false;
      sync.current = null;
      owner.current = null;
      setLoadedPatrols([]);
      setSyncInfo({ pending: 0, error: false });
      unsaved.current.clear();
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
        sync.current = createPrivateSync({
          active: () => sessionOwner.active,
          bootstrap: async (name, record) => {
            const members = await recoverySource.current(name);
            if (!members.length) return null;
            const before = privatePayload(record?.payload || {});
            return { before, after: { ...before, members } };
          },
          loadQueue: (name) =>
            Promise.resolve()
              .then(() => get(key(name)))
              .catch(() => []),
          storeQueue: (name, queue) => set(key(name), queue),
          read: async (name) => {
            if (!permissions.current.includes(name))
              throw Error("Accès refusé à cette patrouille.");
            // Fetch the actual shared payload. Older deployed clients may write
            // a payload without advancing revision, so revision-only caching
            // can leave a device permanently displaying an empty/old roster.
            const response = await timed(
              accessClient
                .from("patrol_records")
                .select("payload,revision")
                .eq("patrol", name)
                .maybeSingle(),
            );
            if (response.error) throw response.error;
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
            return result.data;
          },
          apply: (payload, name) => handler.current(payload, name),
          status: (message, info) => {
            if (!sessionOwner.active) return;
            if (info.pending) unsaved.current.add(info.name);
            else unsaved.current.delete(info.name);
            if (!info.error && !info.pending)
              setLoadedPatrols((old) =>
                old.includes(info.name) ? old : [...old, info.name],
              );
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
          if (e.status === 401 || e.status === 403) {
            permissions.current = [];
            setAllowed([]);
            setVerifiedIdentity(null);
          }
          setStatus(
            `Connexion interrompue · ${e.message}. Nouvelle tentative automatique.`,
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user?.id, user?.email, patrol, ready, accessAttempt]);
  useEffect(() => {
    if (!ready || !user) return;
    const retry = () => {
      if (document.visibilityState !== "hidden") setAccessAttempt((n) => n + 1);
    };
    const timer = setInterval(() => {
      if (!permissions.current.includes(currentPatrol.current)) retry();
    }, 10000);
    window.addEventListener("pageshow", retry);
    window.addEventListener("online", retry);
    window.addEventListener("focus", retry);
    document.addEventListener("visibilitychange", retry);
    return () => {
      clearInterval(timer);
      window.removeEventListener("pageshow", retry);
      window.removeEventListener("online", retry);
      window.removeEventListener("focus", retry);
      document.removeEventListener("visibilitychange", retry);
    };
  }, [ready, user?.id, user?.email]);
  useEffect(() => {
    if (!ready || loading || !user || !allowed.includes(patrol)) return;
    const refresh = () => {
      if (document.visibilityState !== "hidden")
        sync.current?.synchronize(patrol);
    };
    refresh();
    const timer = setInterval(refresh, 10000);
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
  useEffect(() => {
    const warn = (event) => {
      if (!unsaved.current.size) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  return {
    membersReady:
      Boolean(user) &&
      verifiedIdentity === `${user.id}:${user.email}` &&
      allowed.includes(patrol) &&
      loadedPatrols.includes(patrol),
    hasSharedAccess:
      Boolean(user) &&
      verifiedIdentity === `${user.id}:${user.email}` &&
      allowed.length > 0,
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
      if (sync.current && allowed.includes(patrol)) {
        unsaved.current.add(patrol);
        return sync.current.enqueue(patrol, previous, privatePayload(p));
      }
    },
    refresh: () => {
      if (!permissions.current.includes(patrol)) setAccessAttempt((n) => n + 1);
      else return sync.current?.synchronize(patrol);
    },
    sharedMembers: async (name) => {
      if (!permissions.current.includes(name) || !sync.current)
        throw Error("Connecte un compte autorisé pour cette patrouille.");
      const result = await timed(
        accessClient
          .from("patrol_records")
          .select("payload,revision")
          .eq("patrol", name)
          .maybeSingle(),
      );
      if (result.error) throw result.error;
      return result.data?.payload?.members || [];
    },
    importMembers: async (name, members) => {
      if (!permissions.current.includes(name) || !sync.current)
        throw Error("Connecte un compte autorisé pour cette patrouille.");
      const result = await timed(
        accessClient
          .from("patrol_records")
          .select("payload,revision")
          .eq("patrol", name)
          .maybeSingle(),
      );
      if (result.error) throw result.error;
      const before = privatePayload(result.data?.payload || {});
      const after = privatePayload(result.data?.payload || {});
      after.members = [...before.members];
      for (const member of members) {
        if (
          !after.members.some(
            (m) =>
              m.id === member.id ||
              m.name.trim().toLowerCase() === member.name.trim().toLowerCase(),
          )
        )
          after.members.push(member);
      }
      unsaved.current.add(name);
      await sync.current.enqueue(name, before, after);
      if ((await sync.current.pending(name)).length)
        throw Error(
          "Enregistrement encore en attente sur cet appareil. Réessaie avant de quitter.",
        );
      return after.members.length;
    },
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
    signOut: async () => {
      if (unsaved.current.size) {
        setAuthError(
          "Des modifications restent à enregistrer. Attends la confirmation de sauvegarde avant de te déconnecter.",
        );
        setStatus(
          "Modifications en attente · réessaie l’enregistrement avant de te déconnecter.",
        );
        return;
      }
      return accessClient.auth.signOut();
    },
  };
}
