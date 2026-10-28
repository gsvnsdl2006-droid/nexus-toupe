let token;
let expiresAt = 0;
const sessionKey = "nexus-drive-session";
function clearSession() {
  token = null;
  try {
    globalThis.sessionStorage?.removeItem(sessionKey);
  } catch {}
}
export function resumeSession() {
  try {
    const session = JSON.parse(
      globalThis.sessionStorage?.getItem(sessionKey) || "null",
    );
    if (session?.token && session.expiresAt > Date.now() + 30000) {
      token = session.token;
      expiresAt = session.expiresAt;
      return true;
    }
  } catch {}
  clearSession();
  return false;
}

export class DriveError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

export async function connect(clientId) {
  if (!clientId)
    throw Error(
      "Ajoutez votre identifiant client Google OAuth dans les paramètres.",
    );
  if (!window.google) {
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.onload = resolve;
      s.onerror = () =>
        reject(Error("Google est inaccessible. Vérifiez votre connexion."));
      document.head.append(s);
    });
  }
  token = await new Promise((resolve, reject) =>
    window.google.accounts.oauth2
      .initTokenClient({
        client_id: clientId,
        scope: "https://www.googleapis.com/auth/drive.file",
        callback: (r) => {
          if (r.access_token) {
            expiresAt = Date.now() + Number(r.expires_in || 3600) * 1000;
            try {
              globalThis.sessionStorage?.setItem(
                sessionKey,
                JSON.stringify({ token: r.access_token, expiresAt }),
              );
            } catch {}
            resolve(r.access_token);
          } else reject(Error(r.error_description || r.error));
        },
        error_callback: () => reject(Error("Connexion Google annulée.")),
      })
      .requestAccessToken(),
  );
}
export function disconnect() {
  if (token) window.google?.accounts?.oauth2?.revoke?.(token, () => {});
  clearSession();
}
async function request(url, options = {}) {
  if (!token || Date.now() >= expiresAt)
    throw new DriveError(
      "Reconnectez Google pour reprendre l’archivage automatique.",
      "AUTH",
    );
  const r = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...options.headers },
  });
  if (r.status === 401) {
    clearSession();
    throw new DriveError(
      "Votre connexion Google a expiré. Reconnectez-vous pour reprendre l’archivage automatique.",
      "AUTH",
    );
  }
  if (!r.ok) throw Error(`Google Drive (${r.status}) : ${await r.text()}`);
  return r.status === 204 ? null : r.json();
}
async function find(name, parent) {
  const esc = (s) => s.replaceAll("\\", "\\\\").replaceAll("'", "\\'");
  const q = `trashed = false and name = '${esc(name)}'${parent ? ` and '${esc(parent)}' in parents` : ""}`;
  return (
    await request(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType)`,
    )
  ).files[0];
}
async function folder(name, parent) {
  const old = await find(name, parent);
  if (old) return old.id;
  return (
    await request("https://www.googleapis.com/drive/v3/files", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        mimeType: "application/vnd.google-apps.folder",
        ...(parent ? { parents: [parent] } : {}),
      }),
    })
  ).id;
}
async function put(name, parent, blob, mimeType) {
  const old = await find(name, parent);
  const body = new FormData();
  body.append(
    "metadata",
    new Blob(
      [
        JSON.stringify({
          name,
          ...(!old ? { parents: [parent], mimeType } : {}),
        }),
      ],
      { type: "application/json" },
    ),
  );
  body.append("file", blob);
  return request(
    `https://www.googleapis.com/upload/drive/v3/files${old ? "/" + old.id : ""}?uploadType=multipart`,
    { method: old ? "PATCH" : "POST", body },
  );
}
export async function sync(data, workbook, options = {}) {
  if (!token) throw Error("Connectez Google Drive avant de synchroniser.");
  if (Object.hasOwn(options, "expectedRevision")) {
    const remote = await readArchive();
    if ((remote?.updated ?? null) !== options.expectedRevision)
      throw new DriveError(
        "L’archive a changé sur un autre appareil. Choisissez quelle version conserver dans Archives & Drive.",
        "CONFLICT",
      );
  }
  const previous = options.previous;
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const root = await folder("Nexus Troupe Orion");
  for (const [name, p] of Object.entries(data.patrols)) {
    const old = previous?.patrols?.[name];
    if (same(p, old)) continue;
    const dir = await folder(name, root);
    if (!same(p.transactions, old?.transactions))
      await put(
        `cashflow patrouille ${name.toLowerCase()}`,
        dir,
        await workbook("cashflow", name),
        "application/vnd.google-apps.spreadsheet",
      );
    if (!same(p.camp, old?.camp))
      await put(
        `Dossier de camp ${name}`,
        dir,
        await workbook("camp", name),
        "application/vnd.google-apps.spreadsheet",
      );
    if (p.camps?.length) {
      const campsDir = await folder("Dossiers de camp", dir);
      for (const camp of p.camps) {
        if (
          same(
            camp,
            old?.camps?.find((c) => c.id === camp.id),
          )
        )
          continue;
        const campDir = await folder(`${camp.title} [${camp.id}]`, campsDir);
        await put(
          `Dossier de camp ${camp.title}.xlsx`,
          campDir,
          await workbook("camp-form", name, camp),
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        );
      }
    }
    if (!same(p.members, old?.members))
      await put(
        `Membres ${name}.json`,
        dir,
        new Blob([JSON.stringify(p.members)], { type: "application/json" }),
        "application/json",
      );
    const meetings = await folder("Réunions", dir);
    for (const m of p.meetings) {
      if (
        same(
          m,
          old?.meetings.find((x) => x.id === m.id),
        ) &&
        same(p.members, old?.members)
      )
        continue;
      const html = `<html><meta charset="utf-8"><h1>${escapeHtml(m.title)}</h1><p>${escapeHtml(m.date)}</p><p>${escapeHtml(m.summary).replaceAll("\n", "<br>")}</p><h2>Présences</h2><ul>${Object.entries(
        m.attendance,
      )
        .map(
          ([id, status]) =>
            `<li>${escapeHtml(p.members.find((x) => x.id === id)?.name || "Ancien membre")} : ${escapeHtml(status)}</li>`,
        )
        .join("")}</ul></html>`;
      await put(
        `${m.date} - ${m.title} [${m.id}]`,
        meetings,
        new Blob([html], { type: "text/html" }),
        "application/vnd.google-apps.document",
      );
    }
    const progression = await folder("Progression", dir);
    for (const e of p.progress) {
      for (const photo of e.photos || []) {
        if (
          old?.progress.some(
            (entry) =>
              entry.id === e.id &&
              entry.photos?.some(
                (prior) => prior.id === photo.id && prior.data === photo.data,
              ),
          )
        )
          continue;
        const blob = await (await fetch(photo.data)).blob();
        await put(
          `${e.id}-${photo.id}-${photo.name}`,
          progression,
          blob,
          blob.type,
        );
      }
    }
    await put(
      `Progression ${name}.json`,
      progression,
      new Blob([JSON.stringify(p.progress)], { type: "application/json" }),
      "application/json",
    );
  }
  await put(
    "nexus-backup.json",
    root,
    new Blob([JSON.stringify(data)], { type: "application/json" }),
    "application/json",
  );
  return new Date().toISOString();
}
export async function restore() {
  if (!token) throw Error("Connectez Google Drive.");
  const data = await readArchive();
  if (!data) throw Error("Aucune archive Nexus trouvée.");
  return data;
}
export async function readArchive() {
  const root = await find("Nexus Troupe Orion");
  if (!root) return null;
  const file = await find("nexus-backup.json", root.id);
  if (!file) return null;
  return request(
    `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
  );
}
function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}
