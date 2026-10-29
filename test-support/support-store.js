export function supportStore() {
  const data = new Map();
  let revision = 0;
  return {
    data,
    get: async (key) =>
      data.has(key) ? structuredClone(data.get(key).value) : null,
    getWithMetadata: async (key) =>
      data.has(key)
        ? {
            data: structuredClone(data.get(key).value),
            etag: data.get(key).etag,
          }
        : null,
    getMetadata: async (key) =>
      data.has(key)
        ? { metadata: structuredClone(data.get(key).metadata) }
        : null,
    list: async ({ prefix }) => ({
      blobs: [...data.keys()]
        .filter((key) => key.startsWith(prefix))
        .map((key) => ({ key })),
    }),
    setJSON: async (key, value, options) => {
      if (
        (options.onlyIfNew && data.has(key)) ||
        (options.onlyIfMatch && data.get(key)?.etag !== options.onlyIfMatch)
      )
        return { modified: false };
      data.set(key, {
        value: structuredClone(value),
        metadata: structuredClone(options.metadata),
        etag: String(++revision),
      });
      return { modified: true };
    },
  };
}
