export function randomId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = [...bytes].map((n) => n.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export async function fetchWithTimeout(url, options = {}, timeout = 45000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    // Consume inside the timeout as a stalled body must not leave a save hanging.
    const body = await response.text();
    return new Response(body, {
      status: response.status,
      headers: response.headers,
    });
  } finally {
    clearTimeout(timer);
  }
}

export function cloneData(value) {
  if (globalThis.structuredClone) return globalThis.structuredClone(value);
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}
