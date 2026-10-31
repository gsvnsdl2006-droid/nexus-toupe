import { createHash } from "node:crypto";
import { validateImage } from "./badge-images.js";
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
const object = (x) => x && typeof x === "object" && !Array.isArray(x);
const short = (x, n = 160) => typeof x === "string" && x.length <= n;
const safeKey = (x) =>
  typeof x === "string" &&
  !["__proto__", "constructor", "prototype"].includes(x) &&
  /^[a-zA-Z0-9_-]{1,100}$/.test(x);
const imageUrl = (x) =>
  typeof x === "string" &&
  /^\/\.netlify\/functions\/shared-workspace\?scope=(?:progress-[0-5]|config)&asset=[a-f0-9]{64}$/.test(
    x,
  );
const validDate = (value) =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;
function validPayload(scope, p) {
  if (!object(p)) return false;
  if (scope === "config")
    return (
      Object.keys(p).every((k) => ["badges", "branding"].includes(k)) &&
      Array.isArray(p.badges) &&
      p.badges.length === 93 &&
      p.badges.every((x) => short(x, 120) && x.trim()) &&
      new Set(p.badges).size === 93 &&
      object(p.branding) &&
      Object.entries(p.branding).every(
        ([k, v]) => ["nexus", "orion"].includes(k) && imageUrl(v),
      )
    );
  return (
    Object.keys(p).every((k) => ["progress", "badgeCompletions"].includes(k)) &&
    Array.isArray(p.progress) &&
    p.progress.length <= 10000 &&
    new Set(p.progress.map((e) => e.id)).size === p.progress.length &&
    p.progress.every(
      (e) =>
        object(e) &&
        Object.keys(e).every((key) =>
          ["id", "member", "badge", "date", "text", "photos"].includes(key),
        ) &&
        safeKey(e.id) &&
        safeKey(e.member) &&
        Number.isInteger(e.badge) &&
        e.badge >= 0 &&
        e.badge <= 96 &&
        validDate(e.date) &&
        short(e.text, 12000) &&
        e.text.trim() &&
        Array.isArray(e.photos) &&
        e.photos.length <= 3 &&
        e.photos.every(
          (f) =>
            object(f) &&
            Object.keys(f).every((key) =>
              ["id", "name", "data"].includes(key),
            ) &&
            safeKey(f.id) &&
            short(f.name) &&
            imageUrl(f.data),
        ),
    ) &&
    object(p.badgeCompletions) &&
    Object.entries(p.badgeCompletions).every(
      ([member, badges]) =>
        safeKey(member) &&
        object(badges) &&
        Object.entries(badges).every(
          ([badge, v]) =>
            /^(?:0|[1-9]\d?)$/.test(badge) &&
            +badge <= 96 &&
            object(v) &&
            Object.keys(v).every((key) =>
              ["completed", "date"].includes(key),
            ) &&
            typeof v.completed === "boolean" &&
            validDate(v.date),
        ),
    )
  );
}
async function body(request) {
  const reader = request.body?.getReader();
  if (!reader) throw Error("body");
  const parts = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 4.3 * 1024 * 1024) {
      await reader.cancel();
      throw Error("size");
    }
    parts.push(Buffer.from(value));
  }
  return JSON.parse(Buffer.concat(parts).toString());
}
export function createSharedWorkspaceHandler({ store, authorizeAdmin }) {
  return async (request) => {
    try {
      const url = new URL(request.url),
        scope = url.searchParams.get("scope"),
        asset = url.searchParams.get("asset");
      if (!/^(progress-[0-5]|config)$/.test(scope || ""))
        return json({ error: "Espace invalide." }, 400);
      const db = store();
      if (request.method === "GET") {
        if (asset) {
          if (!/^[a-f0-9]{64}$/.test(asset))
            return json({ error: "Photo invalide." }, 400);
          const photo = await db.get(`assets/${scope}/${asset}`, {
            type: "json",
          });
          if (!photo) return json({ error: "Photo introuvable." }, 404);
          const parsed = validateImage(photo.data);
          return new Response(parsed.bytes, {
            headers: {
              "Content-Type": parsed.mime,
              "Cache-Control": "public,max-age=31536000,immutable",
              "X-Content-Type-Options": "nosniff",
            },
          });
        }
        return json(await db.get(`documents/${scope}`, { type: "json" }));
      }
      if (request.method !== "POST")
        return json({ error: "Méthode invalide." }, 405);
      if (
        request.headers.get("origin") &&
        request.headers.get("origin") !== url.origin
      )
        return json({ error: "Origine refusée." }, 403);
      if (scope === "config") {
        const grant = await authorizeAdmin?.(request);
        if (!grant?.ok)
          return json(
            {
              error:
                "Connecte un des deux administrateurs pour modifier le catalogue ou les logos.",
            },
            grant?.status || 403,
          );
      }
      const input = await body(request);
      if (asset === "upload") {
        const image = validateImage(input.image),
          hash = createHash("sha256").update(image.bytes).digest("hex");
        await db.setJSON(
          `assets/${scope}/${hash}`,
          { data: input.image },
          { onlyIfNew: true },
        );
        return json({
          url: `/.netlify/functions/shared-workspace?scope=${scope}&asset=${hash}`,
        });
      }
      if (
        !validPayload(scope, input.payload) ||
        !(
          input.expectedRevision === null ||
          (Number.isSafeInteger(input.expectedRevision) &&
            input.expectedRevision > 0)
        )
      )
        return json({ error: "Données invalides." }, 400);
      const previous = await db.getWithMetadata(`documents/${scope}`, {
        type: "json",
      });
      if ((previous?.data.revision ?? null) !== input.expectedRevision)
        return json(
          { error: "Version modifiée. Nouvelle tentative automatique." },
          409,
        );
      const record = {
        revision: (previous?.data.revision || 0) + 1,
        payload: input.payload,
      };
      const archive = createHash("sha256")
        .update(JSON.stringify(record))
        .digest("hex");
      await db.setJSON(`history/${scope}/${archive}`, record, {
        onlyIfNew: true,
      });
      const result = await db.setJSON(
        `documents/${scope}`,
        record,
        previous ? { onlyIfMatch: previous.etag } : { onlyIfNew: true },
      );
      return result.modified
        ? json(record)
        : json({ error: "Version modifiée." }, 409);
    } catch (e) {
      return json(
        {
          error:
            e.message === "size"
              ? "Envoi trop volumineux."
              : "Enregistrement impossible. Réessaie ; ton brouillon reste conservé.",
        },
        e.message === "size" ? 413 : 400,
      );
    }
  };
}
