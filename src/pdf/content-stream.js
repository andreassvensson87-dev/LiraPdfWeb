import { PDFArray, PDFRawStream, decodePDFRawStream } from "pdf-lib";
export function tokens(s) {
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
      out.push({ value: "string", start, end: i });
      continue;
    }
    if (s[i] === "<" && s[i + 1] !== "<") {
      i++;
      while (i < s.length && s[i] !== ">") i++;
      i++;
      out.push({ value: "string", start, end: i });
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
export function pageContent(doc, page) {
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
