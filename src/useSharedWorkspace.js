import { useEffect, useRef, useState } from "react";
import { get, set } from "idb-keyval";
import { createPrivateSync } from "./private-sync";
import { mergeWorkspace } from "./shared-merge";
import { cloneData, fetchWithTimeout } from "./browser-compat";
import { patrols } from "./model";
import { badges as officialBadges } from "./badges";
import { accessClient } from "./access";
import { isLeader } from "./leader-policy";
export const progressPayload = (p) => ({
  progress: p?.progress || [],
  badgeCompletions: p?.badgeCompletions || {},
});
export const configPayload = (data) => ({
  badges: data.badges,
  branding: data.branding || {},
});
const empty = (scope) =>
  scope === "config"
    ? { badges: [...officialBadges], branding: {} }
    : { progress: [], badgeCompletions: {} };
export default function useSharedWorkspace({ ready, data, user, onRemote }) {
  const assets = useRef(new Map());
  const engine = useRef(null),
    source = useRef(data),
    apply = useRef(onRemote),
    session = useRef(user),
    initial = useRef(new Map()),
    pendingScopes = useRef(new Set());
  const [states, setStates] = useState({});
  source.current = data;
  apply.current = onRemote;
  session.current = user;
  async function request(scope, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (options.method && scope === "config") {
      if (!isLeader(session.current))
        throw Error(
          "Connecte un administrateur pour partager le catalogue et les logos.",
        );
      const auth = await accessClient.auth.getSession();
      if (!auth.data.session?.access_token)
        throw Error("Session expirée. Reconnecte-toi.");
      headers.Authorization = `Bearer ${auth.data.session.access_token}`;
    }
    const response = await fetchWithTimeout(
      `/.netlify/functions/${options.method ? "shared-workspace-write" : "shared-workspace"}?scope=${scope}${options.asset ? "&asset=upload" : ""}`,
      { ...options, headers, cache: "no-store" },
    );
    if (response.status === 409) return { collision: true };
    let result;
    try {
      result = await response.json();
    } catch {
      throw Error(
        "Connexion au stockage partagé indisponible. Brouillon conservé sur cet appareil.",
      );
    }
    if (!response.ok) throw Error(result.error || "Enregistrement impossible.");
    return result;
  }
  async function normalize(scope, payload) {
    const next = cloneData(payload);
    const image = async (value) => {
      if (!value?.startsWith("data:image/")) return value;
      const cacheKey = `${scope}:${value}`;
      if (assets.current.has(cacheKey)) return assets.current.get(cacheKey);
      const result = await request(scope, {
        method: "POST",
        asset: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: value }),
      });
      assets.current.set(cacheKey, result.url);
      return result.url;
    };
    if (scope === "config") {
      for (const key of Object.keys(next.branding))
        next.branding[key] = await image(next.branding[key]);
    } else
      for (const entry of next.progress)
        for (const photo of entry.photos || [])
          photo.data = await image(photo.data);
    return next;
  }
  useEffect(() => {
    if (!ready || engine.current) return;
    const scopes = patrols.map((_, i) => `progress-${i}`).concat("config");
    for (const scope of scopes)
      initial.current.set(
        scope,
        cloneData(
          scope === "config"
            ? configPayload(source.current)
            : progressPayload(source.current.patrols[patrols[+scope.slice(9)]]),
        ),
      );
    engine.current = createPrivateSync({
      merge: mergeWorkspace,
      loadQueue: async (scope) => {
        const key = `nexus-shared-pending:${scope}`;
        const saved = (await get(key).catch(() => [])) || [];
        const legacy =
          (await get(`nexus-shared-legacy:${scope}`).catch(() => null)) ||
          initial.current.get(scope);
        const exists =
          scope === "config"
            ? JSON.stringify(legacy) !== JSON.stringify(empty(scope))
            : legacy.progress.length ||
              Object.keys(legacy.badgeCompletions).length;
        if (
          exists &&
          !(await get(`nexus-shared-migrated:${scope}`).catch(() => false))
        ) {
          // Journal old device-only work before any remote snapshot replaces it.
          await set(`nexus-shared-legacy:${scope}`, legacy).catch(() => {});
          saved.push({ before: empty(scope), after: legacy });
          try {
            await set(key, saved);
            await set(`nexus-shared-migrated:${scope}`, true);
          } catch {}
        }
        return saved;
      },
      storeQueue: (scope, q) => set(`nexus-shared-pending:${scope}`, q),
      read: (scope) => request(scope),
      prepare: async (operation, scope) => ({
        ...operation,
        before: await normalize(scope, operation.before),
        after: await normalize(scope, operation.after),
      }),
      write: async (scope, payload, revision) => {
        const result = await request(scope, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload, expectedRevision: revision }),
        });
        return result?.collision ? null : result;
      },
      apply: (payload, scope) => apply.current(scope, payload),
      status: (message, info) => {
        if (info.pending) pendingScopes.current.add(info.name);
        else pendingScopes.current.delete(info.name);
        setStates((old) => ({
          ...old,
          [info.name]: {
            ...info,
            message: info.error
              ? message
              : info.pending
                ? "Enregistrement en ligne…"
                : "Enregistré en ligne · partagé sur tous les appareils",
          },
        }));
      },
    });
    const refresh = () => {
      if (document.visibilityState === "hidden") return;
      for (const scope of scopes)
        engine.current.synchronize(scope).catch(() => {});
    };
    refresh();
    const interval = setInterval(refresh, 10000);
    window.addEventListener("online", refresh);
    window.addEventListener("pageshow", refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    const warn = (e) => {
      if (pendingScopes.current.size) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      clearInterval(interval);
      window.removeEventListener("online", refresh);
      window.removeEventListener("pageshow", refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("beforeunload", warn);
    };
  }, [ready]);
  useEffect(() => {
    if (user) engine.current?.synchronize("config").catch(() => {});
  }, [user?.id]);
  async function save(scope, before, after) {
    if (!engine.current) return false;
    pendingScopes.current.add(scope);
    return engine.current.enqueue(scope, before, after);
  }
  return {
    states,
    savePatrol: (name, before, after) =>
      save(
        `progress-${patrols.indexOf(name)}`,
        progressPayload(before),
        progressPayload(after),
      ),
    saveConfig: (before, after) =>
      save("config", configPayload(before), configPayload(after)),
    entrySaved: async (name, id) => {
      const scope = `progress-${patrols.indexOf(name)}`;
      await engine.current?.synchronize(scope);
      return !((await engine.current?.pending(scope)) || []).some(
        (op) =>
          JSON.stringify(
            op.before?.progress?.find((entry) => entry.id === id),
          ) !==
          JSON.stringify(op.after?.progress?.find((entry) => entry.id === id)),
      );
    },
    pending: (name) =>
      engine.current?.pending(`progress-${patrols.indexOf(name)}`),
    refresh: () => {
      for (const scope of initial.current.keys())
        engine.current?.synchronize(scope).catch(() => {});
    },
  };
}
