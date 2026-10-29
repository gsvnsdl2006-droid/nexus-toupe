import React from "react";
import { Award, TrendingUp, Flag } from "lucide-react";
import { progressionStats } from "./progression-stats";
export default function ProgressDashboard({ patrol, member }) {
  if (!member) return null;
  const person = patrol.members.find((m) => m.id === member);
  const s = progressionStats(patrol, member),
    formatted = new Intl.NumberFormat("fr-FR", {
      maximumFractionDigits: 1,
    }).format(s.percent);
  return (
    <section
      className="progress-dashboard"
      aria-label={`Progression de ${person?.name || "ce membre"}`}
    >
      <header className="progress-member-profile">
        {person?.photo ? (
          <img src={person.photo} alt={`Photo de profil de ${person.name}`} />
        ) : (
          <div className="progress-member-initials" aria-label="Photo non ajoutée">
            {person?.name.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0]).join("")}
          </div>
        )}
        <div>
          <div className="eyebrow">MON PROFIL SCOUT</div>
          <h3>{person?.name}</h3>
          <p>Mes badges, mes réalisations et ma progression</p>
        </div>
      </header>
      <div className="progress-dashboard-main">
        <div
          className="attendance-ring progress-ring"
          role="img"
          aria-label={`${s.done} badges terminés sur 93, ${formatted} %`}
        >
          <svg viewBox="0 0 120 120">
            <circle
              className="ring-track"
              cx="60"
              cy="60"
              r="50"
              fill="none"
              stroke="currentColor"
              strokeWidth="10"
            />
            <circle
              cx="60"
              cy="60"
              r="50"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="10"
              strokeDasharray={`${s.percent * Math.PI} ${100 * Math.PI}`}
              transform="rotate(-90 60 60)"
              strokeLinecap={s.done ? "round" : "butt"}
            />
          </svg>
          <strong>{formatted}%</strong>
        </div>
        <div>
          <div className="eyebrow">MON PARCOURS SCOUT</div>
          <p>
            <b>{s.done} / 93</b> badges terminés
          </p>
          <small>
            Un badge compte comme terminé lorsque tu le marques comme tel.
          </small>
        </div>
      </div>
      <div className="progress-dashboard-stats">
        <div>
          <Award size={20} />
          <strong>{s.done}</strong>
          <span>Terminés</span>
        </div>
        <div>
          <TrendingUp size={20} />
          <strong>{s.inProgress}</strong>
          <span>En cours</span>
        </div>
        <div>
          <Flag size={20} />
          <strong>{s.remaining}</strong>
          <span>À découvrir</span>
        </div>
      </div>
      <div className="progress-stages">
        <span>Grandes étapes · {s.stages} / 4</span>
        {["Promesse", "2nde classe", "Première classe", "Raider"].map(
          (stage, i) => (
            <span
              key={stage}
              className={
                patrol.badgeCompletions?.[member]?.[i]?.completed ? "done" : ""
              }
            >
              {patrol.badgeCompletions?.[member]?.[i]?.completed ? "✓" : "○"}{" "}
              {stage}
            </span>
          ),
        )}
      </div>
    </section>
  );
}
