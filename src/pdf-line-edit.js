import {
  PDFDocument,
  PDFArray,
  PDFRawStream,
  PDFName,
  decodePDFRawStream,
} from "pdf-lib";
import { multiply } from "./pdf-snapping.js";
const identity = [1, 0, 0, 1, 0, 0];
function tokens(s) {
  const out = [];
  let i = 0;
  while (i < s.length) {
    if (/[\s\0]/.test(s[i])) {
      i++;
      continue;
    }
    if (s[i] === "%") {
      while (i < s.length && !/[\r\n]/.test(s[i])) i++;
      continue;
    }
    const start = i;
    if (s[i] === "(") {
      let depth = 1;
      i++;
      while (i < s.length && depth) {
        if (s[i] === "\\") {
          i += 2;
          continue;
        }
        if (s[i] === "(") depth++;
        if (s[i] === ")") depth--;
        i++;
      }
      out.push({ value: "string", start });
      continue;
    }
    if (s[i] === "<" && s[i + 1] !== "<") {
      i++;
      while (i < s.length && s[i] !== ">") i++;
      i++;
      out.push({ value: "string", start });
      continue;
    }
    if ("[]<>".includes(s[i])) {
      out.push({ value: s[i++], start });
      continue;
    }
    if (s[i] === "/") i++;
    while (i < s.length && !/[\s\0()[\]<>/%]/.test(s[i])) i++;
    if (i === start) i++;
    out.push({ value: s.slice(start, i), start });
  }
  return out;
}
// Only isolated straight strokes are eligible. Filled/compound/clipping paths,
// Form XObjects and inline-image streams are deliberately left untouched.
export function removableLines(content) {
  const ts = tokens(content);
  if (ts.some((t) => t.value === "BI")) return [];
  let matrix = identity.slice(),
    stack = [],
    args = [],
    path = null;
  const lines = [];
  const point = (x, y) => ({
    x: matrix[0] * x + matrix[2] * y + matrix[4],
    y: matrix[1] * x + matrix[3] * y + matrix[5],
  });
  for (const t of ts) {
    if (/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(t.value)) {
      args.push(Number(t.value));
      continue;
    }
    const op = t.value;
    if (op === "q") stack.push(matrix.slice());
    else if (op === "Q") matrix = stack.pop() || identity.slice();
    else if (op === "cm" && args.length === 6) matrix = multiply(matrix, args);
    if (op === "m") {
      if (path && (path.b || path.invalid)) path.invalid = true;
      else
        path = {
          a: args.length === 2 ? point(...args) : null,
          b: null,
          invalid: false,
        };
    } else if (op === "l" && path) {
      if (path.b || args.length !== 2) path.invalid = true;
      else path.b = point(...args);
    } else if (
      ["S", "s", "f", "F", "f*", "B", "B*", "b", "b*", "n"].includes(op)
    ) {
      if (op === "S" && path?.a && path.b && !path.invalid)
        lines.push({ ...path, offset: t.start });
      path = null;
    } else if (path && op !== "m") path.invalid = true;
    // Any preceding path component disqualifies the whole path until a paint/end operator.
    if (["re", "c", "v", "y", "h", "W", "W*"].includes(op))
      path = { invalid: true };
    args = [];
  }
  return lines;
}
function pageContent(doc, page) {
  const contents = page.node.Contents();
  if (!contents) return "";
  const refs = contents instanceof PDFArray ? contents.asArray() : [contents];
  return refs
    .map((ref) => {
      const stream = doc.context.lookup(ref, PDFRawStream);
      const data = decodePDFRawStream(stream).decode();
      let text = "";
      for (let i = 0; i < data.length; i += 32768)
        text += String.fromCharCode(...data.subarray(i, i + 32768));
      return text;
    })
    .join("\n");
}
function bytesOf(s) {
  return Uint8Array.from(s, (c) => c.charCodeAt(0) & 255);
}
export async function findRemovableLine(bytes, pageNo, segment, viewport) {
  const doc = await PDFDocument.load(bytes),
    content = pageContent(doc, doc.getPage(pageNo - 1));
  const near = (p, q) => Math.hypot(p.x - q.x, p.y - q.y) < 0.05;
  const view = (p) => {
    const [x, y] = viewport.convertToViewportPoint(p.x, p.y);
    return { x, y };
  };
  return removableLines(content).find((l) => {
    const a = view(l.a),
      b = view(l.b);
    return (
      (near(a, segment.a) && near(b, segment.b)) ||
      (near(a, segment.b) && near(b, segment.a))
    );
  });
}
export async function applyLineRemovals(bytes, entities) {
  const edits = entities.filter((e) => e.type === "pdfErase");
  if (!edits.length) return bytes;
  const doc = await PDFDocument.load(bytes);
  for (let i = 0; i < doc.getPageCount(); i++) {
    const offsets = new Set(
      edits.filter((e) => e.page === i + 1).map((e) => e.eraseOffset),
    );
    if (!offsets.size) continue;
    const page = doc.getPage(i),
      content = pageContent(doc, page),
      allowed = new Set(removableLines(content).map((l) => l.offset));
    for (const offset of offsets)
      if (!allowed.has(offset))
        throw Error("PDF-linjen kan inte tas bort säkert.");
    const chars = content.split("");
    for (const offset of offsets) chars[offset] = "n";
    page.node.set(
      PDFName.of("Contents"),
      doc.context.register(doc.context.flateStream(bytesOf(chars.join("")))),
    );
  }
  return doc.save();
}
