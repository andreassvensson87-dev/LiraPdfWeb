import * as pdfjs from "pdfjs-dist";
import worker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
export { exportPdf } from "./export.js";
pdfjs.GlobalWorkerOptions.workerSrc = worker;
export const loadPdf = (bytes) =>
  pdfjs.getDocument({
    data: bytes.slice(),
    cMapUrl: `${import.meta.env.BASE_URL}pdfjs/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${import.meta.env.BASE_URL}pdfjs/standard_fonts/`,
    wasmUrl: `${import.meta.env.BASE_URL}pdfjs/wasm/`,
  }).promise;
export async function demoPdf() {
  const doc = await PDFDocument.create(),
    p = doc.addPage([842, 595]),
    font = await doc.embedFont(StandardFonts.Helvetica),
    bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.26, 0.34, 0.33),
    light = rgb(0.73, 0.77, 0.75);
  const line = (a, b, w = 1) =>
    p.drawLine({
      start: { x: a[0], y: a[1] },
      end: { x: b[0], y: b[1] },
      thickness: w,
      color: ink,
    });
  const text = (t, x, y, size = 10, f = font) =>
    p.drawText(t, { x, y, size, font: f, color: ink });
  p.drawRectangle({
    x: 25,
    y: 25,
    width: 792,
    height: 545,
    borderWidth: 0.5,
    borderColor: light,
  });
  text("LIRA / EXEMPELPROJEKT", 48, 536, 10, bold);
  text("Entréplan", 48, 501, 24, bold);
  text(
    "Prova ritverktyg, kommentarer och måttsättning på denna ritning.",
    48,
    480,
    9,
  );
  const x = 92,
    y = 133,
    w = 540,
    h = 300;
  p.drawRectangle({
    x,
    y,
    width: w,
    height: h,
    borderWidth: 3,
    borderColor: ink,
  });
  p.drawRectangle({
    x: x + 6,
    y: y + 6,
    width: w - 12,
    height: h - 12,
    borderWidth: 0.7,
    borderColor: ink,
  });
  line([302, y], [302, y + h], 2);
  line([482, y], [482, y + h], 2);
  line([x, 283], [482, 283], 2);
  p.drawRectangle({
    x: 301,
    y: 195,
    width: 3,
    height: 58,
    color: rgb(1, 1, 1),
  });
  line([302, 195], [355, 195], 1);
  p.drawEllipse({
    x: 168,
    y: 348,
    xScale: 35,
    yScale: 22,
    borderColor: light,
    borderWidth: 1,
  });
  p.drawRectangle({
    x: 360,
    y: 328,
    width: 65,
    height: 55,
    borderColor: light,
    borderWidth: 1,
  });
  text("MÖTESRUM", 145, 305, 11);
  text("KONTOR", 365, 305, 11);
  text("ENTRÉ", 365, 165, 11);
  text("ARBETSPLATSER", 126, 165, 11);
  text("TEKNIK", 530, 270, 11);
  line([92, 103], [632, 103], 0.6);
  line([92, 93], [92, 120], 0.6);
  line([632, 93], [632, 120], 0.6);
  text("12 000", 344, 89, 10);
  text("Kalibrera mellan ytterväggarnas hörn: 12 000 mm", 92, 68, 9);
  text("A-40.1-001", 661, 72, 14, bold);
  text("PLAN 01 · EXEMPEL", 661, 54, 8);
  return doc.save();
}
