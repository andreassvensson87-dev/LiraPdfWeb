import { PDFDocument, PDFName, PDFDict } from "pdf-lib";
import { tokens, pageContent } from "./pdf-line-edit.js";
import { multiply } from "./pdf-snapping.js";
const identity = [1, 0, 0, 1, 0, 0];
function decodeString(raw) {
  if (raw[0] === "<") {
    let hex = raw.slice(1, -1).replace(/\s/g, "");
    if (hex.length % 2) hex += "0";
    return Uint8Array.from(hex.match(/../g) || [], (v) => parseInt(v, 16));
  }
  const result = [];
  for (let i = 1; i < raw.length - 1; i++) {
    let c = raw[i];
    if (c === "\\") {
      c = raw[++i];
      if (c === "\r" || c === "\n") {
        if (c === "\r" && raw[i + 1] === "\n") i++;
        continue;
      }
      if (/[0-7]/.test(c)) {
        let oct = c;
        while (oct.length < 3 && /[0-7]/.test(raw[i + 1] || "x"))
          oct += raw[++i];
        result.push(parseInt(oct, 8) & 255);
        continue;
      }
      c = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f" }[c] || c;
    }
    result.push(c.charCodeAt(0));
  }
  return Uint8Array.from(result);
}
function simpleText(doc, page, name, raw) {
  const fonts = page.node.Resources()?.lookup(PDFName.of("Font"), PDFDict);
  const font = fonts?.lookup(PDFName.of(name.slice(1)), PDFDict);
  if (!font) return null;
  const subtype = font.get(PDFName.of("Subtype"))?.toString();
  if (
    !["/Type1", "/TrueType"].includes(subtype) ||
    font.has(PDFName.of("ToUnicode"))
  )
    return null;
  const encoding = font.get(PDFName.of("Encoding"))?.toString();
  const bytes = decodeString(raw);
  if (encoding !== "/WinAnsiEncoding") {
    const base = font.get(PDFName.of("BaseFont"))?.toString() || "";
    if (encoding && encoding !== "/StandardEncoding") return null;
    if (
      !/^\/(Helvetica|Times|Courier)/.test(base) ||
      bytes.some((b) => b < 32 || b > 126)
    )
      return null;
  }
  return new TextDecoder("windows-1252").decode(bytes);
}
// Conservative first pass: one independently positioned string per text object.
// Reject clipping text, custom encodings, forms, and streams containing inline images.
export function removableTexts(content, doc, page) {
  const ts = tokens(content);
  if (ts.some((t) => ["BDC", "BMC"].includes(t.value))) return [];
  if (ts.some((t) => t.value === "BI")) return [];
  let matrix = identity.slice(),
    font = null,
    mode = 0,
    stack = [],
    args = [],
    block = null;
  const result = [];
  for (const t of ts) {
    if (
      t.value === "string" ||
      t.value.startsWith("/") ||
      /^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(t.value)
    ) {
      args.push(t);
      continue;
    }
    const nums = args.map((a) => Number(a.value));
    if (t.value === "q") stack.push({ matrix: [...matrix], font, mode });
    if (t.value === "Q") {
      const previous = stack.pop();
      if (previous) ({ matrix, font, mode } = previous);
    }
    if (t.value === "cm" && nums.length === 6) matrix = multiply(matrix, nums);
    if (t.value === "Tf") font = args[0]?.value;
    if (t.value === "Tr") mode = nums[0];
    if (t.value === "BT")
      block = { count: 0, invalid: false, candidate: null, tm: null };
    if (block) {
      if (t.value === "Tm" && nums.length === 6)
        block.tm = multiply(matrix, nums);
      if (
        (["Td", "TD", "T*"].includes(t.value) && !block.count) ||
        ["'", '"', "TJ", "Do", "cm"].includes(t.value)
      )
        block.invalid = true;
      if (t.value === "Tj") {
        block.count++;
        const arg = args[0];
        if (
          args.length === 1 &&
          arg.value === "string" &&
          block.tm &&
          font &&
          mode >= 0 &&
          mode <= 2
        ) {
          let text;
          try {
            text = simpleText(
              doc,
              page,
              font,
              content.slice(arg.start, arg.end),
            );
          } catch {
            text = null;
          }
          if (text?.trim())
            block.candidate = {
              offset: arg.start,
              end: arg.end,
              text,
              x: block.tm[4],
              y: block.tm[5],
            };
        }
      }
      if (t.value === "ET") {
        if (!block.invalid && block.count === 1 && block.candidate)
          result.push(block.candidate);
        block = null;
      }
    }
    args = [];
  }
  return result;
}
export async function textRemovalTargets(bytes, pageNo, items, viewport) {
  const doc = await PDFDocument.load(bytes),
    page = doc.getPage(pageNo - 1);
  const candidates = removableTexts(pageContent(doc, page), doc, page);
  const normalize = (s) => s.normalize("NFKC").replace(/\s+/g, " ").trim();
  return candidates.flatMap((c) => {
    const matches = items.filter(
      (t) =>
        t.str &&
        normalize(t.str) === normalize(c.text) &&
        Math.hypot(t.transform[4] - c.x, t.transform[5] - c.y) < 0.05,
    );
    // Ambiguous overlaps and strings split by extraction are not eligible.
    if (
      matches.length !== 1 ||
      candidates.filter((t) => Math.hypot(t.x - c.x, t.y - c.y) < 0.05)
        .length !== 1
    )
      return [];
    const t = matches[0],
      m = multiply(viewport.transform, t.transform);
    const length = Math.hypot(m[0], m[1]),
      height = Math.hypot(m[2], m[3]);
    if (!length || !height || t.dir === "ttb") return [];
    const u = { x: m[0] / length, y: m[1] / length },
      v = { x: m[2] / height, y: m[3] / height };
    const a = { x: m[4] - v.x * height * 0.2, y: m[5] - v.y * height * 0.2 };
    const polygon = [
      a,
      { x: a.x + u.x * t.width, y: a.y + u.y * t.width },
      {
        x: a.x + u.x * t.width + v.x * height,
        y: a.y + u.y * t.width + v.y * height,
      },
      { x: a.x + v.x * height, y: a.y + v.y * height },
    ];
    return [{ ...c, polygon }];
  });
}
export function textTargetAt(targets, p) {
  return targets.find((t) => {
    const [a, b, , d] = t.polygon,
      u = { x: b.x - a.x, y: b.y - a.y },
      v = { x: d.x - a.x, y: d.y - a.y },
      q = { x: p.x - a.x, y: p.y - a.y };
    const det = u.x * v.y - u.y * v.x;
    if (Math.abs(det) < 1e-9) return false;
    const x = (q.x * v.y - q.y * v.x) / det,
      y = (u.x * q.y - u.y * q.x) / det;
    return x >= 0 && x <= 1 && y >= 0 && y <= 1;
  });
}
