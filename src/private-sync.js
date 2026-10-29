import { cloneData } from "./browser-compat.js";
const equal = (a, b) => {
  if (a === b) return true;
  if (
    a === null ||
    b === null ||
    typeof a !== "object" ||
    typeof b !== "object"
  )
    return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(b, key) && equal(a[key], b[key]),
    )
  );
};
const object = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
const identified = (x) =>
  Array.isArray(x) &&
  x.every((item) => object(item) && typeof item.id === "string") &&
  new Set(x.map((item) => item.id)).size === x.length;
export class SyncConflict extends Error {
  constructor(path) {
    super(
      "Une autre personne a modifié la même information. Ta modification est conservée en attente ; compare les versions avant de réessayer.",
    );
    this.path = path;
  }
}
export function mergePrivate(base, local, remote, path = "") {
  if (equal(local, base)) return cloneData(remote);
  if (equal(remote, base) || equal(local, remote)) return cloneData(local);
  if (
    identified(local) &&
    identified(remote) &&
    (base === undefined || identified(base))
  ) {
    const previous = new Map((base || []).map((x) => [x.id, x]));
    const mine = new Map(local.map((x) => [x.id, x])),
      theirs = new Map(remote.map((x) => [x.id, x]));
    return [
      ...new Set([...theirs.keys(), ...mine.keys(), ...previous.keys()]),
    ].flatMap((id) => {
      const merged = mergePrivate(
        previous.get(id),
        mine.get(id),
        theirs.get(id),
        `${path}/${id}`,
      );
      return merged === undefined ? [] : [merged];
    });
  }
  if (object(local) && object(remote) && (base === undefined || object(base))) {
    const merged = {};
    for (const key of new Set([
      ...Object.keys(base || {}),
      ...Object.keys(remote),
      ...Object.keys(local),
    ])) {
      const value = mergePrivate(
        base?.[key],
        local[key],
        remote[key],
        `${path}/${key}`,
      );
      if (value !== undefined) merged[key] = value;
    }
    return merged;
  }
  throw new SyncConflict(path);
}
export function createPrivateSync({
  read,
  write,
  loadQueue,
  storeQueue,
  apply,
  status,
  active = () => true,
}) {
  const queues = new Map(),
    jobs = new Map(),
    persistence = new Map();
  async function queue(name) {
    if (!queues.has(name))
      queues.set(
        name,
        Promise.resolve(loadQueue(name)).then((q) =>
          Array.isArray(q) ? q : [],
        ),
      );
    return queues.get(name);
  }
  function persist(name, operations) {
    const snapshot = cloneData(operations);
    const next = (persistence.get(name) || Promise.resolve())
      .catch(() => {})
      .then(() => storeQueue(name, snapshot));
    persistence.set(name, next);
    return next;
  }
  async function synchronize(name) {
    if (jobs.has(name)) return jobs.get(name);
    const task = (async () => {
      const operations = await queue(name);
      if (!active()) return;
      try {
        let record = await read(name);
        if (!active()) return;
        while (operations.length && active()) {
          const operation = operations[0];
          let saved = false;
          for (let attempt = 0; attempt < 5 && active(); attempt++) {
            const payload = record
              ? mergePrivate(operation.before, operation.after, record.payload)
              : operation.after;
            if (record && equal(payload, record.payload)) {
              saved = true;
              break;
            }
            const result = await write(name, payload, record?.revision ?? null);
            if (!active()) return;
            if (result) {
              record = { payload, revision: result.revision };
              saved = true;
              break;
            }
            record = await read(name);
          }
          if (!saved)
            throw Error(
              "Cet espace est très actif. La modification reste en attente et sera réessayée.",
            );
          operations.shift();
          await persist(name, operations).catch(() => {});
        }
        if (active()) {
          if (record) await apply(record.payload, name);
          status(
            operations.length
              ? "Enregistrement partagé en cours…"
              : "À jour · enregistré et partagé avec les comptes autorisés",
            { name, pending: operations.length, error: false },
          );
        }
      } catch (error) {
        if (!active()) return;
        status(
          `${operations.length ? "Modification en attente · " : "Connexion interrompue · "}${error.message}`,
          {
            name,
            pending: operations.length,
            error: true,
            conflict: error instanceof SyncConflict,
          },
        );
      }
    })();
    jobs.set(name, task);
    try {
      await task;
    } finally {
      jobs.delete(name);
    }
  }
  return {
    async enqueue(name, before, after) {
      const operations = await queue(name);
      operations.push({
        before: cloneData(before),
        after: cloneData(after),
      });
      status("Enregistrement partagé en cours…", {
        name,
        pending: operations.length,
        error: false,
      });
      try {
        await persist(name, operations);
      } catch {
        status(
          "Stockage local indisponible · tentative d’enregistrement en ligne…",
          { name, pending: operations.length, error: true },
        );
      }
      await synchronize(name);
    },
    synchronize,
    async pending(name) {
      return cloneData(await queue(name));
    },
    async discard(name) {
      if (jobs.has(name)) return false;
      const operations = await queue(name);
      operations.splice(0);
      await persist(name, operations);
      await synchronize(name);
      return true;
    },
  };
}
