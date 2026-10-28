import { createHash } from "node:crypto";
const base = "/.netlify/functions/badge-images";
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
const validId = (id) => /^(?:0|[1-9]\d?)$/.test(id || "") && Number(id) <= 96;
export function validateImage(image) {
  if (typeof image !== "string" || image.length > 4.3 * 1024 * 1024)
    throw Error("invalid_image");
  const m = image.match(
    /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/,
  );
  if (!m) throw Error("invalid_image");
  const bytes = Buffer.from(m[2], "base64");
  if (!bytes.length || bytes.length > 3 * 1024 * 1024)
    throw Error("invalid_image");
  const png = bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255,
    webp =
      bytes.subarray(0, 4).toString() === "RIFF" &&
      bytes.subarray(8, 12).toString() === "WEBP";
  if (!(
    (m[1] === "image/png" && png) ||
    (m[1] === "image/jpeg" && jpeg) ||
    (m[1] === "image/webp" && webp)
  ))
    throw Error("invalid_image");
  return {
    bytes,
    mime: m[1],
    version: createHash("sha256").update(bytes).digest("hex"),
  };
}
const entry = (id, head) => ({
  badge: Number(id),
  version: head.version,
  url: `${base}?badge=${id}&version=${head.version}`,
  updatedAt: head.updatedAt,
});
export function createBadgeHandler({
  store,
  authorize,
  now = () => new Date().toISOString(),
}) {
  return async (request) => {
    const url = new URL(request.url),
      id = url.searchParams.get("badge");
    try {
      if (request.method === "GET") {
        if (id !== null) {
          if (!validId(id)) return json({ error: "Invalid badge." }, 400);
          const version = url.searchParams.get("version");
          if (!/^[a-f0-9]{64}$/.test(version || ""))
            return json({ error: "Invalid image version." }, 400);
          const item = await store().getWithMetadata(
            `images/${id}/${version}`,
            { type: "arrayBuffer" },
          );
          if (!item) return json({ error: "Image not found." }, 404);
          return new Response(item.data, {
            headers: {
              "Content-Type": item.metadata.mime,
              "Cache-Control": "public,max-age=31536000,immutable",
              "X-Content-Type-Options": "nosniff",
            },
          });
        }
        const { blobs } = await store().list({ prefix: "heads/" });
        const items = await Promise.all(
          blobs
            .filter((b) => validId(b.key.slice(6)))
            .map(async (b) => {
              const head = await store().get(b.key, { type: "json" });
              return head ? entry(b.key.slice(6), head) : null;
            }),
        );
        return json({ images: items.filter(Boolean) });
      }
      if (request.method !== "PUT")
        return json({ error: "Method not allowed." }, 405);
      if (!validId(id)) return json({ error: "Invalid badge." }, 400);
      const auth = await authorize(request);
      if (!auth.ok)
        return json(
          {
            error:
              auth.error ||
              "Sign in with an approved troop account to protect this photo.",
          },
          auth.status || 401,
        );
      if (Number(request.headers.get("content-length")) > 4.3 * 1024 * 1024)
        return json({ error: "Image must be 3 MB or smaller." }, 413);
      let body, image;
      try {
        body = await request.json();
        image = validateImage(body.image);
      } catch {
        return json(
          { error: "Choose a PNG, JPEG or WebP image, maximum 3 MB." },
          400,
        );
      }
      const current = await store().getWithMetadata(`heads/${id}`, {
        type: "json",
      });
      if (current?.data.version === image.version)
        return json(entry(id, current.data));
      if ((current?.data.version ?? null) !== (body.expectedVersion ?? null))
        return json(
          {
            error:
              "This badge already has a different saved photo. Your local copy is kept.",
            current: current ? entry(id, current.data) : null,
          },
          409,
        );
      await store().set(`images/${id}/${image.version}`, image.bytes, {
        metadata: { mime: image.mime, createdAt: now() },
      });
      const head = { version: image.version, updatedAt: now() };
      const result = await store().setJSON(
        `heads/${id}`,
        head,
        current ? { onlyIfMatch: current.etag } : { onlyIfNew: true },
      );
      if (!result.modified)
        return json(
          {
            error:
              "Another upload finished first. Your photo is kept locally; retry after checking the current photo.",
          },
          409,
        );
      return json(entry(id, head));
    } catch {
      return json(
        {
          error:
            "Permanent photo storage is temporarily unavailable. Your local photo is kept.",
        },
        503,
      );
    }
  };
}
