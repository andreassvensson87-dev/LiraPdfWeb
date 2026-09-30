import { PDFDocument, degrees } from "pdf-lib";
// Normalize the chosen crop box and page rotation into one upright PDF page.
export async function blockPage(bytes, pageNumber) {
  const source = await PDFDocument.load(bytes);
  if (
    !Number.isInteger(pageNumber) ||
    pageNumber < 1 ||
    pageNumber > source.getPageCount()
  )
    throw Error("Ogiltigt sidnummer.");
  const page = source.getPage(pageNumber - 1),
    crop = page.getCropBox();
  const rotation = ((page.getRotation().angle % 360) + 360) % 360;
  const swapped = rotation === 90 || rotation === 270;
  const width = swapped ? crop.height : crop.width,
    height = swapped ? crop.width : crop.height;
  const doc = await PDFDocument.create();
  const embedded = await doc.embedPage(page, {
    left: crop.x,
    bottom: crop.y,
    right: crop.x + crop.width,
    top: crop.y + crop.height,
  });
  const target = doc.addPage([width, height]);
  target.drawPage(embedded, {
    x: rotation === 180 || rotation === 270 ? width : 0,
    y: rotation === 90 || rotation === 180 ? height : 0,
    width: crop.width,
    height: crop.height,
    rotate: degrees(-rotation),
  });
  return { bytes: await doc.save(), width, height };
}
export function blockCorners(e) {
  const a = e.points[0],
    angle = (e.rotation * Math.PI) / 180;
  const u = { x: Math.cos(angle), y: Math.sin(angle) },
    v = { x: -u.y, y: u.x };
  return [
    [0, 0],
    [e.blockWidth, 0],
    [e.blockWidth, e.blockHeight],
    [0, e.blockHeight],
  ].map(([x, y]) => ({
    x: a.x + x * u.x + y * v.x,
    y: a.y + x * u.y + y * v.y,
  }));
}
