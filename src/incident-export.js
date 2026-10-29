const sections = (incident) => [
  ["Description de l’incident", incident.description],
  ["Mesures prises", incident.actions],
  ["Suite à donner", incident.followup],
];
export async function incidentWord(incident, patrol) {
  const { Document, Packer, Paragraph, HeadingLevel, TextRun } = await import(
    "docx"
  );
  return Packer.toBlob(
    new Document({
      creator: "Nexus · Troupe Orion",
      title: `Incident · ${incident.event}`,
      styles: {
        default: {
          document: {
            run: { font: "Calibri", size: 23 },
            paragraph: { spacing: { after: 160 } },
          },
        },
      },
      sections: [
        {
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: "NEXUS · TROUPE ORION",
                  bold: true,
                  color: "245333",
                  size: 24,
                }),
              ],
            }),
            new Paragraph({
              text: "Rapport d’incident",
              heading: HeadingLevel.TITLE,
            }),
            new Paragraph({
              text: incident.event,
              heading: HeadingLevel.HEADING_1,
            }),
            new Paragraph(`Patrouille ${patrol} · ${incident.date}`),
            ...sections(incident).flatMap(([name, text]) => [
              new Paragraph({ text: name, heading: HeadingLevel.HEADING_2 }),
              ...String(text || "Non renseigné")
                .split("\n")
                .map((line) => new Paragraph(line)),
            ]),
          ],
        },
      ],
    }),
  );
}
export async function incidentPdf(incident, patrol) {
  const [{ jsPDF }, { default: html2canvas }] = await Promise.all([
    import("jspdf"),
    import("html2canvas"),
  ]);
  await document.fonts.ready;
  const host = document.createElement("div");
  Object.assign(host.style, {
    position: "fixed",
    top: "0",
    left: "-12000px",
    width: "794px",
    pointerEvents: "none",
  });
  document.body.append(host);
  const pages = [];
  let body;
  function node(tag, text, style = {}) {
    const el = document.createElement(tag);
    el.textContent = text;
    Object.assign(el.style, style);
    return el;
  }
  function page() {
    const sheet = node("article", "", {
      width: "794px",
      height: "1123px",
      position: "relative",
      background: "#faf8ef",
      color: "#193d27",
      fontFamily: '"DM Sans Variable",Arial,sans-serif',
      boxSizing: "border-box",
      paddingBottom: "65px",
      overflow: "hidden",
    });
    const header = node("div", "", {
      padding: "34px 42px",
      background: "#153e29",
      color: "#fff",
    });
    header.append(
      node("div", "NEXUS · TROUPE ORION", {
        fontSize: "12px",
        letterSpacing: "3px",
        color: "#c7dda8",
      }),
      node("h1", "Rapport d’incident", { fontSize: "29px", margin: "14px 0" }),
      node("h2", incident.event, {
        fontSize: "22px",
        margin: "0 0 12px",
        overflowWrap: "anywhere",
      }),
      node("div", `Patrouille ${patrol} · ${incident.date}`, {
        fontSize: "14px",
      }),
    );
    body = node("div", "", { padding: "24px 42px 0" });
    sheet.append(header, body);
    host.append(sheet);
    pages.push(sheet);
  }
  try {
    page();
    for (const [title, value] of sections(incident)) {
      const parts = [];
      let part = "",
        lines = 0;
      for (const token of String(value || "Non renseigné").split(/(\n|\s+)/)) {
        const pieces =
          token.length > 600 ? token.match(/[\s\S]{1,600}/g) : [token];
        for (const piece of pieces) {
          if (part && (part.length + piece.length > 700 || lines >= 8)) {
            parts.push(part);
            part = "";
            lines = 0;
          }
          part += piece;
          if (piece.includes("\n")) lines++;
        }
      }
      if (part) parts.push(part);
      for (let i = 0; i < parts.length; i++) {
        const block = node("section", "", {
          padding: "16px 20px",
          marginBottom: "16px",
          borderLeft: "4px solid #8caa67",
          background: "#fff",
          borderRadius: "0 10px 10px 0",
        });
        block.append(
          node("h3", `${title}${i ? " · suite" : ""}`, {
            fontSize: "15px",
            margin: "0 0 12px",
            color: "#58733f",
          }),
          node("p", parts[i], {
            fontSize: "15px",
            lineHeight: "1.65",
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
            margin: "0",
          }),
        );
        body.append(block);
        if (body.offsetTop + body.scrollHeight > 1040) {
          block.remove();
          page();
          body.append(block);
        }
      }
    }
    const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
    pdf.setProperties({
      title: `Rapport d’incident · ${incident.event}`,
      author: "Nexus · Troupe Orion",
    });
    for (let i = 0; i < pages.length; i++) {
      pages[i].append(
        node(
          "div",
          `NEXUS · TROUPE ORION — RAPPORT D’INCIDENT · ${i + 1} / ${pages.length}`,
          {
            position: "absolute",
            bottom: "24px",
            left: "42px",
            right: "42px",
            borderTop: "1px solid #bdcfa9",
            paddingTop: "12px",
            fontSize: "10px",
            color: "#748563",
          },
        ),
      );
      const canvas = await html2canvas(pages[i], {
        scale: 1.5,
        logging: false,
        backgroundColor: "#faf8ef",
        windowWidth: 794,
        windowHeight: 1123,
      });
      if (i) pdf.addPage();
      pdf.addImage(
        canvas.toDataURL("image/jpeg", 0.94),
        "JPEG",
        0,
        0,
        210,
        297,
        undefined,
        "FAST",
      );
    }
    return pdf.output("blob");
  } finally {
    host.remove();
  }
}
