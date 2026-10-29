import { campCategories } from "./camp.js";
const MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const green = "183E2A",
  pale = "EAF2E4",
  ink = "234432",
  gold = "D0AC60";
async function book() {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = "Nexus · Troupe Orion";
  wb.created = new Date();
  return wb;
}
function heading(ws, title, subtitle, width) {
  ws.mergeCells(1, 1, 1, width);
  ws.getCell(1, 1).value = title;
  ws.getRow(1).height = 38;
  ws.getCell(1, 1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: green },
  };
  ws.getCell(1, 1).font = {
    name: "Calibri",
    size: 20,
    bold: true,
    color: { argb: "FFFFFF" },
  };
  ws.mergeCells(2, 1, 2, width);
  ws.getCell(2, 1).value = subtitle;
  ws.getCell(2, 1).font = {
    name: "Calibri",
    size: 11,
    italic: true,
    color: { argb: ink },
  };
  ws.getRow(2).height = 28;
  ws.views = [{ state: "frozen", ySplit: 7 }];
  ws.pageSetup = {
    paperSize: 9,
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
  };
  ws.headerFooter.oddFooter = "Nexus · Troupe Orion | Page &P / &N";
}
function table(ws, name, headers, rows, start = 7) {
  ws.addTable({
    name,
    ref: `A${start}`,
    headerRow: true,
    style: { theme: "TableStyleMedium4", showRowStripes: true },
    columns: headers.map((name) => ({ name, filterButton: true })),
    rows: rows.length ? rows : [headers.map(() => "")],
  });
  ws.getRow(start).height = 29;
  ws.getRow(start).eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFF" }, name: "Calibri" };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: green } };
  });
  for (let r = start + 1; r <= start + Math.max(1, rows.length); r++) {
    const row = ws.getRow(r);
    row.height = 30;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { name: "Calibri", size: 12, color: { argb: ink } };
      cell.alignment = { vertical: "middle", wrapText: true };
      cell.border = { bottom: { style: "hair", color: { argb: "D9E5D2" } } };
      if (r % 2 === 0)
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: pale },
        };
    });
  }
}
async function blob(wb) {
  return new Blob([await wb.xlsx.writeBuffer()], { type: MIME });
}
export async function cashflowExcel(patrol, transactions, activities) {
  const wb = await book();
  let id = 0;
  for (const activity of activities) {
    const ws = wb.addWorksheet(activity.slice(0, 31), {
      properties: { tabColor: { argb: green } },
    });
    heading(
      ws,
      `Cashflow · ${patrol}`,
      `${activity} · Tous les montants sont en dollars américains ($)`,
      4,
    );
    ws.columns = [{ width: 17 }, { width: 58 }, { width: 22 }, { width: 22 }];
    const rows = transactions.filter((t) => t.activity === activity);
    const income = rows
        .filter((t) => t.type === "in")
        .reduce((n, t) => n + Number(t.amount), 0),
      expense = rows
        .filter((t) => t.type === "out")
        .reduce((n, t) => n + Number(t.amount), 0);
    table(
      ws,
      `Cashflow${++id}`,
      ["Date", "Description", "Entrées ($)", "Sorties ($)"],
      rows.map((t) => [
        t.date,
        t.description,
        t.type === "in" ? Number(t.amount) : 0,
        t.type === "out" ? Number(t.amount) : 0,
      ]),
    );
    const end = Math.max(8, 7 + rows.length);
    for (const [cell, formula, result] of [
      ["B4", `SUM(C8:C${end})`, income],
      ["D4", `SUM(D8:D${end})`, expense],
      ["B5", "B4-D4", income - expense],
    ]) {
      ws.getCell(cell).value = { formula, result };
      ws.getCell(cell).numFmt = '"$"#,##0.00;[Red]("$"#,##0.00)';
      ws.getCell(cell).font = { bold: true, size: 15, color: { argb: ink } };
      ws.getCell(cell).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: pale },
      };
    }
    ws.getCell("A4").value = "TOTAL ENTRÉES";
    ws.getCell("C4").value = "TOTAL SORTIES";
    ws.getCell("A5").value = "SOLDE NET";
    ws.getRow(4).height = 31;
    ws.getRow(5).height = 31;
    for (const c of ["A4", "C4", "A5"])
      ws.getCell(c).font = { bold: true, size: 11, color: { argb: ink } };
    ws.getColumn(3).numFmt = '"$"#,##0.00';
    ws.getColumn(4).numFmt = '"$"#,##0.00';
  }
  return blob(wb);
}
export async function campExcel(camp, patrol) {
  const wb = await book();
  let id = 0;
  for (const cat of campCategories) {
    const ws = wb.addWorksheet(
      cat.name.replace(/[\\/?*\[\]:]/g, "").slice(0, 31),
      { properties: { tabColor: { argb: gold } } },
    );
    heading(
      ws,
      cat.name,
      `${camp.fields.title || camp.title} · Patrouille ${patrol}`,
      2,
    );
    ws.columns = [{ width: 44 }, { width: 95 }];
    table(
      ws,
      `Camp${++id}`,
      ["Information", "Réponse"],
      cat.fields.map(([key, label]) => [label, String(camp.fields[key] ?? "")]),
      4,
    );
    ws.views = [{ state: "frozen", ySplit: 4 }];
    cat.fields.forEach(([key], index) => {
      const length = String(camp.fields[key] ?? "").length;
      ws.getRow(index + 5).height = Math.max(
        34,
        Math.min(300, Math.ceil(length / 90) * 18 + 18),
      );
    });
    ws.pageSetup.orientation = "portrait";
  }
  return blob(wb);
}
export async function attendanceExcel(patrol, members, meetings) {
  const wb = await book();
  const ws = wb.addWorksheet("Présences");
  heading(
    ws,
    `Présences · ${patrol}`,
    `${meetings.length} réunion(s) · Présent / Absent`,
    Math.max(3, meetings.length + 3),
  );
  ws.columns = [
    { width: 32 },
    ...meetings.map(() => ({ width: 23 })),
    { width: 18 },
    { width: 18 },
  ];
  const headers = [
    "Membre",
    ...meetings.map((m, i) => `${m.date} · ${m.title} [${i + 1}]`),
    "Présences",
    "Assiduité",
  ];
  const rows = members.map((member) => {
    const relevant = meetings.filter((m) =>
      Object.prototype.hasOwnProperty.call(m.attendance, member.id),
    );
    const present = relevant.filter(
      (m) => m.attendance[member.id] === "present",
    ).length;
    return [
      member.name,
      ...meetings.map((m) =>
        m.attendance[member.id] === "present"
          ? "Présent"
          : m.attendance[member.id] === "absent"
            ? "Absent"
            : "Non inscrit",
      ),
      present,
      relevant.length ? present / relevant.length : "—",
    ];
  });
  table(ws, "Attendance", headers, rows);
  ws.getColumn(headers.length).numFmt = "0%";
  return blob(wb);
}
export async function meetingWord(patrol, meeting, members) {
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    HeadingLevel,
    Table,
    TableRow,
    TableCell,
    WidthType,
  } = await import("docx");
  const cell = (text) =>
    new TableCell({ children: [new Paragraph(String(text))] });
  const attendance = Object.entries(meeting.attendance).map(([id, s]) => [
    members.find((m) => m.id === id)?.name ||
      meeting.memberNames?.[id] ||
      "Ancien membre",
    s === "present" ? "Présent" : "Absent",
  ]);
  const document = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            text: "NEXUS · TROUPE ORION",
            heading: HeadingLevel.TITLE,
          }),
          new Paragraph({
            text: meeting.title,
            heading: HeadingLevel.HEADING_1,
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Patrouille ${patrol} · ${meeting.date}`,
                bold: true,
              }),
            ],
          }),
          new Paragraph({
            text: "Rapport de la réunion",
            heading: HeadingLevel.HEADING_2,
          }),
          ...String(meeting.summary || "")
            .split("\n")
            .map((text) => new Paragraph(text)),
          new Paragraph({ text: "Présences", heading: HeadingLevel.HEADING_2 }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({ children: [cell("Membre"), cell("Présence")] }),
              ...attendance.map(
                (row) => new TableRow({ children: row.map(cell) }),
              ),
            ],
          }),
        ],
      },
    ],
  });
  return Packer.toBlob(document);
}
