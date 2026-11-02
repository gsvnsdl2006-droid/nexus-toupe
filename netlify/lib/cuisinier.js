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
  if (image)
    result.photo = `${endpoint}?patrol=${record.patrol}&recipe=${record.recipe}&experience=${record.id}&asset=photo`;
  return result;
}

// Separate, append-only recipe storage: no existing equipment/workspace records are modified.
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
      if (recipe && !(await store().get(recipeKey(recipe), { type: "json" })))
        return json({ error: "Recette introuvable." }, 404);
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
          records: records.filter(Boolean).map(publicRecord),
          cursor: keys.length > 20 ? page.at(-1).slice(prefix.length) : null,
        });
      }
      if (request.method !== "POST")
        return json({ error: "Méthode refusée." }, 405);
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
