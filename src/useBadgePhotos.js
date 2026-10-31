import { useState, useEffect, useRef } from "react";
import { accessClient } from "./access";
import {
  vaultEntries,
  saveBadgeLocally,
  markBadgeUploaded,
} from "./photo-vault";
const endpoint = "/.netlify/functions/badge-images";
export default function useBadgePhotos({ ready, user, onPhotos }) {
  const [status, setStatus] = useState("Photos conservées sur cet appareil"),
    [tick, setTick] = useState(0),
    [pending, setPending] = useState(0),
    [conflicts, setConflicts] = useState([]);
  const heads = useRef({}),
    callback = useRef(onPhotos),
    running = useRef(false),
    wake = useRef(false),
    retry = useRef(0),
    timer = useRef(null),
    mounted = useRef(true),
    userId = useRef(user?.id);
  callback.current = onPhotos;
  userId.current = user?.id;
  useEffect(
    () => () => {
      mounted.current = false;
      clearTimeout(timer.current);
    },
    [],
  );
  async function refresh() {
    try {
      const r = await fetch(endpoint, { cache: "no-store" });
      if (!r.ok) throw Error();
      const d = await r.json();
      if (!Array.isArray(d.images)) throw Error();
      const vault = await vaultEntries(),
        local = new Map(vault.map((x) => [x.badge, x])),
        photos = {};
      for (const item of d.images) {
        if (
          !Number.isInteger(item.badge) ||
          item.badge < 0 ||
          item.badge > 96 ||
          !/^\/.netlify\/functions\/badge-images\?badge=\d{1,2}&version=[a-f0-9]{64}$/.test(
            item.url,
          )
        )
          continue;
        heads.current[item.badge] = item;
        const own = local.get(item.badge);
        if (!own?.pending)
          photos[item.badge] =
            own?.uploadedVersion === item.version ? own.image : item.url;
      }
      if (mounted.current) {
        callback.current(photos);
        if (vault.every((x) => !x.pending))
          setStatus("Photos récupérables après redéploiement");
      }
    } catch {
      if (mounted.current)
        setStatus("Copie locale conservée · sauvegarde distante indisponible");
    }
  }
  useEffect(() => {
    if (ready) refresh();
  }, [ready]);
  useEffect(() => {
    const resume = () => {
      retry.current = 0;
      clearTimeout(timer.current);
      refresh();
      setTick((n) => n + 1);
    };
    const interval = setInterval(() => {
      if (ready && document.visibilityState !== "hidden") refresh();
    }, 15000);
    window.addEventListener("pageshow", resume);
    window.addEventListener("online", resume);
    window.addEventListener("focus", resume);
    return () => {
      clearInterval(interval);
      window.removeEventListener("pageshow", resume);
      window.removeEventListener("online", resume);
      window.removeEventListener("focus", resume);
    };
  }, [ready]);
  useEffect(() => {
    if (!ready) return;
    async function upload() {
      if (running.current) {
        wake.current = true;
        return;
      }
      running.current = true;
      try {
        const blocked = new Set();
        let remaining = (await vaultEntries()).filter((x) => x.pending);
        if (mounted.current) setPending(remaining.length);
        if (!remaining.length || !navigator.onLine) return;
        if (mounted.current) setStatus("Sauvegarde permanente des photos…");
        const uploader = user?.id;
        while (remaining.length && userId.current === uploader) {
          const auth = await accessClient?.auth.getSession();
          const token = auth?.data.session?.access_token;
          for (const item of remaining) {
            if (userId.current !== uploader) break;
            const r = await fetch(`${endpoint}?badge=${item.badge}`, {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
              body: JSON.stringify({
                image: item.image,
                expectedVersion: item.expectedVersion,
              }),
            });
            let result;
            try {
              result = await r.json();
            } catch {
              throw Error(
                "Sauvegarde distante indisponible. Copie locale conservée.",
              );
            }
            if (!r.ok) {
              if (result.current) heads.current[item.badge] = result.current;
              if (r.status === 409) {
                blocked.add(item.badge);
                if (mounted.current) setConflicts([...blocked]);
                continue;
              }

              const e = Error(
                result.error ||
                  "Sauvegarde indisponible. Copie locale conservée.",
              );
              e.conflict = r.status === 409 || r.status === 403;
              throw e;
            }
            heads.current[item.badge] = result;
            await markBadgeUploaded(
              item.badge,
              item.generation,
              result.version,
            );
          }
          const waiting = (await vaultEntries()).filter((x) => x.pending);
          remaining = waiting.filter((x) => !blocked.has(x.badge));
          if (mounted.current) setPending(waiting.length);
        }
        retry.current = 0;
        if (mounted.current && blocked.size)
          setStatus(
            `${blocked.size} photo(s) différentes existent déjà sur le serveur. Les deux versions sont conservées ; choisissez celle à partager.`,
          );
        else if (mounted.current && !remaining.length)
          setStatus("Photos sauvegardées durablement");
      } catch (e) {
        if (mounted.current) setStatus(e.message);
        if (!e.conflict && retry.current < 3 && mounted.current) {
          retry.current++;
          timer.current = setTimeout(
            () => setTick((n) => n + 1),
            Math.min(30000, 5000 * 2 ** retry.current),
          );
        }
      } finally {
        running.current = false;
        if (wake.current && mounted.current) {
          wake.current = false;
          setTick((n) => n + 1);
        }
      }
    }
    upload();
  }, [ready, user?.id, tick]);
  return {
    status,
    pending,
    conflicts,
    resolveConflict: async (badge) => {
      await refresh();
      const item = (await vaultEntries()).find((x) => x.badge === badge);
      if (!item) return;
      await saveBadgeLocally(
        badge,
        item.image,
        heads.current[badge]?.version ?? null,
      );
      setConflicts((ids) => ids.filter((id) => id !== badge));
      setTick((n) => n + 1);
    },
    refresh: () => {
      retry.current = 0;
      clearTimeout(timer.current);
      refresh();
      setTick((n) => n + 1);
    },
    save: async (badge, image) => {
      await saveBadgeLocally(
        badge,
        image,
        heads.current[badge]?.version ?? null,
      );
      callback.current({ [badge]: image });
      setConflicts((ids) => ids.filter((id) => id !== badge));
      setStatus("Photo conservée localement · sauvegarde partagée en attente");
      setTick((n) => n + 1);
      if (navigator.storage?.persist)
        navigator.storage.persist().catch(() => {});
    },
  };
}
