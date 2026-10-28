import React from "react";
import { attendance } from "./model";
export function patrolAttendance(p) {
  let present = 0,
    total = 0;
  for (const m of p.meetings)
    for (const s of Object.values(m.attendance)) {
      if (s === "present" || s === "absent") {
        total++;
        if (s === "present") present++;
      }
    }
  return {
    present,
    total,
    rate: total ? Math.round((present / total) * 100) : null,
  };
}
export function AttendanceOverview({ patrols }) {
  return (
    <section className="attendance-overview">
      <div className="section-heading">
        <div>
          <div className="eyebrow">ENSEMBLE À CHAQUE RENDEZ-VOUS</div>
          <h2>Présence des patrouilles</h2>
          <p>Taux de présence sur l’ensemble des réunions enregistrées.</p>
        </div>
      </div>
      <div className="patrol-attendance-bars">
        {Object.entries(patrols).map(([name, p], i) => {
          const a = patrolAttendance(p);
          return (
            <div className={`attendance-bar color-${i}`} key={name}>
              <div>
                <strong>{name}</strong>
                <span>
                  {a.rate === null
                    ? "Aucune présence enregistrée"
                    : `${a.rate} %`}
                </span>
              </div>
              <div className="chart-track">
                <i style={{ width: `${a.rate ?? 0}%` }} />
              </div>
              <small>
                {a.present} présences / {a.total} participations attendues ·{" "}
                {p.meetings.length} réunion{p.meetings.length > 1 ? "s" : ""}
              </small>
            </div>
          );
        })}
      </div>
    </section>
  );
}
export function MemberAttendance({ patrol }) {
  const a = patrolAttendance(patrol);
  const absent = a.total - a.present;
  return (
    <>
      <div className="attendance-summary">
        <div
          className="attendance-ring"
          role="img"
          aria-label={
            a.rate === null
              ? "Aucune présence enregistrée"
              : `${a.rate} % de présence dans la patrouille`
          }
        >
          <svg viewBox="0 0 120 120">
            <circle
              cx="60"
              cy="60"
              r="50"
              fill="none"
              stroke="currentColor"
              strokeWidth="10"
              className="ring-track"
            />
            <circle
              cx="60"
              cy="60"
              r="50"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="10"
              strokeDasharray={`${(a.rate ?? 0) * Math.PI} ${100 * Math.PI}`}
              transform="rotate(-90 60 60)"
              strokeLinecap="round"
            />
          </svg>
          <strong>{a.rate === null ? "—" : `${a.rate}%`}</strong>
        </div>
        <div>
          <h3>L’assiduité de la patrouille</h3>
          <p>
            <b>{a.present}</b> présences · <b>{absent}</b> absences
          </p>
          <small>
            {patrol.meetings.length} réunions enregistrées. Les réunions
            précédant l’inscription d’un membre ne pénalisent pas son taux.
          </small>
        </div>
      </div>
      <div className="member-attendance-charts">
        {patrol.members.map((m) => {
          const a = attendance(m.id, patrol.meetings);
          const rate = a.total ? Math.round((a.present / a.total) * 100) : null;
          return (
            <article key={m.id}>
              <div className="member-chart-title">
                <strong>{m.name}</strong>
                <span>{rate === null ? "—" : `${rate} %`}</span>
              </div>
              <div className="chart-track">
                <i style={{ width: `${rate ?? 0}%` }} />
              </div>
              <p>
                {a.present} présent · {a.total - a.present} absent
              </p>
              <small>
                {rate === null
                  ? "Aucune réunion enregistrée pour ce membre"
                  : `${a.total} réunions prises en compte`}
              </small>
            </article>
          );
        })}
      </div>
    </>
  );
}
