import { PDFDocument } from "pdf-lib";
export const paperSizes = {
  A0: [841, 1189],
  A1: [594, 841],
  A2: [420, 594],
  A3: [297, 420],
  A4: [210, 297],
};
export async function blankPdf(size = "A3", landscape = true) {
  if (!paperSizes[size]) throw Error("Ogiltig pappersstorlek.");
  const dimensions = [...paperSizes[size]];
  if (landscape) dimensions.reverse();
  const doc = await PDFDocument.create();
  doc.addPage(dimensions.map((mm) => (mm * 72) / 25.4));
  return doc.save();
}
