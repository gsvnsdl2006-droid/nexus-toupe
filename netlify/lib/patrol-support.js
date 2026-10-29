import { equipmentCatalogue } from "./equipment-catalogue.js";
import { createHash } from "node:crypto";
import { validateImage } from "./badge-images.js";
const endpoint = "/.netlify/functions/patrol-support";
const sections = ["kit", "cases", "equipment"];
const idValid = (id) =>
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
    id || "",
  );
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
const short = (value, max = 120) =>
  typeof value === "string" &&
  value.trim().length > 0 &&
  value.trim().length <= max;
const quantity = (value) =>
  Number.isInteger(value) && value >= 0 && value <= 100000;
const validDate = (value) =>
  value === "" ||
  (typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value);
function fileData(file) {
  const match =
    typeof file?.data === "string" &&
    file.data.match(/^data:([^;,]+);base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match || !short(file.name, 160)) throw Error("invalid");
  const bytes = Buffer.from(match[2], "base64"),
    mime = match[1];
  if (!bytes.length || bytes.length > 3 * 1024 * 1024) throw Error("invalid");
  const signatures = {
    "application/pdf": bytes.subarray(0, 5).toString() === "%PDF-",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      bytes.subarray(0, 4).equals(Buffer.from([80, 75, 3, 4])),
    "application/msword": bytes
      .subarray(0, 8)
      .equals(Buffer.from([208, 207, 17, 224, 161, 177, 26, 225])),
  };
  if (mime.startsWith("image/")) validateImage(file.data);
  else if (!signatures[mime]) throw Error("invalid");
  return { bytes, mime, name: file.name };
}
const nameKey = (name) => String(name).trim().toLowerCase();
const referenceFor = (record) =>
  equipmentCatalogue.find(
    (item) => item.id === record.seedPhotoId || item.id === record.id,
  ) ||
  equipmentCatalogue.find(
    (item) => nameKey(item.name) === nameKey(record.name),
  );
function seededRecord(item, patrol) {
  const record = {
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    patrol: Number(patrol),
    section: "equipment",
    seedPhotoId: item.id,
    updatedAt: "2026-10-30",
  };
  record.version = createHash("sha256")
    .update(JSON.stringify(record))
    .digest("hex");
  return record;
}
function publicRecord(record) {
  const { image, file, ...info } = record;
  const query = `${endpoint}?patrol=${record.patrol}&section=${record.section}&id=${record.id}`;
  if (!image && !info.photo && record.section === "equipment") {
    const reference = referenceFor(record);
    if (reference) {
      info.photo = reference.photo;
      info.photoCrop = reference.photoCrop;
    }
  }
  if (image) info.photo = `${query}&asset=image&version=${record.version}`;
  if (file) info.file = { name: file.name, url: `${query}&asset=file` };
  return info;
}
async function boundedBody(request) {
  const max = 4.3 * 1024 * 1024;
  if (Number(request.headers.get("content-length")) > max) throw Error("size");
  const reader = request.body?.getReader();
  if (!reader) throw Error("invalid");
  let total = 0;
  const chunks = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > max) {
      await reader.cancel();
      throw Error("size");
    }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
export function createPatrolSupportHandler({
  store,
  authorizeAdmin = async () => ({ ok: false, status: 401 }),
  now = () => new Date().toISOString(),
}) {
  return async (request) => {
    const url = new URL(request.url),
      patrol = url.searchParams.get("patrol"),
      section = url.searchParams.get("section"),
      id = url.searchParams.get("id");
    if (!/^[0-5]$/.test(patrol || "") || !sections.includes(section))
      return json({ error: "Espace de patrouille invalide." }, 400);
    const prefix = `${section}/${patrol}/`;
    try {
      if (request.method === "GET") {
        if (id !== null) {
          if (!idValid(id)) return json({ error: "Fiche invalide." }, 400);
          const stored = await store().get(prefix + id, { type: "json" });
          const seed =
            section === "equipment"
              ? equipmentCatalogue.find((item) => item.id === id)
              : null;
          const record = stored || (seed ? seededRecord(seed, patrol) : null);
          if (!record) return json({ error: "Fiche introuvable." }, 404);
          if (url.searchParams.get("asset") === "image" && record.image) {
            if (url.searchParams.get("version") !== record.version)
              return json(
                { error: "Photo remplacée. Actualise la liste." },
                404,
              );
            const image = validateImage(record.image);
            return new Response(image.bytes, {
              headers: {
                "Content-Type": image.mime,
                "Cache-Control": "no-store",
                "X-Content-Type-Options": "nosniff",
              },
            });
          }
          if (url.searchParams.get("asset") === "file" && record.file) {
            const file = fileData(record.file);
            const filename = encodeURIComponent(
              file.name.replace(/[\r\n]/g, ""),
            ).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16)}`);
            return new Response(file.bytes, {
              headers: {
                "Content-Type": file.mime,
                "Content-Disposition": `attachment; filename="Etude-de-cas"; filename*=UTF-8''${filename}`,
                "Cache-Control": "no-store",
                "X-Content-Type-Options": "nosniff",
              },
            });
          }
          return json(publicRecord(record));
        }
        const cursor = url.searchParams.get("cursor") || "0";
        if (!/^\d{1,8}$/.test(cursor))
          return json({ error: "Page invalide." }, 400);
        const listing = await store().list({ prefix });
        const keys = listing.blobs.sort((a, b) => a.key.localeCompare(b.key)),
          start = Number(cursor);
        if (section === "equipment") {
          const saved = (
            await Promise.all(
              keys.map(
                async ({ key }) =>
                  (await store().getMetadata(key))?.metadata?.record,
              ),
            )
          ).filter(Boolean);
          const ids = new Set(saved.map((record) => record.id)),
            names = new Set(saved.map((record) => nameKey(record.name)));
          const records = [
            ...equipmentCatalogue
              .filter(
                (item) => !ids.has(item.id) && !names.has(nameKey(item.name)),
              )
              .map((item) => publicRecord(seededRecord(item, patrol))),
            ...saved.map((record) => publicRecord(record)),
          ].sort((a, b) => a.name.localeCompare(b.name, "fr"));
          return json({
            records: records.slice(start, start + 50),
            cursor: start + 50 < records.length ? String(start + 50) : null,
          });
        }
        const records = (
          await Promise.all(
            keys.slice(start, start + 20).map(async ({ key }) => {
              if (section === "kit") {
                const record = await store().get(key, { type: "json" });
                return record ? publicRecord(record) : null;
              }
              return (await store().getMetadata(key))?.metadata?.record;
            }),
          )
        ).filter(Boolean);
        return json({
          records,
          cursor: start + 20 < keys.length ? String(start + 20) : null,
        });
      }
      if (request.method !== "POST")
        return json({ error: "Méthode non autorisée." }, 405);
      if (
        request.headers.get("origin") &&
        request.headers.get("origin") !== url.origin
      )
        return json({ error: "Origine invalide." }, 403);
      if (section === "equipment") {
        const permission = await authorizeAdmin(request);
        if (!permission.ok)
          return json(
            {
              error:
                permission.status === 503
                  ? "Vérification du compte indisponible. Réessaie."
                  : "Seuls les deux administrateurs peuvent modifier le matériel.",
            },
            permission.status || 403,
          );
      }
      if (!request.headers.get("content-type")?.startsWith("application/json"))
        return json({ error: "Format JSON requis." }, 415);
      let input;
      try {
        input = await boundedBody(request);
      } catch (e) {
        return json(
          {
            error:
              e.message === "size"
                ? "Fichier trop volumineux (3 Mo maximum)."
                : "Envoi invalide.",
          },
          e.message === "size" ? 413 : 400,
        );
      }
      if (!input || !idValid(input.id) || !short(input.name))
        return json({ error: "Un nom et une fiche valides sont requis." }, 400);
      const payload = {
        id: input.id,
        name: input.name.trim(),
        patrol: Number(patrol),
        section,
      };
      if (section === "kit") {
        if (
          !Array.isArray(input.items) ||
          input.items.length < 1 ||
          input.items.length > 50 ||
          input.items.some(
            (item) =>
              !short(item?.name) ||
              !quantity(item.quantity) ||
              !validDate(item.expiry || ""),
          )
        )
          return json(
            {
              error:
                "Ajoute de 1 à 50 articles avec un nom, une quantité entière et une date valide.",
            },
            400,
          );
        payload.items = input.items.map((item) => ({
          name: item.name.trim(),
          quantity: item.quantity,
          expiry: item.expiry || "",
        }));
      }
      if (section === "equipment") {
        if (input.quantity !== null && !quantity(input.quantity))
          return json(
            { error: "La quantité doit être un nombre entier positif ou nul." },
            400,
          );
        payload.quantity = input.quantity;
        if (input.image) {
          try {
            if (validateImage(input.image).bytes.length > 450 * 1024)
              throw Error();
          } catch {
            return json(
              { error: "Photo PNG, JPEG ou WebP de 450 Ko maximum requise." },
              400,
            );
          }
          payload.image = input.image;
        }
      }
      if (section === "cases") {
        try {
          fileData(input.file);
        } catch {
          return json(
            {
              error:
                "Ajoute un PDF, Word ou une image PNG/JPEG/WebP valide, de 3 Mo maximum.",
            },
            400,
          );
        }
        payload.file = { name: input.file.name, data: input.file.data };
      }
      const previous = await store().getWithMetadata(prefix + input.id, {
        type: "json",
      });
      const seed =
        section === "equipment"
          ? equipmentCatalogue.find((item) => item.id === input.id)
          : null;
      const previousData =
        previous?.data || (seed ? seededRecord(seed, patrol) : null);
      if (section === "equipment") {
        const reference = referenceFor(previousData || payload);
        if (reference) payload.seedPhotoId = reference.id;
      }
      const version = createHash("sha256")
        .update(JSON.stringify(payload))
        .digest("hex");
      if (previousData?.version === version)
        return json(publicRecord(previousData));
      if (
        previousData &&
        (section === "cases" || input.expectedVersion !== previousData.version)
      )
        return json(
          {
            error:
              "Cette fiche a été modifiée ailleurs. Actualise la liste avant de la modifier à nouveau.",
          },
          409,
        );
      if (previous && !previous.etag) throw Error("missing_etag");
      const record = { ...payload, version, updatedAt: now() };
      const info = publicRecord(record);
      const metadataRecord =
        section === "kit"
          ? { ...info, items: undefined, itemCount: record.items.length }
          : info;
      const saved = await store().setJSON(prefix + input.id, record, {
        ...(previous ? { onlyIfMatch: previous.etag } : { onlyIfNew: true }),
        metadata: { record: metadataRecord },
      });
      if (!saved.modified)
        return json(
          {
            error:
              "Une autre personne a enregistré cette fiche. Actualise et réessaie.",
          },
          409,
        );
      return json(publicRecord(record), previous ? 200 : 201);
    } catch {
      return json(
        {
          error:
            "L’espace partagé est temporairement indisponible. Ton formulaire est conservé ; réessaie.",
        },
        503,
      );
    }
  };
}
