import { test } from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import {
  campCategories,
  campWorkbook,
  createCamp,
  excelBlob,
} from "../src/camp.js";
test("category form generates a real Excel workbook containing saved answers", async () => {
  const c = createCamp("camp", "Camp de Noël", "2026-12-20");
  c.fields.goals = "Autonomie";
  c.fields.location = "Naccache";
  const wb = campWorkbook(c, "Goélands");
  assert.equal(wb.SheetNames.length, campCategories.length);
  const saved = XLSX.read(await excelBlob(wb).arrayBuffer());
  assert.equal(saved.Sheets.Objectifs.B7.v, "Autonomie");
  assert.equal(saved.Sheets["Informations générales"].B8.v, "Naccache");
  assert.equal(saved.Sheets.Objectifs.B2.v, "Goélands");
});
