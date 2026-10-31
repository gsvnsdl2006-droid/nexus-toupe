import { cloneData, randomId } from "./browser-compat.js";
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
export function mergePrivate(base, local, remote, path = "", preview = false) {
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
        preview,
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
        preview,
      );
      if (value !== undefined) merged[key] = value;
    }
    return merged;
  }
  if (preview) return cloneData(remote);
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
  bootstrap = async () => null,
  prepare = async (operation) => operation,
  merge = mergePrivate,
}) {
  const queues = new Map(),
    jobs = new Map(),
    persistence = new Map(),
    generations = new Map();
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
    const started = generations.get(name) || 0;
    const task = (async () => {
      const operations = await queue(name);
      if (!active()) return;
      let record;
      try {
        record = await read(name);
        if (!active()) return;
        // Only bootstrap a never-populated record; never resurrect members after
        // a later intentional deletion, or interfere with a pending edit.
        if (
          !operations.length &&
          (!record || record.revision === 1) &&
          !record?.payload?.members?.length
        ) {
          const recovery = await bootstrap(name, record);
          if (!active()) return;
          if (recovery) {
            operations.push(recovery);
            await persist(name, operations).catch(() => {});
          }
        }
        let deferred = 0;
        while (operations.length > deferred && active()) {
          let operation = operations[deferred];
          try {
            const prepared = await prepare(operation, name);
            if (!active()) return;
            if (!equal(prepared, operation)) {
              operations[deferred] = operation = prepared;
              await persist(name, operations).catch(() => {});
            }
            let saved = false;
            for (let attempt = 0; attempt < 5 && active(); attempt++) {
              const payload = record
                ? merge(operation.before, operation.after, record.payload)
                : operation.after;
              if (record && equal(payload, record.payload)) {
                saved = true;
                break;
              }
              const result = await write(
                name,
                payload,
                record?.revision ?? null,
              );
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
            operations.splice(deferred, 1);
            await persist(name, operations).catch(() => {});
          } catch (error) {
            if (!(error instanceof SyncConflict)) throw error;
            deferred++;
          }
        }
        if (deferred) throw new SyncConflict("pending");
        if (active()) {
          if (record) await apply(record.payload, name);
          status(
            operations.length
              ? "Enregistrement partagé en cours…"
              : `À jour · enregistré et partagé avec les comptes autorisés · ${record?.payload?.members?.length || 0} membres en ligne · version ${record?.revision ?? 0}`,
            { name, pending: operations.length, error: false },
          );
        }
      } catch (error) {
        if (!active()) return;
        // A draft conflict must never block reading the shared roster. Keep
        // every queued draft, show independent additions, prefer the server
        // only for conflicting fields, and continue retrying on future reads.
        if (record) {
          let visible = cloneData(record.payload);
          for (const operation of operations)
            visible = mergePrivate(
              operation.before,
              operation.after,
              visible,
              "",
              true,
            );
          await apply(visible, name);
        }
        status(
          `${operations.length ? "Modification en attente · " : "Connexion interrompue · "}${error.message}`,
          {
            name,
            pending: operations.length,
            error: true,
            conflict: error instanceof SyncConflict,
            loaded: Boolean(record),
          },
        );
      }
    })();
    jobs.set(name, task);
    try {
      await task;
    } finally {
      jobs.delete(name);
      // An edit may arrive while apply() is backing up the previous snapshot.
      // Do not leave that edit waiting for the next polling interval.
      if (
        active() &&
        (generations.get(name) || 0) !== started &&
        (await queue(name)).length
      )
        await synchronize(name);
    }
  }
  return {
    async enqueue(name, before, after) {
      const operations = await queue(name);
      generations.set(name, (generations.get(name) || 0) + 1);
      const operation = {
        id: randomId(),
        before: cloneData(before),
        after: cloneData(after),
      };
      operations.push(operation);
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
      return !operations.some((pending) => pending.id === operation.id);
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
