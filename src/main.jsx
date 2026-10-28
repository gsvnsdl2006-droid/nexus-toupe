import "@fontsource-variable/dm-sans";
import "@fontsource-variable/manrope";
import { badges as officialBadges } from "./badges.js";
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { get, set } from "idb-keyval";
import * as XLSX from "xlsx";
import {
  ArrowUpRight,
  ArrowLeft,
  Plus,
  Wallet,
  FileText,
  Award,
  Users,
  Cloud,
  Settings,
  X,
  Check,
  ChevronRight,
  Compass,
  CalendarDays,
  Download,
  Upload,
  Search,
  Leaf,
  Mountain,
  Flame,
  Bird,
  Shield,
  TrendingUp,
  CheckCircle2,
  Menu,
} from "lucide-react";
import {
  patrols,
  activities,
  initial,
  uid,
  today,
  totals,
  attendance,
  validBackup,
} from "./model";
import * as drive from "./drive";
import "./style.css";
const icons = [Bird, Flame, Compass, Shield, Leaf, Mountain];
const money = (n) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(n);
const readFile = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
function App() {
  const [data, setData] = useState(null),
    [patrol, selectPatrol] = useState(null),
    [section, setSection] = useState("overview"),
    [tab, setTab] = useState("Réunions"),
    [modal, setModal] = useState(null),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [connected, setConnected] = useState(false),
    [client, setClient] = useState(
      localStorage.getItem("nexus-google-client") || "",
    ),
    [lastSync, setLastSync] = useState(
      localStorage.getItem("nexus-last-sync") || "",
    ),
    [saveState, setSaveState] = useState("Enregistré sur cet appareil"),
    [member, setMember] = useState(""),
    [search, setSearch] = useState(""),
    [campBook, setCampBook] = useState(null),
    [campTab, setCampTab] = useState(0),
    [activity, setActivity] = useState(activities[0]);
  useEffect(() => {
    get("nexus-data")
      .then((d) => {
        if (d?.badges?.every((b) => b.includes("à nommer"))) {
          d.badges = [...officialBadges];
          set("nexus-data", d);
        }
        setData(d || initial());
      })
      .catch(() =>
        setNotice("Impossible de lire les données locales. Rechargez la page."),
      );
    fetch("/templates/camp.xlsx")
      .then((r) => r.arrayBuffer())
      .then((b) => setCampBook(XLSX.read(b)));
  }, []);
  const notify = (s) => {
    setNotice(s);
    setTimeout(() => setNotice(""), 6500);
  };
  function update(fn) {
    const next = structuredClone(data);
    fn(next);
    next.updated = Date.now();
    setData(next);
    setSaveState("Enregistrement…");
    set("nexus-data", next)
      .then(() => setSaveState("Enregistré sur cet appareil"))
      .catch(() => {
        setSaveState("Échec de sauvegarde");
        notify("Stockage plein ou indisponible. Exportez vos données.");
      });
  }
  function patch(fn) {
    update((d) => fn(d.patrols[patrol]));
  }
  async function workbook(kind, name) {
    const b = await (await fetch(`/templates/${kind}.xlsx`)).arrayBuffer();
    const wb = XLSX.read(b);
    const p = data.patrols[name];
    if (kind === "cashflow") {
      for (const a of activities) {
        const rows = p.transactions.filter((t) => t.activity === a);
        const list = [
          ["Name", "In", "Out", "Date"],
          ...rows.map((t) => [
            t.description,
            t.type === "in" ? Number(t.amount) : 0,
            t.type === "out" ? Number(t.amount) : 0,
            t.date,
          ]),
        ];
        const t = totals(rows);
        list.push(
          [],
          ["Total In", t.income],
          ["Total Out", t.expense],
          ["Net Cash", t.income - t.expense],
        );
        wb.Sheets[a] = XLSX.utils.aoa_to_sheet(list);
      }
    } else {
      for (const [sheet, cells] of Object.entries(p.camp)) {
        for (const [ref, value] of Object.entries(cells)) {
          wb.Sheets[sheet][ref] = { t: "s", v: value };
          const range = XLSX.utils.decode_range(
            wb.Sheets[sheet]["!ref"] || "A1",
          );
          const cell = XLSX.utils.decode_cell(ref);
          range.e.r = Math.max(range.e.r, cell.r);
          range.e.c = Math.max(range.e.c, cell.c);
          wb.Sheets[sheet]["!ref"] = XLSX.utils.encode_range(range);
        }
      }
    }
    return new Blob([XLSX.write(wb, { bookType: "xlsx", type: "array" })], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
  }
  function download(blob, name) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  async function run(fn) {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function sync() {
    if (
      !confirm(
        "Archiver les données de cet appareil dans Drive ? Si une autre personne a modifié l’archive, restaurez-la avant de continuer. Les fichiers correspondants seront remplacés.",
      )
    )
      return;
    await run(async () => {
      const stamp = await drive.sync(data, workbook);
      setLastSync(stamp);
      localStorage.setItem("nexus-last-sync", stamp);
      notify("Les 6 patrouilles ont été archivées dans Google Drive.");
    });
  }
  function openPatrol(p) {
    selectPatrol(p);
    setSection("overview");
    setMember("");
    setSearch("");
  }
  if (!data)
    return (
      <div className="loading">
        NEXUS <span>Préparation de votre espace…</span>
      </div>
    );
  const p = patrol ? data.patrols[patrol] : null;
  const all = Object.values(data.patrols);
  const count = all.reduce((n, p) => n + p.members.length, 0);
  const meetings = all.reduce((n, p) => n + p.meetings.length, 0);
  const sum = totals(p ? p.transactions : all.flatMap((p) => p.transactions));
  const titles = {
    overview: "Votre patrouille, au même endroit.",
    treasury: "Une trésorerie bien tenue.",
    secretary: "Les souvenirs se construisent ici.",
    progress: "Chaque pas compte.",
  };
  return (
    <>
      <header>
        <button
          className="brand"
          onClick={() => selectPatrol(null)}
          aria-label="Accueil Nexus"
        >
          {data.branding?.nexus ? (
            <img
              className="brand-image"
              src={data.branding.nexus}
              alt="Logo Nexus"
            />
          ) : (
            <span className="nexus-mark">
              N<span>✦</span>
            </span>
          )}
          <span>
            NEXUS<small>L’ESPACE DE LA TROUPE</small>
          </span>
        </button>
        <nav>
          <button
            className={!patrol ? "selected" : ""}
            onClick={() => selectPatrol(null)}
          >
            Les patrouilles
          </button>
          <button
            onClick={() => {
              setModal("settings");
            }}
          >
            Archives & Drive <ArrowUpRight size={14} />
          </button>
        </nav>
        <div className="header-right">
          <button
            className="icon-btn"
            onClick={() => setModal("settings")}
            aria-label="Paramètres"
          >
            <Settings size={18} />
          </button>
          <div className="orion-brand">
            {data.branding?.orion ? (
              <img
                className="brand-image orion-image"
                src={data.branding.orion}
                alt="Logo Troupe Orion"
              />
            ) : (
              <Shield size={31} />
            )}
            <span>
              TROUPE ORION<small>SAINT VINCENT DE PAUL · NACCACHE</small>
            </span>
          </div>
        </div>
      </header>
      <main>
        <div className="breadcrumb">
          <span>ESPACE TROUPE</span>
          <ChevronRight size={12} />
          <span>{patrol || "TABLEAU DE BORD"}</span>
          <div className="local-status">
            <i />
            {saveState}
          </div>
        </div>
        {!patrol ? (
          <>
            <section className="hero">
              <div>
                <div className="eyebrow">
                  <span /> ENSEMBLE, TOUJOURS PLUS LOIN
                </div>
                <h1>
                  Une troupe.
                  <br />
                  Six patrouilles.
                  <br />
                  <em>Une même aventure.</em>
                </h1>
                <p>
                  Organiser, partager, progresser. Tout ce qui fait vivre
                  <br className="desktop" /> notre troupe, réuni dans un seul
                  espace.
                </p>
                <button
                  className="primary"
                  onClick={() =>
                    document
                      .getElementById("patrols")
                      .scrollIntoView({ behavior: "smooth" })
                  }
                >
                  Retrouver ma patrouille <ArrowUpRight size={18} />
                </button>
                <div className="hero-caption">
                  <span className="little-stars">✦ ✦ ✦</span> Prêts à écrire la
                  suite ?
                </div>
              </div>
              <div className="hero-art">
                <div className="orbital one" />
                <div className="orbital two" />
                <div className="art-star s1">✦</div>
                <div className="art-star s2">✧</div>
                <div className="art-star s3">+</div>
                <svg
                  viewBox="0 0 500 420"
                  aria-label="Illustration de camp scout sous les étoiles"
                >
                  <path
                    d="M12 339Q230 280 488 345L488 400H12Z"
                    fill="#1c3b2c"
                  />
                  <path
                    d="M79 316L111 226 142 316ZM92 276L111 208 129 276Z"
                    fill="#5b7455"
                  />
                  <path
                    d="M354 326L390 210 432 326ZM365 272L390 170 417 272Z"
                    fill="#718366"
                  />
                  <path d="M414 340L449 246 481 340Z" fill="#3b5941" />
                  <path d="M155 330L257 155 366 330Z" fill="#a6ae79" />
                  <path d="M257 155L285 330H366Z" fill="#d3cb9b" />
                  <path d="M155 330L245 238 285 330Z" fill="#233f2e" />
                  <path d="M245 238L257 155 285 330Z" fill="#e0d3a1" />
                  <path d="M145 333H373" stroke="#c5be8b" strokeWidth="3" />
                  <path
                    d="M257 155L138 346M257 155L390 346"
                    stroke="#9ca985"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M195 360L235 343M198 342L232 362"
                    stroke="#a17d55"
                    strokeWidth="7"
                    strokeLinecap="round"
                  />
                  <path
                    d="M206 350Q191 331 211 306Q209 321 224 324Q236 341 220 351Z"
                    fill="#d9b873"
                  />
                  <path
                    d="M211 350Q204 339 216 327Q227 342 219 350Z"
                    fill="#f3dfac"
                  />
                  <path
                    d="M230 388Q278 361 293 340"
                    stroke="#627956"
                    strokeWidth="18"
                    opacity=".4"
                    fill="none"
                  />
                  <circle cx="320" cy="112" r="24" fill="#d6d7a8" />
                  <path
                    d="M329 88A24 24 0 0 0 341 128A24 24 0 0 1 329 88"
                    fill="#163727"
                  />
                  <g fill="#b8c39b">
                    <circle cx="151" cy="140" r="2" />
                    <circle cx="286" cy="63" r="2" />
                    <circle cx="363" cy="152" r="2" />
                    <circle cx="198" cy="95" r="2" />
                    <circle cx="408" cy="103" r="2" />
                  </g>
                </svg>
                <div className="art-label">
                  <Compass size={16} /> L’AVENTURE COMMENCE ENSEMBLE
                </div>
              </div>
            </section>
            <section className="stats">
              <Stat icon={Shield} value="06" label="Patrouilles, une famille" />
              <Stat
                icon={Users}
                value={String(count).padStart(2, "0")}
                label="Scouts dans l’aventure"
              />
              <Stat
                icon={CalendarDays}
                value={String(meetings).padStart(2, "0")}
                label="Réunions partagées"
              />
              <Stat icon={Award} value="93" label="Badges à explorer" />
            </section>
            <section id="patrols">
              <div className="section-heading">
                <div>
                  <div className="eyebrow muted">À CHACUN SON REPAIRE</div>
                  <h2>
                    Les patrouilles <span>06</span>
                  </h2>
                </div>
                <p>Choisis ta patrouille. Fais avancer l’aventure.</p>
              </div>
              <div className="patrol-grid">
                {patrols.map((name, i) => {
                  const Icon = icons[i],
                    q = data.patrols[name];
                  return (
                    <button
                      className={`patrol-card color-${i}`}
                      key={name}
                      onClick={() => openPatrol(name)}
                    >
                      <div className="card-top">
                        <span className="patrol-icon">
                          <Icon size={34} strokeWidth={1.4} />
                        </span>
                        <ArrowUpRight className="card-arrow" size={22} />
                      </div>
                      <span className="card-label">
                        PATROUILLE {String(i + 1).padStart(2, "0")}
                      </span>
                      <h3>{name}</h3>
                      <p>
                        {
                          [
                            "Prendre de la hauteur.",
                            "Avancer avec courage.",
                            "Toujours un pas devant.",
                            "La force du collectif.",
                            "L’esprit vif, le cœur grand.",
                            "Déterminés, ensemble.",
                          ][i]
                        }
                      </p>
                      <div className="card-bottom">
                        <span>
                          <Users size={14} />
                          {q.members.length} membres
                        </span>
                        <span>
                          Entrer <ChevronRight size={14} />
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
            <section className="bottom-banner">
              <div className="banner-icon">
                <Leaf />
              </div>
              <div>
                <h3>Moins de paperasse. Plus d’aventure.</h3>
                <p>
                  Trésorerie, secrétariat et progression : chaque patrouille a
                  son espace.
                </p>
              </div>
              <span>
                TOUJOURS PRÊTS <span>✦</span>
              </span>
            </section>
          </>
        ) : (
          <>
            <button className="back" onClick={() => selectPatrol(null)}>
              <ArrowLeft size={15} /> Toutes les patrouilles
            </button>
            <div className="patrol-title">
              <div>
                <div className="eyebrow">
                  PATROUILLE{" "}
                  {String(patrols.indexOf(patrol) + 1).padStart(2, "0")}
                </div>
                <h1>{patrol}</h1>
                <p>{titles[section]}</p>
              </div>
              <button className="secondary" onClick={() => setModal("member")}>
                <Users size={16} /> Gérer les membres{" "}
                <span>{p.members.length}</span>
              </button>
            </div>
            <div className="section-tabs">
              {[
                ["overview", "Vue d’ensemble", Compass],
                ["treasury", "Trésorier", Wallet],
                ["secretary", "Secrétariat", FileText],
                ["progress", "Progression", Award],
              ].map(([key, label, Icon]) => (
                <button
                  key={key}
                  className={section === key ? "active" : ""}
                  onClick={() => setSection(key)}
                >
                  <Icon size={17} />
                  {label}
                </button>
              ))}
            </div>
            {section === "overview" && (
              <>
                <div className="workspace-grid">
                  {[
                    [
                      "treasury",
                      "Trésorier",
                      "Une caisse claire, des projets qui avancent.",
                      Wallet,
                    ],
                    [
                      "secretary",
                      "Secrétariat",
                      "Réunions, présences et dossier de camp.",
                      FileText,
                    ],
                    [
                      "progress",
                      "Progression",
                      "Des premiers engagements aux grands défis.",
                      Award,
                    ],
                  ].map(([key, title, desc, Icon]) => (
                    <button
                      key={key}
                      className="workspace-card"
                      onClick={() => setSection(key)}
                    >
                      <Icon size={28} />
                      <h2>{title}</h2>
                      <p>{desc}</p>
                      <span>
                        Ouvrir l’espace <ArrowUpRight size={18} />
                      </span>
                    </button>
                  ))}
                </div>
                <div className="stats compact">
                  <Stat icon={Users} value={p.members.length} label="Membres" />
                  <Stat
                    icon={Wallet}
                    value={money(sum.income - sum.expense)}
                    label="Solde (unité choisie)"
                  />
                  <Stat
                    icon={CalendarDays}
                    value={p.meetings.length}
                    label="Réunions"
                  />
                  <Stat
                    icon={Award}
                    value={p.progress.length}
                    label="Étapes documentées"
                  />
                </div>
                <div className="empty-note">
                  <Cloud />
                  <div>
                    <strong>Votre archive, votre histoire.</strong>
                    <p>
                      Les données restent sur cet appareil. Connectez Google
                      Drive pour les archiver et les restaurer sur un autre
                      appareil.
                    </p>
                  </div>
                  <button
                    className="secondary"
                    onClick={() => setModal("settings")}
                  >
                    Configurer Drive
                  </button>
                </div>
              </>
            )}
            {section === "treasury" && (
              <>
                <div className="section-heading">
                  <div>
                    <h2>Cashflow patrouille {patrol.toLowerCase()}</h2>
                    <p>
                      Les quatre activités de votre modèle, dans une caisse bien
                      organisée.
                    </p>
                  </div>
                  <div className="actions">
                    <button
                      className="secondary"
                      onClick={() =>
                        run(async () =>
                          download(
                            await workbook("cashflow", patrol),
                            `cashflow patrouille ${patrol.toLowerCase()}.xlsx`,
                          ),
                        )
                      }
                    >
                      <Download size={16} /> Excel
                    </button>
                    <button
                      className="primary"
                      onClick={() => setModal("transaction")}
                    >
                      <Plus size={16} /> Opération
                    </button>
                  </div>
                </div>
                <div className="mini-stats">
                  <div>
                    <span>Total entrées</span>
                    <strong className="positive">+ {money(sum.income)}</strong>
                  </div>
                  <div>
                    <span>Total sorties</span>
                    <strong>{money(sum.expense)}</strong>
                  </div>
                  <div>
                    <span>Solde net</span>
                    <strong>{money(sum.income - sum.expense)}</strong>
                  </div>
                </div>
                <div className="toolbar">
                  <label>
                    Activité
                    <select
                      value={activity}
                      onChange={(e) => setActivity(e.target.value)}
                    >
                      {activities.map((a) => (
                        <option key={a}>{a}</option>
                      ))}
                    </select>
                  </label>
                  <span>
                    Montants dans une même unité monétaire par patrouille.
                  </span>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Description / Name</th>
                        <th>Entrée / In</th>
                        <th>Sortie / Out</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {p.transactions
                        .filter((t) => t.activity === activity)
                        .map((t) => (
                          <tr key={t.id}>
                            <td>{t.date}</td>
                            <td>{t.description}</td>
                            <td className="positive">
                              {t.type === "in" ? money(t.amount) : "—"}
                            </td>
                            <td>{t.type === "out" ? money(t.amount) : "—"}</td>
                            <td>
                              <button
                                className="text-btn"
                                onClick={() => {
                                  if (confirm("Supprimer cette opération ?"))
                                    patch(
                                      (p) =>
                                        (p.transactions = p.transactions.filter(
                                          (x) => x.id !== t.id,
                                        )),
                                    );
                                }}
                              >
                                Supprimer
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                  {!p.transactions.some((t) => t.activity === activity) && (
                    <Empty
                      icon={Wallet}
                      title="Une caisse prête pour vos projets"
                      text="Ajoutez votre première entrée ou dépense pour cette activité."
                    />
                  )}
                </div>
              </>
            )}
            {section === "secretary" && (
              <>
                <div className="subtabs">
                  {[
                    "Réunions",
                    "Présences & statistiques",
                    "Dossier de camp",
                  ].map((t) => (
                    <button
                      key={t}
                      className={tab === t ? "active" : ""}
                      onClick={() => setTab(t)}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                {tab === "Réunions" && (
                  <>
                    <div className="section-heading">
                      <div>
                        <h2>Le carnet des réunions</h2>
                        <p>
                          Un rendez-vous, un rapport et les présences : tout
                          reste ensemble.
                        </p>
                      </div>
                      <button
                        className="primary"
                        onClick={() => setModal({ type: "meeting" })}
                      >
                        <Plus size={16} /> Nouvelle réunion
                      </button>
                    </div>
                    {!p.meetings.length ? (
                      <Empty
                        icon={CalendarDays}
                        title="La prochaine aventure commence ici"
                        text="Créez une réunion pour enregistrer le rapport et les présences."
                      />
                    ) : (
                      <div className="meeting-list">
                        {[...p.meetings]
                          .sort((a, b) => b.date.localeCompare(a.date))
                          .map((m) => (
                            <button
                              key={m.id}
                              className="meeting-card"
                              onClick={() =>
                                setModal({ type: "meeting", meeting: m })
                              }
                            >
                              <div className="date-tile">
                                <strong>{m.date.slice(8)}</strong>
                                <span>
                                  {new Date(
                                    m.date + "T12:00",
                                  ).toLocaleDateString("fr-FR", {
                                    month: "short",
                                  })}
                                </span>
                              </div>
                              <div>
                                <h3>{m.title}</h3>
                                <p>{m.summary || "Rapport à compléter"}</p>
                                <small>
                                  {
                                    Object.values(m.attendance).filter(
                                      (x) => x === "present",
                                    ).length
                                  }{" "}
                                  présents · {m.date}
                                </small>
                              </div>
                              <ChevronRight size={20} />
                            </button>
                          ))}
                      </div>
                    )}
                  </>
                )}
                {tab === "Présences & statistiques" && (
                  <>
                    <div className="section-heading">
                      <div>
                        <h2>Chaque présence compte</h2>
                        <p>
                          Calculées à partir des réunions où le membre est
                          inscrit.
                        </p>
                      </div>
                      <button
                        className="secondary"
                        onClick={() => setModal("member")}
                      >
                        <Plus size={16} /> Membres
                      </button>
                    </div>
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Membre</th>
                            <th>Présent</th>
                            <th>Absent</th>
                            <th>Assiduité</th>
                          </tr>
                        </thead>
                        <tbody>
                          {p.members.map((m) => {
                            const a = attendance(m.id, p.meetings);
                            const percent = a.total
                              ? Math.round((a.present / a.total) * 100)
                              : 0;
                            return (
                              <tr key={m.id}>
                                <td>
                                  <b>{m.name}</b>
                                </td>
                                <td>{a.present}</td>
                                <td>{a.total - a.present}</td>
                                <td>
                                  <div className="progress-line">
                                    <div>
                                      <i style={{ width: `${percent}%` }} />
                                    </div>
                                    <span>
                                      {a.total
                                        ? `${percent} %`
                                        : "Aucune réunion"}
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {!p.members.length && (
                        <Empty
                          icon={Users}
                          title="Votre équipe vous attend"
                          text="Ajoutez les membres une seule fois, puis retrouvez-les à chaque réunion."
                        />
                      )}
                    </div>
                  </>
                )}
                {tab === "Dossier de camp" && (
                  <>
                    <div className="section-heading">
                      <div>
                        <h2>Dossier de camp · {patrol}</h2>
                        <p>
                          Les 15 onglets de votre modèle SVP. Touchez une
                          cellule pour la modifier.
                        </p>
                      </div>
                      <button
                        className="secondary"
                        onClick={() =>
                          run(async () =>
                            download(
                              await workbook("camp", patrol),
                              `Dossier de camp ${patrol}.xlsx`,
                            ),
                          )
                        }
                      >
                        <Download size={16} /> Excel
                      </button>
                    </div>
                    {campBook && (
                      <>
                        <select
                          className="camp-select"
                          value={campTab}
                          onChange={(e) => setCampTab(Number(e.target.value))}
                        >
                          {campBook.SheetNames.map((s, i) => (
                            <option value={i} key={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                        <CampGrid
                          book={campBook}
                          index={campTab}
                          edits={p.camp}
                          change={(sheet, ref, value) =>
                            patch((p) => {
                              p.camp[sheet] ??= {};
                              p.camp[sheet][ref] = value;
                            })
                          }
                        />
                        <p className="hint">
                          Grille éditable A–O, jusqu’à 200 lignes. Les textes du
                          modèle servent de référence ; ils ne sont pas des
                          instructions de l’application. Le fichier original
                          reste disponible dans les modèles.
                        </p>
                      </>
                    )}
                  </>
                )}
              </>
            )}
            {section === "progress" && (
              <>
                <div className="section-heading">
                  <div>
                    <h2>Ton chemin, tes accomplissements.</h2>
                    <p>
                      Raconte ce que tu as réalisé et garde une trace en images.
                    </p>
                  </div>
                  <button
                    className="secondary"
                    onClick={() => setModal("catalogue")}
                  >
                    <Settings size={16} /> Catalogue des 93 badges
                  </button>
                </div>
                <div className="toolbar">
                  <label>
                    Membre
                    <select
                      aria-label="Membre"
                      value={member}
                      onChange={(e) => setMember(e.target.value)}
                    >
                      <option value="">Choisir mon nom</option>
                      {p.members.map((m) => (
                        <option value={m.id} key={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="text-btn"
                    onClick={() => setModal("member")}
                  >
                    Ajouter mon nom
                  </button>
                  <label className="search">
                    <Search size={16} />
                    <input
                      aria-label="Rechercher un badge"
                      placeholder="Rechercher une étape, un badge…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </label>
                </div>
                <p className="hint">
                  Le nom sélectionne un carnet ; il ne constitue pas une
                  authentification. Catalogue des 93 badges fourni par la
                  troupe, hors brevets de capacités.
                </p>
                <div className="badge-grid">
                  {[
                    "Promesse",
                    "2nde classe",
                    "Première classe",
                    "Raider",
                    ...data.badges,
                  ]
                    .map((b, i) => ({ b, i }))
                    .filter(({ b }) =>
                      b.toLowerCase().includes(search.toLowerCase()),
                    )
                    .map(({ b, i }) => {
                      const entries = p.progress.filter(
                        (e) => e.member === member && e.badge === i,
                      );
                      return (
                        <button
                          className={`badge-card ${entries.length ? "documented" : ""}`}
                          key={i}
                          onClick={() =>
                            member
                              ? setModal({ type: "progress", badge: i })
                              : notify(
                                  "Choisissez votre nom avant d’ouvrir un carnet.",
                                )
                          }
                        >
                          <span className="badge-emblem">
                            {i < 4 ? <Shield size={28} /> : <Award size={28} />}
                          </span>
                          <small>
                            {i < 4
                              ? "LES GRANDES ÉTAPES"
                              : `BADGE ${String(i - 3).padStart(2, "0")}`}
                          </small>
                          <h3>{b}</h3>
                          <span>
                            {entries.length
                              ? `${entries.length} réalisation${entries.length > 1 ? "s" : ""}`
                              : "Commencer mon carnet"}{" "}
                            <Plus size={13} />
                          </span>
                        </button>
                      );
                    })}
                </div>
              </>
            )}
          </>
        )}
        <footer>
          <span>
            <span className="footer-star">✦</span> NEXUS{" "}
            <span className="footer-divider">/</span> TROUPE ORION
          </span>
          <span>Fait pour la troupe. Pensé pour l’aventure.</span>
          <button onClick={() => setModal("settings")}>
            <i className={connected ? "green-dot" : "grey-dot"} />
            {connected ? "Drive connecté" : "Mode local · Drive non connecté"}
          </button>
        </footer>
      </main>
      {notice && (
        <div role="status" className="toast">
          <CheckCircle2 size={18} />
          <span>{notice}</span>
          <button onClick={() => setNotice("")} aria-label="Fermer">
            <X size={16} />
          </button>
        </div>
      )}
      {modal && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !busy) setModal(null);
          }}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Éditeur Nexus"
          >
            <button
              className="modal-close icon-btn"
              onClick={() => setModal(null)}
              disabled={busy}
              aria-label="Fermer"
            >
              <X />
            </button>
            {modal === "member" && (
              <>
                <div className="eyebrow">LA FORCE DU COLLECTIF</div>
                <h2>Les membres · {patrol}</h2>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    const name = f.get("name").trim();
                    if (!name) return;
                    if (
                      p.members.some(
                        (m) => m.name.toLowerCase() === name.toLowerCase(),
                      )
                    )
                      return notify("Ce nom existe déjà.");
                    patch((p) => p.members.push({ id: uid(), name }));
                    e.currentTarget.reset();
                  }}
                >
                  <label>
                    Prénom et nom
                    <input
                      name="name"
                      placeholder="Ex. Marc Haddad"
                      required
                      maxLength={100}
                    />
                  </label>
                  <button className="primary">
                    <Plus size={16} /> Ajouter un membre
                  </button>
                </form>
                <div className="member-list">
                  {p.members.map((m) => (
                    <div key={m.id}>
                      <span className="avatar">
                        {m.name
                          .split(" ")
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join("")}
                      </span>
                      <span>{m.name}</span>
                    </div>
                  ))}
                </div>
                <p className="hint">
                  Les membres sont conservés pour préserver l’historique des
                  présences et de la progression.
                </p>
              </>
            )}
            {modal === "transaction" && (
              <>
                <div className="eyebrow">TRÉSORERIE</div>
                <h2>Nouvelle opération</h2>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = Object.fromEntries(new FormData(e.currentTarget));
                    if (
                      !f.description.trim() ||
                      !Number.isFinite(Number(f.amount)) ||
                      Number(f.amount) <= 0
                    )
                      return;
                    patch((p) =>
                      p.transactions.push({
                        ...f,
                        description: f.description.trim(),
                        amount: Number(f.amount),
                        id: uid(),
                      }),
                    );
                    setModal(null);
                  }}
                >
                  <label>
                    Description
                    <input
                      name="description"
                      required
                      maxLength={200}
                      placeholder="Cotisation, achat de matériel…"
                    />
                  </label>
                  <div className="form-row">
                    <label>
                      Date
                      <input
                        name="date"
                        type="date"
                        defaultValue={today()}
                        required
                      />
                    </label>
                    <label>
                      Type
                      <select name="type">
                        <option value="in">Entrée</option>
                        <option value="out">Sortie</option>
                      </select>
                    </label>
                  </div>
                  <div className="form-row">
                    <label>
                      Montant
                      <input
                        name="amount"
                        type="number"
                        step="0.01"
                        min="0.01"
                        required
                      />
                    </label>
                    <label>
                      Activité
                      <select name="activity" defaultValue={activity}>
                        {activities.map((a) => (
                          <option key={a}>{a}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <button className="primary">
                    <Check size={16} /> Enregistrer l’opération
                  </button>
                </form>
              </>
            )}
            {modal.type === "meeting" && (
              <MeetingForm
                meeting={modal.meeting}
                members={p.members}
                save={(m) => {
                  patch((p) => {
                    const i = p.meetings.findIndex((x) => x.id === m.id);
                    if (i < 0) p.meetings.push(m);
                    else p.meetings[i] = m;
                  });
                  setModal(null);
                  notify("Rapport et présences enregistrés sur cet appareil.");
                }}
              />
            )}
            {modal.type === "progress" && (
              <ProgressForm
                title={
                  [
                    "Promesse",
                    "2nde classe",
                    "Première classe",
                    "Raider",
                    ...data.badges,
                  ][modal.badge]
                }
                entries={p.progress.filter(
                  (e) => e.member === member && e.badge === modal.badge,
                )}
                save={(e) => {
                  patch((p) =>
                    p.progress.push({
                      ...e,
                      id: uid(),
                      member,
                      badge: modal.badge,
                    }),
                  );
                  notify("Réalisation enregistrée.");
                }}
              />
            )}
            {modal === "catalogue" && (
              <>
                <div className="eyebrow">93 BADGES · CATALOGUE DE TROUPE</div>
                <h2>Les noms officiels</h2>
                <p>
                  Collez la liste de votre association : un badge par ligne,
                  exactement 93. Elle sera utilisée pour toutes les patrouilles.
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const names = new FormData(e.currentTarget)
                      .get("badges")
                      .split("\n")
                      .map((s) => s.trim())
                      .filter(Boolean);
                    if (names.length !== 93)
                      return notify(
                        `La liste contient ${names.length} noms. Il en faut 93.`,
                      );
                    if (new Set(names).size !== 93)
                      return notify("Chaque badge doit avoir un nom unique.");
                    update((d) => (d.badges = names));
                    setModal(null);
                  }}
                >
                  <textarea
                    className="catalogue"
                    name="badges"
                    defaultValue={data.badges.join("\n")}
                    required
                  />
                  <button className="primary">Enregistrer le catalogue</button>
                </form>
              </>
            )}
            {modal === "settings" && (
              <>
                <div className="eyebrow">VOTRE HISTOIRE, BIEN GARDÉE</div>
                <h2>Archives & Google Drive</h2>
                <div className="connection">
                  <Cloud />
                  <div>
                    <strong>
                      {connected
                        ? "Google Drive connecté"
                        : "Travail local sur cet appareil"}
                    </strong>
                    <p>
                      {lastSync
                        ? `Dernière archive : ${new Date(lastSync).toLocaleString("fr-FR")}`
                        : "Aucune synchronisation effectuée."}
                    </p>
                  </div>
                </div>
                <p>
                  Connectez votre compte pour créer un dossier Nexus Troupe
                  Orion, six dossiers de patrouille, leurs Google Sheets,
                  rapports Google Docs et photos de progression.
                </p>
                <label>
                  Identifiant client Google OAuth
                  <input
                    value={client}
                    placeholder="…apps.googleusercontent.com"
                    onChange={(e) => {
                      setClient(e.target.value);
                      localStorage.setItem(
                        "nexus-google-client",
                        e.target.value,
                      );
                    }}
                  />
                </label>
                <p className="hint">
                  Client Web Google Cloud avec API Drive activée. Ajoutez
                  l’origine exacte de ce site aux origines JavaScript
                  autorisées. Aucun secret client requis.
                </p>
                <div className="actions">
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        await drive.connect(client);
                        setConnected(true);
                        notify(
                          "Google Drive connecté. Vous pouvez synchroniser.",
                        );
                      })
                    }
                  >
                    <Cloud size={16} />
                    {busy
                      ? "Veuillez patienter…"
                      : connected
                        ? "Reconnecter"
                        : "Connecter Google"}
                  </button>
                  {connected && (
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() => {
                        drive.disconnect();
                        setConnected(false);
                      }}
                    >
                      Déconnecter
                    </button>
                  )}
                </div>
                <div className="settings-block">
                  <h3>Archiver et reprendre</h3>
                  <p>
                    La synchronisation envoie les données locales vers Drive.
                    Pour changer d’appareil, restaurez d’abord l’archive. Évitez
                    les modifications simultanées : cette version ne fusionne
                    pas plusieurs utilisateurs.
                  </p>
                  <div className="actions">
                    <button
                      className="primary"
                      disabled={!connected || busy}
                      onClick={sync}
                    >
                      <Upload size={16} />
                      {busy
                        ? "Archivage en cours…"
                        : "Tout archiver dans Drive"}
                    </button>
                    <button
                      className="secondary"
                      disabled={!connected || busy}
                      onClick={() => {
                        if (
                          confirm(
                            "Remplacer les données locales par la dernière archive Drive ? Exportez une copie locale avant de continuer.",
                          )
                        )
                          run(async () => {
                            const d = await drive.restore();
                            if (!validBackup(d))
                              throw Error("Archive incompatible.");
                            await set("nexus-data", d);
                            setData(d);
                            notify("Archive restaurée.");
                          });
                      }}
                    >
                      <Download size={16} /> Restaurer
                    </button>
                  </div>
                </div>
                <div className="settings-block">
                  <h3>Les couleurs de la troupe</h3>
                  <p>
                    Ajoutez les fichiers des logos Nexus et Orion pour remplacer
                    les marques provisoires de l’en-tête.
                  </p>
                  <div className="form-row">
                    {["nexus", "orion"].map((key) => (
                      <label key={key}>
                        Logo {key}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (!file) return;
                            if (
                              file.size > 3 * 1024 * 1024 ||
                              ![
                                "image/png",
                                "image/jpeg",
                                "image/webp",
                              ].includes(file.type)
                            )
                              return notify(
                                "Choisissez une image PNG, JPEG ou WebP de moins de 3 Mo.",
                              );
                            run(async () => {
                              const image = await readFile(file);
                              update((d) => {
                                d.branding ??= {};
                                d.branding[key] = image;
                              });
                            });
                          }}
                        />
                      </label>
                    ))}
                  </div>
                </div>
                <div className="settings-block">
                  <h3>Une copie à emporter</h3>
                  <div className="actions">
                    <button
                      className="secondary"
                      onClick={() =>
                        download(
                          new Blob([JSON.stringify(data, null, 2)], {
                            type: "application/json",
                          }),
                          "nexus-backup.json",
                        )
                      }
                    >
                      <Download size={16} /> Exporter les données
                    </button>
                    <label className="secondary file-button">
                      <Upload size={16} /> Importer une copie
                      <input
                        type="file"
                        accept="application/json,.json"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (
                            file &&
                            confirm(
                              "Remplacer les données locales par ce fichier ?",
                            )
                          )
                            run(async () => {
                              const d = JSON.parse(await file.text());
                              if (!validBackup(d))
                                throw Error("Fichier Nexus incompatible.");
                              await set("nexus-data", d);
                              setData(d);
                              notify("Données importées.");
                            });
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                  <div className="template-links">
                    <a href="/templates/cashflow.xlsx" download>
                      Modèle cashflow original ↗
                    </a>
                    <a href="/templates/camp.xlsx" download>
                      Modèle dossier de camp original ↗
                    </a>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}
function Stat({ icon: Icon, value, label }) {
  return (
    <div className="stat">
      <span className="stat-icon">
        <Icon size={21} strokeWidth={1.5} />
      </span>
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}
function Empty({ icon: Icon, title, text }) {
  return (
    <div className="empty">
      <Icon size={30} strokeWidth={1.3} />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
function MeetingForm({ meeting, members, save }) {
  const [statuses, change] = useState({
    ...Object.fromEntries(members.map((m) => [m.id, "absent"])),
    ...meeting?.attendance,
  });
  return (
    <>
      <div className="eyebrow">SECRÉTARIAT · RAPPORT & PRÉSENCES</div>
      <h2>{meeting ? "Le carnet de réunion" : "Une nouvelle réunion"}</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = Object.fromEntries(new FormData(e.currentTarget));
          save({ ...f, id: meeting?.id || uid(), attendance: statuses });
        }}
      >
        <label>
          Titre
          <input
            name="title"
            defaultValue={meeting?.title}
            required
            maxLength={150}
            placeholder="Réunion de patrouille"
          />
        </label>
        <label>
          Date
          <input
            name="date"
            type="date"
            required
            defaultValue={meeting?.date || today()}
          />
        </label>
        <label>
          Rapport de la réunion
          <textarea
            name="summary"
            rows={5}
            defaultValue={meeting?.summary}
            placeholder="Activités réalisées, décisions, prochains objectifs…"
          />
        </label>
        <h3>Qui était là ?</h3>
        {!members.length && (
          <p className="hint">
            Ajoutez des membres depuis la patrouille pour noter les présences.
          </p>
        )}
        <div className="attendance-list">
          {members.map((m) => (
            <div key={m.id}>
              <span>{m.name}</span>
              <div>
                {["present", "absent"].map((status) => (
                  <button
                    type="button"
                    className={
                      statuses[m.id] === status ? "chosen " + status : ""
                    }
                    key={status}
                    onClick={() => change({ ...statuses, [m.id]: status })}
                  >
                    {status === "present" ? "Présent" : "Absent"}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <button className="primary">
          <Check size={16} /> Enregistrer rapport & présences
        </button>
      </form>
    </>
  );
}
function ProgressForm({ title, entries, save }) {
  const [photos, setPhotos] = useState([]),
    [error, setError] = useState(""),
    [reading, setReading] = useState(false);
  return (
    <>
      <div className="eyebrow">MON CARNET DE PROGRESSION</div>
      <h2>{title}</h2>
      <div className="entry-list">
        {entries.map((e) => (
          <article key={e.id}>
            <small>{e.date}</small>
            <p>{e.text}</p>
            <div className="photos">
              {e.photos.map((photo) => (
                <a
                  href={photo.data}
                  target="_blank"
                  rel="noreferrer"
                  key={photo.id}
                >
                  <img src={photo.data} alt={photo.name} />
                </a>
              ))}
            </div>
          </article>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          if (!f.get("text").trim()) return;
          save({ date: f.get("date"), text: f.get("text").trim(), photos });
          e.currentTarget.reset();
          setPhotos([]);
        }}
      >
        <label>
          Date
          <input name="date" type="date" defaultValue={today()} required />
        </label>
        <label>
          Ce que j’ai accompli
          <textarea
            name="text"
            rows={4}
            required
            placeholder="Décris ton expérience, ce que tu as appris…"
          />
        </label>
        <label className="photo-upload">
          <Upload size={20} />
          {reading
            ? "Lecture des photos…"
            : "Ajouter des photos (3 maximum, 3 Mo chacune)"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={async (e) => {
              const files = [...e.target.files];
              if (
                files.length + photos.length > 3 ||
                files.some(
                  (f) =>
                    f.size > 3 * 1024 * 1024 ||
                    !["image/jpeg", "image/png", "image/webp"].includes(f.type),
                )
              )
                return setError(
                  "Choisissez au maximum 3 photos JPEG, PNG ou WebP de moins de 3 Mo.",
                );
              setReading(true);
              try {
                const next = await Promise.all(
                  files.map(async (f) => ({
                    id: uid(),
                    name: f.name,
                    data: await readFile(f),
                  })),
                );
                setPhotos((v) => [...v, ...next]);
                setError("");
              } catch {
                setError("Impossible de lire cette photo.");
              } finally {
                setReading(false);
                e.target.value = "";
              }
            }}
          />
        </label>
        <div className="photos">
          {photos.map((photo) => (
            <button
              type="button"
              key={photo.id}
              onClick={() => setPhotos(photos.filter((p) => p.id !== photo.id))}
              aria-label="Retirer la photo"
            >
              <img src={photo.data} alt={photo.name} />
              <X size={12} />
            </button>
          ))}
        </div>
        {error && <p role="alert">{error}</p>}
        <button className="primary" disabled={reading}>
          <Plus size={16} /> Ajouter une réalisation
        </button>
      </form>
    </>
  );
}
function CampGrid({ book, index, edits, change }) {
  const name = book.SheetNames[index],
    sheet = book.Sheets[name];
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
  const rows = Math.min(200, Math.max(range.e.r + 8, 35));
  return (
    <div className="sheet-wrap">
      <table className="sheet">
        <thead>
          <tr>
            <th />
            <>
              {Array.from({ length: 15 }, (_, c) => (
                <th key={c}>{XLSX.utils.encode_col(c)}</th>
              ))}
            </>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, r) => (
            <tr key={r}>
              <th>{r + 1}</th>
              {Array.from({ length: 15 }, (_, c) => {
                const ref = XLSX.utils.encode_cell({ r, c });
                const cell = sheet[ref];
                return (
                  <td key={c}>
                    <input
                      aria-label={`${name} ${ref}`}
                      title={String(edits[name]?.[ref] ?? cell?.v ?? "")}
                      value={edits[name]?.[ref] ?? cell?.v ?? ""}
                      onChange={(e) => change(name, ref, e.target.value)}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
