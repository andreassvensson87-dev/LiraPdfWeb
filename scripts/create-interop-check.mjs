// Creates the reference PDF for manual verification in Bluebeam Revu.
import fs from "node:fs/promises";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { saveEditablePdf } from "../src/editable-pdf.js";
import { mmPerPoint } from "../src/viewports.js";
await fs.mkdir("output/pdf", { recursive: true });
const doc = await PDFDocument.create(),
  page = doc.addPage([841.89, 595.28]),
  font = await doc.embedFont(StandardFonts.Helvetica),
  bold = await doc.embedFont(StandardFonts.HelveticaBold);
const green = rgb(0.08, 0.35, 0.29),
  ink = rgb(0.14, 0.23, 0.25),
  muted = rgb(0.38, 0.44, 0.45);
const text = (value, x, y, size = 11, color = ink, strong = false) =>
  page.drawText(value, {
    x,
    y: 595.28 - y,
    font: strong ? bold : font,
    size,
    color,
  });
text(
  "LiraPDF - kontroll av markeringar, mått och skala",
  42,
  42,
  21,
  green,
  true,
);
text(
  "PDF-standardens mätfält. Referenser för kontroll i Bluebeam Revu.",
  42,
  66,
  11,
  muted,
);
page.drawLine({
  start: { x: 42, y: 513 },
  end: { x: 800, y: 513 },
  thickness: 1,
  color: green,
});
text("PAPPER 1:100", 60, 126, 13, green, true);
text("Referens: 10 000 mm", 60, 146, 11);
text("DETALJ A 1:50", 440, 126, 13, green, true);
text("Referens: 5 000 mm", 440, 146, 11);
const dimLength = 100 / mmPerPoint;
for (const x of [60, 455])
  page.drawLine({
    start: { x, y: 595.28 - 230 },
    end: { x: x + dimLength, y: 595.28 - 230 },
    thickness: 0.7,
    color: muted,
  });
text(
  "Båda referenslinjerna är 100 mm på pappret vid utskrift i 100 %.",
  42,
  330,
  10,
  muted,
);
text(
  "Markeringar: rektangel, moln, frihand, färgmarkering och stämpel",
  42,
  350,
  11,
  green,
  true,
);
text(
  "Kontrollera i Revu: referensvärden, separata markeringar och områdesskala.",
  42,
  548,
  10,
);
text(
  "Flytta ett mått, spara och öppna PDF:en i Lira igen. Revu-kontrollen är ännu inte utförd.",
  42,
  566,
  10,
  muted,
);
const style = { color: "#147b60", width: 1.2, fontSize: 12, opacity: 1 },
  pt = (x, y) => ({ x, y });
const entity = (type, id, points, extra = {}) => ({
  type,
  id,
  page: 1,
  points: points.map(([x, y]) => pt(x, y)),
  ...style,
  ...extra,
});
const state = {
  entities: [
    entity(
      "viewport",
      "detail-a",
      [
        [435, 165],
        [790, 305],
      ],
      { denominator: 50, name: "Detalj A", showLabel: false },
    ),
    entity("dim", "dimension-paper", [
      [60, 230],
      [60 + dimLength, 230],
      [200, 275],
    ]),
    entity(
      "dim",
      "dimension-detail",
      [
        [455, 230],
        [455 + dimLength, 230],
        [600, 275],
      ],
      { viewportId: "detail-a" },
    ),
    entity(
      "rect",
      "rectangle",
      [
        [60, 375],
        [170, 440],
      ],
      { color: "#b3261e", opacity: 0.75 },
    ),
    entity(
      "cloud",
      "cloud",
      [
        [205, 375],
        [325, 440],
      ],
      { color: "#a76517" },
    ),
    entity(
      "freehand",
      "pen",
      [
        [355, 410],
        [372, 385],
        [390, 420],
        [415, 385],
      ],
      { width: 3 },
    ),
    entity(
      "highlight",
      "highlight",
      [
        [460, 412],
        [565, 412],
      ],
      { color: "#ffff00", width: 14, opacity: 0.7 },
    ),
    entity(
      "stamp",
      "stamp",
      [
        [610, 380],
        [780, 445],
      ],
      { color: "#147b60", text: "GRANSKAD", fontSize: 18 },
    ),
  ],
  scales: { 1: 100 * mmPerPoint },
};
const viewer = {
  getPage: async () => ({
    rotate: 0,
    userUnit: 1,
    getViewport: () => ({ convertToPdfPoint: (x, y) => [x, 595.28 - y] }),
  }),
};
const output = await saveEditablePdf(await doc.save(), state, viewer);
await fs.writeFile("output/pdf/lirapdf-bluebeam-kontroll.pdf", output);

console.log("Created output/pdf/lirapdf-bluebeam-kontroll.pdf");
