import { createHash } from "node:crypto";
import { validateImage } from "./badge-images.js";
const base = "/.netlify/functions/photographer";
const maxBody = 2600000;
const validId = (value) =>
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
    value || "",
  );
const json = (value, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
function summary(record) {
  return {
    id: record.id,
    patrol: record.patrol,
    title: record.title,
    date: record.date,
    createdAt: record.createdAt,
    photos: record.photos.map((p, i) => ({
      url: `${base}?patrol=${record.patrol}&event=${record.id}&photo=${i}`,
    })),
  };
}
async function readBody(request) {
  if (Number(request.headers.get("content-length")) > maxBody)
    throw Error("size");
  const reader = request.body?.getReader();
  if (!reader) throw Error("invalid");
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maxBody) {
      await reader.cancel();
      throw Error("size");
    }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
export function createPhotographerHandler({
  store,
  authorizeDelete = async () => ({ ok: false, status: 401 }),
  now = () => new Date().toISOString(),
}) {
  return async (request) => {
    const url = new URL(request.url),
      patrol = url.searchParams.get("patrol");
    if (!/^[0-5]$/.test(patrol || ""))
      return json({ error: "Patrouille invalide." }, 400);
    const event = url.searchParams.get("event"),
      key = `events/${patrol}/${event}`;
    try {
      if (request.method === "GET") {
        if (event !== null) {
          if (!validId(event))
            return json({ error: "Événement invalide." }, 400);
          const record = await store().get(key, { type: "json" });
          if (!record || record.deleted)
            return json({ error: "Événement introuvable." }, 404);
          const index = url.searchParams.get("photo");
          if (index === null) return json(summary(record));
          if (!/^[0-3]$/.test(index) || !record.photos[Number(index)])
            return json({ error: "Photo introuvable." }, 404);
          const image = validateImage(record.photos[Number(index)].data);
          return new Response(image.bytes, {
            headers: {
              "Content-Type": image.mime,
              "Cache-Control": "no-store",
              "Content-Disposition": `inline; filename="Orion-${event}-${index}.jpg"`,
              "X-Content-Type-Options": "nosniff",
            },
          });
        }
        const cursor = url.searchParams.get("cursor") || "0";
        if (!/^\d{1,8}$/.test(cursor))
          return json({ error: "Page invalide." }, 400);
        const listing = await store().list({ prefix: `events/${patrol}/` });
        const offset = Number(cursor),
          keys = listing.blobs.sort((a, b) => a.key.localeCompare(b.key));
        const events = (
          await Promise.all(
            keys
              .slice(offset, offset + 20)
              .map(
                async ({ key }) =>
                  (await store().getMetadata(key))?.metadata?.event,
              ),
          )
        ).filter(Boolean);
        return json({
          events,
          cursor: offset + 20 < keys.length ? String(offset + 20) : null,
        });
      }
      if (request.method === "DELETE") {
        if (!validId(event) || url.searchParams.has("photo"))
          return json({ error: "Événement invalide." }, 400);
        const origin = request.headers.get("origin");
        if (origin && origin !== url.origin)
          return json({ error: "Origine invalide." }, 403);
        const permission = await authorizeDelete(request);
        if (!permission.ok)
          return json(
            {
              error:
                permission.status === 503
                  ? "Impossible de vérifier le compte administrateur. Réessaie."
                  : "Seuls les deux administrateurs peuvent supprimer cet événement.",
            },
            permission.status || 403,
          );
        const current = await store().getWithMetadata(key, { type: "json" });
        if (!current || current.data.deleted) return json({ deleted: true });
        // Replace the entire image payload with a tiny tombstone: old anonymous
        // publish retries cannot resurrect a deleted album or its photos.
        if (!current.etag) throw Error("missing_etag");
        const deleted = await store().setJSON(
          key,
          {
            id: event,
            patrol: Number(patrol),
            deleted: true,
            deletedAt: now(),
          },
          { onlyIfMatch: current.etag, metadata: { deleted: true } },
        );
        if (!deleted.modified)
          return json(
            { error: "L’événement a changé. Actualise l’album et réessaie." },
            409,
          );
        return json({ deleted: true });
      }
      if (request.method !== "POST")
        return json({ error: "Méthode non autorisée." }, 405);
      const origin = request.headers.get("origin");
      if (origin && origin !== url.origin)
        return json({ error: "Origine invalide." }, 403);
      if (!request.headers.get("content-type")?.startsWith("application/json"))
        return json({ error: "Format JSON requis." }, 415);
      let input;
      try {
        input = await readBody(request);
      } catch (e) {
        return json(
          {
            error:
              e.message === "size"
                ? "Photos trop volumineuses. Réduis leur taille."
                : "Envoi invalide.",
          },
          e.message === "size" ? 413 : 400,
        );
      }
      if (
        !input ||
        typeof input !== "object" ||
        !validId(input.id) ||
        typeof input.title !== "string" ||
        !input.title.trim() ||
        input.title.trim().length > 120 ||
        !/^\d{4}-\d{2}-\d{2}$/.test(input.date || "") ||
        !Number.isFinite(Date.parse(input.date)) ||
        new Date(input.date).toISOString().slice(0, 10) !== input.date ||
        !Array.isArray(input.photos) ||
        input.photos.length < 1 ||
        input.photos.length > 4
      )
        return json(
          { error: "Indique un titre, une date et de 1 à 4 photos." },
          400,
        );
      let photos;
      try {
        photos = input.photos.map((p) => {
          const checked = validateImage(p.data);
          if (checked.bytes.length > 450 * 1024) throw Error("size");
          return {
            name: typeof p.name === "string" ? p.name.slice(0, 120) : "Photo",
            data: p.data,
          };
        });
      } catch {
        return json(
          { error: "Photos PNG, JPEG ou WebP de 450 Ko maximum requises." },
          400,
        );
      }
      const payload = {
        id: input.id,
        patrol: Number(patrol),
        title: input.title.trim(),
        date: input.date,
        photos,
      };
      const fingerprint = createHash("sha256")
        .update(JSON.stringify(payload))
        .digest("hex");
      const record = { ...payload, fingerprint, createdAt: now() };
      const saved = await store().setJSON(
        `events/${patrol}/${input.id}`,
        record,
        { onlyIfNew: true, metadata: { event: summary(record), fingerprint } },
      );
      if (!saved.modified) {
        const existing = await store().getMetadata(
          `events/${patrol}/${input.id}`,
        );
        if (existing?.metadata.deleted)
          return json(
            {
              error: "Cet événement a été supprimé. Crée un nouvel événement.",
            },
            409,
          );
        if (existing?.metadata.fingerprint !== fingerprint)
          return json(
            {
              error:
                "Cet événement existe déjà. Crée un nouvel événement pour ces photos.",
            },
            409,
          );
        return json(existing.metadata.event);
      }
      return json(summary(record), 201);
    } catch {
      return json(
        {
          error:
            "L’album est temporairement indisponible. Tes photos sélectionnées sont conservées : réessaie.",
        },
        503,
      );
    }
  };
}
