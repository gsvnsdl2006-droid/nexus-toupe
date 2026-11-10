import { createHash } from "node:crypto";
import { validateImage } from "./badge-images.js";
import { authorizeLeader } from "./leader-auth.js";

const endpoint = "/.netlify/functions/cuisinier";
const uuid = (value) =>
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
    value || "",
  );
const text = (value, max) =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max;
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
async function body(request) {
  const reader = request.body?.getReader();
  if (!reader) throw Error("invalid");
  const chunks = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 700 * 1024) {
      await reader.cancel();
      throw Error("invalid");
    }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
function publicRecord(record) {
  const { image, fingerprint, ...result } = record;
  if (!record.recipe) result.version = fingerprint;
  if (image)
    result.photo = `${endpoint}?patrol=${record.patrol}&recipe=${record.recipe}&experience=${record.id}&asset=photo`;
  return result;
}

// Recipe mutations never modify equipment or other workspace records.
export function createCuisinierHandler({
  store,
  authorize = authorizeLeader,
  now = () => new Date().toISOString(),
}) {
  return async (request) => {
    const url = new URL(request.url),
      patrol = url.searchParams.get("patrol"),
      recipe = url.searchParams.get("recipe");
    if (!/^[0-5]$/.test(patrol || "") || (recipe !== null && !uuid(recipe)))
      return json({ error: "Espace invalide." }, 400);
    const recipeKey = (id) => `recipes/${patrol}/${id}`;
    const prefix = recipe
      ? `experiences/${patrol}/${recipe}/`
      : `recipes/${patrol}/`;
    try {
      if (recipe) {
        const parent = await store().get(recipeKey(recipe), { type: "json" });
        if (!parent || parent.deleted) return json({ error: "Recette introuvable." }, 404);
      }
      if (request.method === "GET") {
        if (url.searchParams.get("asset") === "photo") {
          const id = url.searchParams.get("experience");
          if (!recipe || !uuid(id))
            return json({ error: "Photo invalide." }, 400);
          const record = await store().get(prefix + id, { type: "json" });
          if (!record?.image) return json({ error: "Photo introuvable." }, 404);
          const { bytes, mime } = validateImage(record.image);
          return new Response(bytes, {
            headers: {
              "Content-Type": mime,
              "X-Content-Type-Options": "nosniff",
              "Cache-Control": "public,max-age=3600",
            },
          });
        }
        const cursor = url.searchParams.get("cursor");
        if (cursor !== null && !uuid(cursor))
          return json({ error: "Page invalide." }, 400);
        const { blobs } = await store().list({ prefix });
        const keys = blobs
          .map((item) => item.key)
          .sort()
          .filter((key) => !cursor || key > prefix + cursor);
        const page = keys.slice(0, 20);
        const records = await Promise.all(
          page.map((key) => store().get(key, { type: "json" })),
        );
        return json({
          records: records.filter((record) => record && !record.deleted).map(publicRecord),
          cursor: keys.length > 20 ? page.at(-1).slice(prefix.length) : null,
        });
      }
      const mutation = ["PATCH", "DELETE"].includes(request.method);
      if (request.method !== "POST" && !mutation)
        return json({ error: "Méthode refusée." }, 405);
      if (mutation && recipe) return json({ error: "Méthode refusée." }, 405);
      const origin = request.headers.get("origin");
      if (origin && origin !== url.origin)
        return json({ error: "Origine refusée." }, 403);
      if (!recipe) {
        const auth = await authorize(request);
        if (!auth.ok)
          return json(
            {
              error:
                "Seuls les deux administrateurs peuvent ajouter une recette.",
            },
            auth.status || 403,
          );
      }
      let input;
      try {
        input = await body(request);
      } catch {
        return json({ error: "Envoi invalide ou trop volumineux." }, 400);
      }
      if (!input || !uuid(input.id))
        return json({ error: "Fiche invalide." }, 400);
      if (mutation) {
        const key = recipeKey(input.id);
        const existing = await store().getWithMetadata(key, { type: "json" });
        if (!existing || existing.data.deleted) return json({ error: "Recette introuvable." }, 404);
        if (!input.expectedVersion || input.expectedVersion !== existing.data.fingerprint)
          return json({ error: "Cette recette a changé. Actualise avant de réessayer." }, 409);
        let updated;
        if (request.method === "DELETE") {
          // A tombstone prevents delayed create retries from restoring a deleted recipe.
          // Contributions remain stored but are no longer publicly accessible.
          updated = { id: input.id, patrol: Number(patrol), deleted: true, createdAt: existing.data.createdAt };
        } else {
          if (!text(input.title, 120) || !text(input.ingredients, 10000) || !text(input.instructions, 20000))
            return json({ error: "Complète le titre, les ingrédients et la préparation." }, 400);
          updated = { id: input.id, patrol: Number(patrol), title: input.title.trim(), ingredients: input.ingredients.trim(), instructions: input.instructions.trim(), createdAt: existing.data.createdAt };
        }
        updated.updatedAt = now();
        updated.fingerprint = createHash("sha256").update(JSON.stringify(updated)).digest("hex");
        const saved = await store().setJSON(key, updated, { onlyIfMatch: existing.etag });
        if (!saved.modified) return json({ error: "Cette recette a changé. Actualise avant de réessayer." }, 409);
        return json(publicRecord(updated));
      }
      let record;
      if (!recipe) {
        if (
          !text(input.title, 120) ||
          !text(input.ingredients, 10000) ||
          !text(input.instructions, 20000)
        )
          return json(
            { error: "Complète le titre, les ingrédients et la préparation." },
            400,
          );
        record = {
          id: input.id,
          patrol: Number(patrol),
          title: input.title.trim(),
          ingredients: input.ingredients.trim(),
          instructions: input.instructions.trim(),
        };
      } else {
        if (
          typeof input.experience !== "string" ||
          input.experience.length > 5000 ||
          (!input.experience.trim() && !input.image) ||
          (input.name !== undefined &&
            (typeof input.name !== "string" || input.name.length > 80))
        )
          return json({ error: "Ajoute une expérience ou une photo." }, 400);
        if (input.image) {
          try {
            if (validateImage(input.image).bytes.length > 450 * 1024)
              throw Error("size");
          } catch {
            return json(
              { error: "Photo JPG, PNG ou WebP invalide (450 Kio maximum)." },
              400,
            );
          }
        }
        record = {
          id: input.id,
          patrol: Number(patrol),
          recipe,
          name: input.name?.trim() || "",
          experience: input.experience.trim(),
          image: input.image || "",
        };
      }
      const fingerprint = createHash("sha256")
        .update(JSON.stringify(record))
        .digest("hex");
      const key = prefix + input.id;
      const existing = await store().get(key, { type: "json" });
      if (existing)
        return existing.fingerprint === fingerprint
          ? json(publicRecord(existing))
          : json(
              {
                error: "Cette fiche existe déjà et ne peut pas être remplacée.",
              },
              409,
            );
      record = { ...record, fingerprint, createdAt: now() };
      const saved = await store().setJSON(key, record, { onlyIfNew: true });
      if (!saved.modified) {
        const current = await store().get(key, { type: "json" });
        return current?.fingerprint === fingerprint
          ? json(publicRecord(current))
          : json({ error: "Fiche déjà enregistrée. Actualise la liste." }, 409);
      }
      return json(publicRecord(record), 201);
    } catch {
      return json(
        {
          error:
            "Espace Cuisinier indisponible. Ton formulaire est conservé ; réessaie.",
        },
        503,
      );
    }
  };
}
