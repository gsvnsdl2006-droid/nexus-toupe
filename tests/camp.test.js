import { test } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { createCamp, campCategories } from "../src/camp.js";
import {
  campExcel,
  cashflowExcel,
  attendanceExcel,
  meetingWord,
} from "../src/exports.js";
test("camp export has ten styled, printable sheets with saved answers", async () => {
  const c = createCamp("camp", "Camp de Noël", "2026-12-20");
  c.fields.goals = "Autonomie";
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await (await campExcel(c, "Goélands")).arrayBuffer());
  assert.equal(wb.worksheets.length, campCategories.length);
  const ws = wb.getWorksheet("Objectifs");
  assert.equal(ws.getCell("B5").value, "Autonomie");
  assert.equal(ws.getCell("A1").fill.fgColor.argb, "183E2A");
  assert.equal(ws.getCell("A4").font.bold, true);
  assert.equal(ws.views[0].ySplit, 4);
  assert.equal(ws.getTables().length, 1);
});
test("cashflow export has dollar formats, formulas and striped tables", async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(
    await (
      await cashflowExcel(
        "Lions",
        [
          {
            activity: "caisse",
            type: "in",
            amount: 120,
            date: "2026-10-28",
            description: "Cotisation",
          },
          {
            activity: "caisse",
            type: "out",
            amount: 30,
            date: "2026-10-28",
            description: "Matériel",
          },
        ],
        ["caisse"],
      )
    ).arrayBuffer(),
  );
  const ws = wb.worksheets[0];
  assert.equal(ws.getCell("B4").value.result, 120);
  assert.equal(ws.getCell("D4").value.result, 30);
  assert.equal(ws.getCell("B5").value.result, 90);
  assert.match(ws.getCell("C8").numFmt, /\$/);
  assert.equal(ws.getTable("Cashflow1").table.style.showRowStripes, true);
});
test("presence export distinguishes absence from not enrolled and calculates attendance", async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(
    await (
      await attendanceExcel(
        "Lions",
        [{ id: "a", name: "Scout" }],
        [
          { title: "Avant", date: "2026-10-20", attendance: {} },
          {
            title: "Réunion",
            date: "2026-10-28",
            attendance: { a: "present" },
          },
        ],
      )
    ).arrayBuffer(),
  );
  const row = wb.worksheets[0].getRow(8);
  assert.equal(row.getCell(2).value, "Non inscrit");
  assert.equal(row.getCell(3).value, "Présent");
  assert.equal(row.getCell(5).value, 1);
});
test("meeting export generates a real Word document ZIP", async () => {
  const blob = await meetingWord(
    "Lions",
    {
      title: "Réunion",
      date: "2026-10-28",
      summary: "Programme de camp",
      attendance: { a: "present" },
    },
    [{ id: "a", name: "Scout" }],
  );
  assert.equal(
    Buffer.from(await blob.arrayBuffer())
      .subarray(0, 2)
      .toString(),
    "PK",
  );
  assert.ok(blob.size > 1000);
});
